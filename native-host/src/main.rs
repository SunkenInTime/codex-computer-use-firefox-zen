use base64::Engine;
use regex::{Captures, Regex};
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{ChildStderr, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{Arc, OnceLock};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tempfile::TempDir;

const HOST_NAME: &str = "com.openai.codexextension";
const OFFICIAL_CHROME_ORIGIN: &str = "chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/";
const OFFICIAL_CHROME_EXTENSION_ID: &str = "hehggadaopoacecdllhhajmbjkdcmajg";
const FIREFOX_EXTENSION_ID: &str = "codex-computer-use-firefox-zen@sunkenintime";
const MAX_NATIVE_MESSAGE_BYTES: usize = 1024 * 1024 * 1024;
const CODEX_VERSION_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Debug, PartialEq)]
struct AppServerRuntime {
    codex_cli: PathBuf,
    node: PathBuf,
    browser_client: PathBuf,
    node_repl: PathBuf,
}

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

    match run() {
        Ok(0) => {}
        Ok(code) => std::process::exit(code),
        Err(error) => {
            eprintln!("[codex-firefox-bridge] {error}");
            std::process::exit(1);
        }
    }
}

fn run() -> Result<i32, Box<dyn std::error::Error>> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    let relay_port = listener.local_addr()?.port();
    let upstream_port = Arc::new(AtomicU16::new(0));
    start_websocket_relay(listener, Arc::clone(&upstream_port));

    let host_path = discover_original_host()?;
    let mut command = Command::new(&host_path);
    let fallback_registry = configure_app_server_runtime(&mut command, &host_path);
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
    drop(fallback_registry);
    Ok(status.code().unwrap_or(1))
}

fn configure_app_server_runtime(command: &mut Command, host_path: &Path) -> Option<TempDir> {
    let runtime = discover_app_server_runtime()?;
    for (variable, value) in [
        ("CODEX_CLI_PATH", runtime.codex_cli.clone()),
        ("CODEX_BROWSER_USE_NODE_PATH", runtime.node.clone()),
        ("CODEX_BROWSER_CLIENT_PATH", runtime.browser_client.clone()),
        ("CODEX_NODE_REPL_PATH", runtime.node_repl.clone()),
    ] {
        if env::var_os(variable).is_none() {
            command.env(variable, value);
        }
    }

    if has_registered_app_server() {
        return None;
    }
    let directory = create_fallback_app_server_registry(host_path, &runtime).ok()?;
    command.env("CODEX_HOME", directory.path());
    Some(directory)
}

fn discover_app_server_runtime() -> Option<AppServerRuntime> {
    app_server_resource_candidates()
        .into_iter()
        .find_map(|resources| app_server_runtime_from_resources(&resources))
}

fn app_server_resource_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(resources) = env::var_os("CODEX_FIREFOX_CHATGPT_RESOURCES") {
        candidates.push(PathBuf::from(resources));
    }
    candidates.extend(chatgpt_resource_candidates_for(
        current_platform(),
        env::var_os("HOME").map(PathBuf::from).as_deref(),
    ));
    candidates
}

fn current_platform() -> &'static str {
    if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

fn chatgpt_resource_candidates_for(platform: &str, home: Option<&Path>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    match platform {
        "macos" => {
            candidates.push(PathBuf::from(
                "/Applications/ChatGPT.app/Contents/Resources",
            ));
            if let Some(home) = home {
                candidates.push(home.join("Applications/ChatGPT.app/Contents/Resources"));
            }
        }
        "linux" => {
            candidates.extend([
                PathBuf::from("/usr/lib/chatgpt/resources"),
                PathBuf::from("/usr/lib64/chatgpt/resources"),
                PathBuf::from("/usr/local/lib/chatgpt/resources"),
                PathBuf::from("/opt/chatgpt/resources"),
                PathBuf::from("/opt/ChatGPT/resources"),
            ]);
            if let Some(home) = home {
                candidates.extend([
                    home.join(".local/opt/chatgpt/resources"),
                    home.join(".local/opt/ChatGPT/resources"),
                    home.join(".local/share/chatgpt/resources"),
                    home.join(".local/share/ChatGPT/resources"),
                ]);
            }
        }
        _ => {}
    }
    candidates
}

fn app_server_runtime_from_resources(resources: &Path) -> Option<AppServerRuntime> {
    let runtime = AppServerRuntime {
        codex_cli: resources.join("codex"),
        node: resources.join("cua_node/bin/node"),
        browser_client: resources
            .join("plugins/openai-bundled/plugins/chrome/scripts/browser-client.mjs"),
        node_repl: resources.join("cua_node/bin/node_repl"),
    };
    [
        &runtime.codex_cli,
        &runtime.node,
        &runtime.browser_client,
        &runtime.node_repl,
    ]
    .iter()
    .all(|path| path.is_file())
    .then_some(runtime)
}

fn has_registered_app_server() -> bool {
    app_server_registry_candidates()
        .iter()
        .any(|path| registry_has_entries(path))
}

fn app_server_registry_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(codex_home) = env::var_os("CODEX_HOME").map(PathBuf::from) {
        candidates.push(codex_home.join("chrome-native-hosts-v2.json"));
    }
    if let Some(home) = env::var_os("HOME").map(PathBuf::from) {
        candidates.push(home.join(".codex/chrome-native-hosts-v2.json"));
        if cfg!(target_os = "macos") {
            candidates.push(
                home.join("Library/Application Support/OpenAI/Codex")
                    .join("chrome-native-hosts-v2.json"),
            );
        }
    }
    candidates
}

fn registry_has_entries(path: &Path) -> bool {
    let Ok(bytes) = fs::read(path) else {
        return false;
    };
    let Ok(value) = serde_json::from_slice::<Value>(&bytes) else {
        return false;
    };
    value
        .get("entries")
        .and_then(Value::as_array)
        .is_some_and(|entries| !entries.is_empty())
}

fn create_fallback_app_server_registry(
    host_path: &Path,
    runtime: &AppServerRuntime,
) -> Result<TempDir, Box<dyn std::error::Error>> {
    let directory = tempfile::Builder::new()
        .prefix("codex-firefox-bridge-runtime-")
        .tempdir()?;
    let codex_home = env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".codex")))
        .ok_or("Codex home directory is unavailable")?;

    // The official host discovers fallback installations through CODEX_HOME,
    // but the spawned app server also reads authentication, history, and user
    // configuration there. Mirror the real home into the private registry
    // directory so fallback discovery does not create a signed-out, empty
    // Codex profile.
    mirror_codex_home(&codex_home, directory.path())?;

    let resources = runtime.codex_cli.parent().ok_or("Invalid Codex CLI path")?;
    let app_version = bundled_plugin_version(resources).unwrap_or_else(|| "0.0.0".into());
    let cli_version = codex_cli_version(&runtime.codex_cli).unwrap_or_else(|| "0.0.0".into());
    let entry = fallback_registry_entry(
        host_path,
        runtime,
        &codex_home,
        &app_version,
        &cli_version,
        &current_timestamp(),
    );
    fs::write(
        directory.path().join("chrome-native-hosts-v2.json"),
        serde_json::to_vec_pretty(&json!({
            "schemaVersion": 2,
            "entries": [entry]
        }))?,
    )?;
    Ok(directory)
}

fn mirror_codex_home(source: &Path, target: &Path) -> io::Result<()> {
    if !source.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let name = entry.file_name();
        if name == "chrome-native-hosts-v2.json" || name == "chrome-native-hosts.json" {
            continue;
        }
        let source_path = entry.path();
        let target_path = target.join(&name);
        if target_path.exists() {
            continue;
        }
        #[cfg(unix)]
        std::os::unix::fs::symlink(&source_path, &target_path)?;
        #[cfg(windows)]
        {
            let file_type = entry.file_type()?;
            let linked = if file_type.is_dir() {
                std::os::windows::fs::symlink_dir(&source_path, &target_path)
            } else {
                fs::hard_link(&source_path, &target_path)
            };
            if linked.is_err() && file_type.is_file() {
                fs::copy(&source_path, &target_path)?;
            }
        }
    }
    Ok(())
}

fn fallback_registry_entry(
    host_path: &Path,
    runtime: &AppServerRuntime,
    codex_home: &Path,
    app_version: &str,
    cli_version: &str,
    updated_at: &str,
) -> Value {
    let resources = runtime.codex_cli.parent().unwrap_or_else(|| Path::new("."));
    json!({
        "schemaVersion": 2,
        "appServerProtocolVersion": 2,
        "appVersion": app_version,
        "channel": "prod",
        "cliVersion": cli_version,
        "entryId": "codex-firefox-bridge-current-chatgpt",
        "extensionBuildChannels": ["prod"],
        "extensionIds": [OFFICIAL_CHROME_EXTENSION_ID, FIREFOX_EXTENSION_ID],
        "installId": "codex-firefox-bridge-current-chatgpt",
        "nativeHostNames": [HOST_NAME],
        "nativeHostProtocolVersion": 2,
        "nativeHostVersion": "0.1.0",
        "paths": {
            "browserClientPath": runtime.browser_client,
            "codexCliPath": runtime.codex_cli,
            "codexHome": codex_home,
            "extensionHostPath": host_path,
            "nodePath": runtime.node,
            "nodeReplPath": runtime.node_repl,
            "resourcesPath": resources
        },
        "proxyHost": "127.0.0.1",
        "proxyPort": 0,
        "updatedAt": updated_at
    })
}

fn bundled_plugin_version(resources: &Path) -> Option<String> {
    let path = resources.join("plugins/openai-bundled/plugins/chrome/.codex-plugin/plugin.json");
    let value: Value = serde_json::from_slice(&fs::read(path).ok()?).ok()?;
    value.get("version")?.as_str().map(ToOwned::to_owned)
}

fn codex_cli_version(codex_cli: &Path) -> Option<String> {
    codex_cli_version_with_timeout(codex_cli, CODEX_VERSION_TIMEOUT)
}

fn codex_cli_version_with_timeout(codex_cli: &Path, timeout: Duration) -> Option<String> {
    let mut stdout = tempfile::tempfile().ok()?;
    let child_stdout = stdout.try_clone().ok()?;
    let mut child = Command::new(codex_cli)
        .arg("--version")
        .stdout(Stdio::from(child_stdout))
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let deadline = Instant::now() + timeout;
    let status = loop {
        if let Some(status) = child.try_wait().ok()? {
            break status;
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return None;
        }
        thread::sleep(Duration::from_millis(10));
    };
    if !status.success() {
        return None;
    }
    stdout.seek(SeekFrom::Start(0)).ok()?;
    let mut output = String::new();
    stdout.read_to_string(&mut output).ok()?;
    let version = output.trim();
    Some(
        version
            .strip_prefix("codex-cli ")
            .unwrap_or(version)
            .to_owned(),
    )
}

fn current_timestamp() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    format!("unix-{seconds}")
}

fn forward_stdin(mut output: ChildStdin) {
    let mut input = io::stdin().lock();
    loop {
        let mut header = [0_u8; 4];
        match read_exact_or_eof(&mut input, &mut header) {
            Ok(false) => return,
            Ok(true) => {}
            Err(error) => {
                eprintln!("[codex-firefox-bridge] native input header read failed: {error}");
                return;
            }
        }
        let length = u32::from_le_bytes(header) as usize;
        if length > MAX_NATIVE_MESSAGE_BYTES {
            eprintln!("[codex-firefox-bridge] native input message is too large: {length}");
            return;
        }
        let mut payload = vec![0_u8; length];
        if let Err(error) = input.read_exact(&mut payload) {
            eprintln!("[codex-firefox-bridge] native input payload read failed: {error}");
            return;
        }
        let rewritten = rewrite_native_request(payload);
        let rewritten_header = (rewritten.len() as u32).to_le_bytes();
        if output
            .write_all(&rewritten_header)
            .and_then(|_| output.write_all(&rewritten))
            .and_then(|_| output.flush())
            .is_err()
        {
            return;
        }
    }
}

fn rewrite_native_request(payload: Vec<u8>) -> Vec<u8> {
    let Ok(mut value) = serde_json::from_slice::<Value>(&payload) else {
        return payload;
    };
    if !rewrite_firefox_extension_id(&mut value) {
        return payload;
    }
    serde_json::to_vec(&value).unwrap_or(payload)
}

fn rewrite_firefox_extension_id(value: &mut Value) -> bool {
    let mut changed = false;
    match value {
        Value::String(text) => {
            if text == FIREFOX_EXTENSION_ID {
                *text = OFFICIAL_CHROME_EXTENSION_ID.into();
                changed = true;
            }
        }
        Value::Object(object) => {
            for (key, child) in object.iter_mut() {
                if key == "geckoExtensionId" {
                    continue;
                }
                changed |= rewrite_firefox_extension_id(child);
            }
        }
        Value::Array(array) => {
            for child in array {
                changed |= rewrite_firefox_extension_id(child);
            }
        }
        _ => {}
    }
    changed
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
    let changed = enrich_bridge_version(&mut value)
        | enrich_commands(&mut value)
        | rewrite_websocket_urls(&mut value, relay_port, upstream_port);
    if !changed {
        return payload;
    }
    serde_json::to_vec(&value).unwrap_or(payload)
}

fn enrich_bridge_version(value: &mut Value) -> bool {
    let Value::Object(message) = value else {
        return false;
    };
    if message.get("method").and_then(Value::as_str) != Some("getInfo") {
        return false;
    }
    message.insert(
        "_firefoxBridgeVersion".into(),
        Value::String(env!("CARGO_PKG_VERSION").into()),
    );
    true
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
                format!(
                    "Origin: {}\r\n",
                    OFFICIAL_CHROME_ORIGIN.trim_end_matches('/')
                )
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
        candidates.extend(linux_chrome_native_host_manifests(&home));
    }
    candidates
}

fn linux_chrome_native_host_manifests(home: &Path) -> Vec<PathBuf> {
    [
        ".config/google-chrome/NativeMessagingHosts",
        ".config/google-chrome-beta/NativeMessagingHosts",
        ".config/google-chrome-unstable/NativeMessagingHosts",
        ".config/chromium/NativeMessagingHosts",
        ".config/BraveSoftware/Brave-Browser/NativeMessagingHosts",
        ".config/microsoft-edge/NativeMessagingHosts",
        ".var/app/com.google.Chrome/config/google-chrome/NativeMessagingHosts",
        ".var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser/NativeMessagingHosts",
    ]
    .into_iter()
    .map(|directory| home.join(directory).join(format!("{HOST_NAME}.json")))
    .collect()
}

fn bundled_host_candidates() -> Vec<PathBuf> {
    let Some(home) =
        env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
    else {
        return Vec::new();
    };
    let platform = current_platform();
    let architecture = if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x64"
    };
    let mut candidates = bundled_host_candidates_for(&home, platform, architecture);
    for resources in chatgpt_resource_candidates_for(platform, Some(&home)) {
        candidates.extend(bundled_app_host_candidates_for(
            &resources,
            platform,
            architecture,
        ));
    }
    candidates
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

fn bundled_app_host_candidates_for(
    resources: &Path,
    platform: &str,
    architecture: &str,
) -> Vec<PathBuf> {
    let base = resources.join("plugins/openai-bundled/plugins/chrome/extension-host");
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
    fn reports_the_native_bridge_version_during_the_extension_handshake() {
        let payload = serde_json::to_vec(&json!({
            "jsonrpc": "2.0",
            "id": "bridge-info",
            "method": "getInfo"
        }))
        .unwrap();
        let upstream = AtomicU16::new(0);
        let enriched: Value =
            serde_json::from_slice(&enrich_native_message(payload, 54321, &upstream)).unwrap();
        assert_eq!(enriched["_firefoxBridgeVersion"], env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn presents_firefox_requests_as_the_official_chrome_extension() {
        let payload = serde_json::to_vec(&json!({
            "jsonrpc": "2.0",
            "method": "codexRuntime/ensure",
            "params": {
                "constraints": {
                    "extensionId": FIREFOX_EXTENSION_ID
                }
            }
        }))
        .unwrap();
        let rewritten: Value = serde_json::from_slice(&rewrite_native_request(payload)).unwrap();
        assert_eq!(
            rewritten["params"]["constraints"]["extensionId"],
            OFFICIAL_CHROME_EXTENSION_ID
        );
    }

    #[test]
    fn preserves_the_real_gecko_id_in_bridge_metadata() {
        let payload = serde_json::to_vec(&json!({
            "jsonrpc": "2.0",
            "id": "bridge-info",
            "result": {
                "metadata": {
                    "extensionId": FIREFOX_EXTENSION_ID,
                    "geckoExtensionId": FIREFOX_EXTENSION_ID
                }
            }
        }))
        .unwrap();
        let rewritten: Value = serde_json::from_slice(&rewrite_native_request(payload)).unwrap();
        assert_eq!(
            rewritten["result"]["metadata"]["extensionId"],
            OFFICIAL_CHROME_EXTENSION_ID
        );
        assert_eq!(
            rewritten["result"]["metadata"]["geckoExtensionId"],
            FIREFOX_EXTENSION_ID
        );
    }

    #[test]
    fn rewrites_websocket_origin_and_host() {
        let request = "GET / HTTP/1.1\r\nHost: 127.0.0.1:1\r\nOrigin: moz-extension://abc\r\n\r\n";
        let rewritten = rewrite_websocket_request(request, 45678);
        assert!(rewritten.contains("Host: 127.0.0.1:45678\r\n"));
        assert!(
            rewritten.contains("Origin: chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg\r\n")
        );
    }

    #[test]
    fn uses_the_official_macos_host_layout() {
        let paths = bundled_host_candidates_for(Path::new("/Users/test"), "macos", "arm64");
        assert_eq!(
            paths[0],
            Path::new("/Users/test/.codex/plugins/cache/openai-bundled/chrome/latest/extension-host/macos/arm64/ChatGPT for Chrome")
        );
    }

    #[test]
    fn uses_the_official_linux_host_layout() {
        let paths = bundled_host_candidates_for(Path::new("/home/test"), "linux", "x64");
        assert_eq!(
            paths[0],
            Path::new("/home/test/.codex/plugins/cache/openai-bundled/chrome/latest/extension-host/linux/x64/extension-host")
        );
    }

    #[test]
    fn discovers_linux_chatgpt_app_resources() {
        let paths = chatgpt_resource_candidates_for("linux", Some(Path::new("/home/test")));
        assert!(paths.contains(&PathBuf::from("/usr/lib/chatgpt/resources")));
        assert!(paths.contains(&PathBuf::from(
            "/home/test/.local/opt/chatgpt/resources"
        )));
        assert!(paths.contains(&PathBuf::from(
            "/home/test/.local/share/chatgpt/resources"
        )));
    }

    #[test]
    fn discovers_linux_chatgpt_bundled_extension_host() {
        let paths = bundled_app_host_candidates_for(
            Path::new("/usr/lib/chatgpt/resources"),
            "linux",
            "x64",
        );
        assert_eq!(
            paths[0],
            Path::new("/usr/lib/chatgpt/resources/plugins/openai-bundled/plugins/chrome/extension-host/linux/x64/extension-host")
        );
    }

    #[test]
    fn discovers_linux_chrome_native_host_manifests() {
        let paths = linux_chrome_native_host_manifests(Path::new("/home/test"));
        assert!(paths.contains(&PathBuf::from(
            "/home/test/.config/google-chrome/NativeMessagingHosts/com.openai.codexextension.json"
        )));
        assert!(paths.contains(&PathBuf::from(
            "/home/test/.var/app/com.google.Chrome/config/google-chrome/NativeMessagingHosts/com.openai.codexextension.json"
        )));
    }

    #[test]
    fn discovers_a_complete_bundled_app_server_runtime() {
        let directory = tempfile::tempdir().unwrap();
        let temp = directory.path();
        let browser_client =
            temp.join("plugins/openai-bundled/plugins/chrome/scripts/browser-client.mjs");
        for path in [
            temp.join("codex"),
            temp.join("cua_node/bin/node"),
            temp.join("cua_node/bin/node_repl"),
            browser_client.clone(),
        ] {
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, "").unwrap();
        }

        assert_eq!(
            app_server_runtime_from_resources(temp),
            Some(AppServerRuntime {
                codex_cli: temp.join("codex"),
                node: temp.join("cua_node/bin/node"),
                browser_client,
                node_repl: temp.join("cua_node/bin/node_repl"),
            })
        );
    }

    #[test]
    fn rejects_an_incomplete_bundled_app_server_runtime() {
        let missing = env::temp_dir().join("codex-firefox-missing-runtime");
        assert_eq!(app_server_runtime_from_resources(&missing), None);
    }

    #[test]
    fn creates_a_v2_fallback_registry_entry_for_firefox() {
        let runtime = AppServerRuntime {
            codex_cli: PathBuf::from("/Applications/ChatGPT.app/Contents/Resources/codex"),
            node: PathBuf::from("/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node"),
            browser_client: PathBuf::from(
                "/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/chrome/scripts/browser-client.mjs",
            ),
            node_repl: PathBuf::from(
                "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl",
            ),
        };
        let entry = fallback_registry_entry(
            Path::new("/native/ChatGPT for Chrome"),
            &runtime,
            Path::new("/Users/test/.codex"),
            "26.727.51351",
            "0.146.0-alpha.9.2",
            "test-time",
        );
        assert_eq!(entry["schemaVersion"], 2);
        assert_eq!(entry["appServerProtocolVersion"], 2);
        assert_eq!(entry["extensionIds"][1], FIREFOX_EXTENSION_ID);
        assert_eq!(
            entry["paths"]["codexCliPath"].as_str(),
            runtime.codex_cli.to_str()
        );
        assert_eq!(entry["paths"]["codexHome"], "/Users/test/.codex");
    }

    #[test]
    fn fallback_home_mirrors_login_state_but_owns_its_registry() {
        let source = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        fs::write(source.path().join("auth.json"), "authenticated").unwrap();
        fs::write(
            source.path().join("chrome-native-hosts-v2.json"),
            "real registry",
        )
        .unwrap();
        mirror_codex_home(source.path(), target.path()).unwrap();
        assert_eq!(
            fs::read_to_string(target.path().join("auth.json")).unwrap(),
            "authenticated"
        );
        assert!(!target.path().join("chrome-native-hosts-v2.json").exists());
    }

    #[test]
    fn detects_nonempty_v2_registries() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let path = file.path();
        fs::write(path, r#"{"schemaVersion":2,"entries":[]}"#).unwrap();
        assert!(!registry_has_entries(path));
        fs::write(
            path,
            r#"{"schemaVersion":2,"entries":[{"entryId":"test"}]}"#,
        )
        .unwrap();
        assert!(registry_has_entries(path));
    }
}
