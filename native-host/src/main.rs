use base64::Engine;
use regex::{Captures, Regex};
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::io::{self, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{ChildStderr, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{Arc, OnceLock};
use std::thread;

const HOST_NAME: &str = "com.openai.codexextension";
const OFFICIAL_CHROME_ORIGIN: &str = "chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/";
const MAX_NATIVE_MESSAGE_BYTES: usize = 1024 * 1024 * 1024;

fn main() {
    let argument = env::args().nth(1);
    if argument.as_deref() == Some("--version") {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return;
    }
    if argument.as_deref() == Some("--diagnose") {
        match discover_original_host() {
            Ok(path) => {
                println!("bridge-version={}", env!("CARGO_PKG_VERSION"));
                println!("original-host={}", path.display());
                return;
            }
            Err(error) => {
                eprintln!("{error}");
                std::process::exit(1);
            }
        }
    }

    if let Err(error) = run() {
        eprintln!("[codex-firefox-bridge] {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    let relay_port = listener.local_addr()?.port();
    let upstream_port = Arc::new(AtomicU16::new(0));
    start_websocket_relay(listener, Arc::clone(&upstream_port));

    let host_path = discover_original_host()?;
    let mut command = Command::new(&host_path);
    command
        .arg(OFFICIAL_CHROME_ORIGIN)
        .current_dir(host_path.parent().unwrap_or_else(|| Path::new(".")))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if cfg!(windows) {
        command.arg("0");
    }

    let mut child = command.spawn()?;
    let child_stdin = child
        .stdin
        .take()
        .ok_or("original host stdin is unavailable")?;
    let child_stdout = child
        .stdout
        .take()
        .ok_or("original host stdout is unavailable")?;
    let child_stderr = child
        .stderr
        .take()
        .ok_or("original host stderr is unavailable")?;

    let input_thread = thread::spawn(move || forward_stdin(child_stdin));
    let output_thread =
        thread::spawn(move || forward_native_messages(child_stdout, relay_port, upstream_port));
    let error_thread = thread::spawn(move || forward_stderr(child_stderr));

    let status = child.wait()?;
    let _ = output_thread.join();
    let _ = error_thread.join();
    drop(input_thread);
    std::process::exit(status.code().unwrap_or(1));
}

fn forward_stdin(mut output: ChildStdin) {
    if let Err(error) = io::copy(&mut io::stdin().lock(), &mut output) {
        eprintln!("[codex-firefox-bridge] stdin forwarding failed: {error}");
    }
}

fn forward_stderr(mut input: ChildStderr) {
    let _ = io::copy(&mut input, &mut io::stderr().lock());
}

fn forward_native_messages(mut input: ChildStdout, relay_port: u16, upstream_port: Arc<AtomicU16>) {
    let mut output = io::stdout().lock();
    loop {
        let mut header = [0_u8; 4];
        match read_exact_or_eof(&mut input, &mut header) {
            Ok(false) => return,
            Ok(true) => {}
            Err(error) => {
                eprintln!("[codex-firefox-bridge] native header read failed: {error}");
                return;
            }
        }

        let length = u32::from_le_bytes(header) as usize;
        if length > MAX_NATIVE_MESSAGE_BYTES {
            eprintln!("[codex-firefox-bridge] native message is too large: {length}");
            return;
        }
        let mut payload = vec![0_u8; length];
        if let Err(error) = input.read_exact(&mut payload) {
            eprintln!("[codex-firefox-bridge] native payload read failed: {error}");
            return;
        }

        let enriched = enrich_native_message(payload, relay_port, &upstream_port);
        let output_header = (enriched.len() as u32).to_le_bytes();
        if output
            .write_all(&output_header)
            .and_then(|_| output.write_all(&enriched))
            .and_then(|_| output.flush())
            .is_err()
        {
            return;
        }
    }
}

fn read_exact_or_eof(reader: &mut impl Read, buffer: &mut [u8]) -> io::Result<bool> {
    let mut offset = 0;
    while offset < buffer.len() {
        let read = reader.read(&mut buffer[offset..])?;
        if read == 0 {
            if offset == 0 {
                return Ok(false);
            }
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "native message ended unexpectedly",
            ));
        }
        offset += read;
    }
    Ok(true)
}

fn enrich_native_message(payload: Vec<u8>, relay_port: u16, upstream_port: &AtomicU16) -> Vec<u8> {
    let Ok(mut value) = serde_json::from_slice::<Value>(&payload) else {
        return payload;
    };
    let changed =
        enrich_commands(&mut value) | rewrite_websocket_urls(&mut value, relay_port, upstream_port);
    if !changed {
        return payload;
    }
    serde_json::to_vec(&value).unwrap_or(payload)
}

fn enrich_commands(value: &mut Value) -> bool {
    let mut changed = false;
    match value {
        Value::Object(object) => {
            if object.get("method").and_then(Value::as_str) == Some("DOM.setFileInputFiles") {
                for key in ["commandParams", "params"] {
                    let Some(Value::Object(parameters)) = object.get_mut(key) else {
                        continue;
                    };
                    let Some(Value::Array(files)) = parameters.get("files") else {
                        continue;
                    };
                    let payloads: Vec<Value> = files
                        .iter()
                        .filter_map(Value::as_str)
                        .filter_map(file_payload)
                        .collect();
                    if !payloads.is_empty() {
                        parameters.insert("_firefoxFilePayloads".into(), Value::Array(payloads));
                        changed = true;
                    }
                    break;
                }
            }
            for child in object.values_mut() {
                changed |= enrich_commands(child);
            }
        }
        Value::Array(array) => {
            for child in array {
                changed |= enrich_commands(child);
            }
        }
        _ => {}
    }
    changed
}

fn file_payload(path: &str) -> Option<Value> {
    let path = Path::new(path);
    let metadata = fs::metadata(path).ok()?;
    if !metadata.is_file() {
        return None;
    }
    let data = fs::read(path).ok()?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);
    Some(json!({
        "path": path.canonicalize().unwrap_or_else(|_| path.to_path_buf()).to_string_lossy(),
        "name": path.file_name()?.to_string_lossy(),
        "type": mime_type(path.extension().and_then(|value| value.to_str()).unwrap_or("")),
        "lastModified": modified,
        "data": base64::engine::general_purpose::STANDARD.encode(data)
    }))
}

fn mime_type(extension: &str) -> &'static str {
    match extension.to_ascii_lowercase().as_str() {
        "txt" => "text/plain",
        "html" | "htm" => "text/html",
        "json" => "application/json",
        "csv" => "text/csv",
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
}

fn websocket_url_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r#"(?i)ws://(?:127\.0\.0\.1|localhost):(?P<port>\d+)(?P<tail>(?:[/?#][^\s"'\\<>]*)?)"#,
        )
        .expect("valid WebSocket URL pattern")
    })
}

fn rewrite_websocket_urls(value: &mut Value, relay_port: u16, upstream_port: &AtomicU16) -> bool {
    let mut changed = false;
    match value {
        Value::String(text) => {
            if websocket_url_pattern().is_match(text) {
                let rewritten = websocket_url_pattern()
                    .replace_all(text, |captures: &Captures<'_>| {
                        let port = captures["port"].parse::<u16>().unwrap_or(0);
                        if port == 0 || port == relay_port {
                            return captures[0].to_owned();
                        }
                        upstream_port.store(port, Ordering::SeqCst);
                        changed = true;
                        format!("ws://127.0.0.1:{relay_port}{}", &captures["tail"])
                    })
                    .into_owned();
                *text = rewritten;
            }
        }
        Value::Object(object) => {
            for child in object.values_mut() {
                changed |= rewrite_websocket_urls(child, relay_port, upstream_port);
            }
        }
        Value::Array(array) => {
            for child in array {
                changed |= rewrite_websocket_urls(child, relay_port, upstream_port);
            }
        }
        _ => {}
    }
    changed
}

fn start_websocket_relay(listener: TcpListener, upstream_port: Arc<AtomicU16>) {
    thread::spawn(move || {
        for connection in listener.incoming() {
            match connection {
                Ok(browser) => {
                    let upstream_port = Arc::clone(&upstream_port);
                    thread::spawn(move || {
                        if let Err(error) = relay_websocket(browser, &upstream_port) {
                            eprintln!("[codex-firefox-bridge] WebSocket relay failed: {error}");
                        }
                    });
                }
                Err(error) => {
                    eprintln!("[codex-firefox-bridge] WebSocket accept failed: {error}");
                    return;
                }
            }
        }
    });
}

fn relay_websocket(
    mut browser: TcpStream,
    upstream_port: &AtomicU16,
) -> Result<(), Box<dyn std::error::Error>> {
    let port = upstream_port.load(Ordering::SeqCst);
    if port == 0 {
        return Err("upstream app-server port is unavailable".into());
    }
    let mut upstream = TcpStream::connect(("127.0.0.1", port))?;
    let request = read_http_headers(&mut browser)?;
    upstream.write_all(rewrite_websocket_request(&request, port).as_bytes())?;
    upstream.flush()?;

    let mut browser_read = browser.try_clone()?;
    let mut upstream_write = upstream.try_clone()?;
    let browser_to_upstream = thread::spawn(move || {
        let _ = io::copy(&mut browser_read, &mut upstream_write);
    });
    io::copy(&mut upstream, &mut browser)?;
    let _ = browser_to_upstream.join();
    Ok(())
}

fn read_http_headers(stream: &mut TcpStream) -> io::Result<String> {
    let mut bytes = Vec::new();
    let mut byte = [0_u8; 1];
    while bytes.len() < 64 * 1024 {
        stream.read_exact(&mut byte)?;
        bytes.push(byte[0]);
        if bytes.ends_with(b"\r\n\r\n") {
            return String::from_utf8(bytes)
                .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error));
        }
    }
    Err(io::Error::new(
        io::ErrorKind::InvalidData,
        "WebSocket handshake headers are too large",
    ))
}

fn rewrite_websocket_request(request: &str, upstream_port: u16) -> String {
    request
        .split_inclusive("\r\n")
        .map(|line| {
            let lower = line.to_ascii_lowercase();
            if lower.starts_with("origin:") {
                format!("Origin: {OFFICIAL_CHROME_ORIGIN}\r\n")
            } else if lower.starts_with("host:") {
                format!("Host: 127.0.0.1:{upstream_port}\r\n")
            } else {
                line.to_owned()
            }
        })
        .collect()
}

fn discover_original_host() -> Result<PathBuf, Box<dyn std::error::Error>> {
    for variable in [
        "CODEX_FIREFOX_ORIGINAL_HOST",
        "CHATGPT_FIREFOX_ORIGINAL_HOST",
    ] {
        if let Some(path) = env::var_os(variable).map(PathBuf::from) {
            if path.is_file() {
                return Ok(path);
            }
        }
    }

    if let Ok(executable) = env::current_exe() {
        if let Some(directory) = executable.parent() {
            for name in ["original-host.path", "native-host-proxy.path"] {
                let path_file = directory.join(name);
                if let Ok(value) = fs::read_to_string(path_file) {
                    let path = PathBuf::from(value.trim());
                    if path.is_file() {
                        return Ok(path);
                    }
                }
            }
        }
    }

    for manifest in native_host_manifest_candidates() {
        if let Some(path) = host_path_from_manifest(&manifest) {
            return Ok(path);
        }
    }
    for path in bundled_host_candidates() {
        if path.is_file() {
            return Ok(path);
        }
    }

    Err(format!(
        "The installed OpenAI native host ({HOST_NAME}) was not found. Install the Codex Chrome integration first."
    )
    .into())
}

fn host_path_from_manifest(manifest_path: &Path) -> Option<PathBuf> {
    let manifest: Value = serde_json::from_slice(&fs::read(manifest_path).ok()?).ok()?;
    if manifest.get("name")?.as_str()? != HOST_NAME {
        return None;
    }
    let allowed = manifest.get("allowed_origins")?.as_array()?;
    if !allowed
        .iter()
        .any(|origin| origin.as_str() == Some(OFFICIAL_CHROME_ORIGIN))
    {
        return None;
    }
    let path = PathBuf::from(manifest.get("path")?.as_str()?);
    path.is_file().then_some(path)
}

fn native_host_manifest_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if cfg!(windows) {
        for root in ["HKCU", "HKLM"] {
            let key = format!(r"{root}\Software\Google\Chrome\NativeMessagingHosts\{HOST_NAME}");
            if let Ok(output) = Command::new("reg").args(["query", &key, "/ve"]).output() {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    if let Some(value) = stdout
                        .lines()
                        .find(|line| line.contains("REG_SZ"))
                        .and_then(|line| line.split("REG_SZ").nth(1))
                    {
                        candidates.push(PathBuf::from(value.trim()));
                    }
                }
            }
        }
    } else if cfg!(target_os = "macos") {
        if let Some(home) = env::var_os("HOME").map(PathBuf::from) {
            for browser in [
                "Google/Chrome",
                "Google/Chrome Beta",
                "Google/Chrome Canary",
                "Chromium",
                "BraveSoftware/Brave-Browser",
            ] {
                candidates.push(
                    home.join("Library/Application Support")
                        .join(browser)
                        .join("NativeMessagingHosts")
                        .join(format!("{HOST_NAME}.json")),
                );
            }
        }
        candidates.push(
            PathBuf::from("/Library/Google/Chrome/NativeMessagingHosts")
                .join(format!("{HOST_NAME}.json")),
        );
    } else if let Some(home) = env::var_os("HOME").map(PathBuf::from) {
        for directory in [
            ".config/google-chrome/NativeMessagingHosts",
            ".config/chromium/NativeMessagingHosts",
            ".config/BraveSoftware/Brave-Browser/NativeMessagingHosts",
        ] {
            candidates.push(home.join(directory).join(format!("{HOST_NAME}.json")));
        }
    }
    candidates
}

fn bundled_host_candidates() -> Vec<PathBuf> {
    let Some(home) =
        env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
    else {
        return Vec::new();
    };
    let platform = if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };
    let architecture = if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x64"
    };
    bundled_host_candidates_for(&home, platform, architecture)
}

fn bundled_host_candidates_for(home: &Path, platform: &str, architecture: &str) -> Vec<PathBuf> {
    let base = home.join(".codex/plugins/cache/openai-bundled/chrome/latest/extension-host");
    match platform {
        "windows" => vec![base.join(format!("{platform}/{architecture}/extension-host.exe"))],
        "macos" => vec![
            base.join(format!("{platform}/{architecture}/ChatGPT for Chrome")),
            base.join(format!("{platform}/{architecture}/extension-host")),
        ],
        _ => vec![base.join(format!("{platform}/{architecture}/extension-host"))],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrites_nested_websocket_urls() {
        let mut value = json!({"nested": {"url": "ws://localhost:45678/path?token=test"}});
        let upstream = AtomicU16::new(0);
        assert!(rewrite_websocket_urls(&mut value, 54321, &upstream));
        assert_eq!(upstream.load(Ordering::SeqCst), 45678);
        assert_eq!(
            value["nested"]["url"],
            "ws://127.0.0.1:54321/path?token=test"
        );
    }

    #[test]
    fn rewrites_websocket_origin_and_host() {
        let request = "GET / HTTP/1.1\r\nHost: 127.0.0.1:1\r\nOrigin: moz-extension://abc\r\n\r\n";
        let rewritten = rewrite_websocket_request(request, 45678);
        assert!(rewritten.contains("Host: 127.0.0.1:45678\r\n"));
        assert!(rewritten.contains(&format!("Origin: {OFFICIAL_CHROME_ORIGIN}\r\n")));
    }

    #[test]
    fn uses_the_official_macos_host_layout() {
        let paths = bundled_host_candidates_for(Path::new("/Users/test"), "macos", "arm64");
        assert_eq!(
            paths[0],
            Path::new("/Users/test/.codex/plugins/cache/openai-bundled/chrome/latest/extension-host/macos/arm64/ChatGPT for Chrome")
        );
    }
}
