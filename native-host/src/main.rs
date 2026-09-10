use base64::Engine;
use regex::{Captures, Regex};
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{ChildStderr, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::{mpsc, Arc, OnceLock};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tempfile::TempDir;

const HOST_NAME: &str = "com.openai.codexextension";
const OFFICIAL_CHROME_ORIGIN: &str = "chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/";
const OFFICIAL_CHROME_EXTENSION_ID: &str = "hehggadaopoacecdllhhajmbjkdcmajg";
const FIREFOX_EXTENSION_ID: &str = "codex-computer-use-firefox-zen@sunkenintime";
const MAX_NATIVE_INPUT_MESSAGE_BYTES: usize = 1024 * 1024 * 1024;
const MAX_NATIVE_OUTPUT_MESSAGE_BYTES: usize = 1024 * 1024;
const CODEX_VERSION_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Debug, PartialEq)]
struct AppServerRuntime {
    codex_cli: PathBuf,
    node: PathBuf,
    browser_client: PathBuf,
    node_repl: PathBuf,
}

#[derive(Clone, Debug, PartialEq)]
enum NativeOutputOutcome {
    CleanEof,
    Fatal(Option<String>),
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
    let fatal_output = Arc::new(AtomicBool::new(false));
    let (output_outcome_tx, output_outcome_rx) = mpsc::channel();
    let output_fatal_state = Arc::clone(&fatal_output);
    let output_thread = thread::spawn(move || {
        let outcome =
            forward_native_messages(child_stdout, relay_port, upstream_port, output_fatal_state);
        let _ = output_outcome_tx.send(outcome.clone());
        outcome
    });
    let error_thread = thread::spawn(move || forward_stderr(child_stderr, fatal_output));

    let mut observed_output_outcome = None;
    let status = loop {
        if observed_output_outcome.is_none() {
            match output_outcome_rx.try_recv() {
                Ok(outcome @ NativeOutputOutcome::Fatal(_)) => {
                    observed_output_outcome = Some(outcome);
                    let _ = child.kill();
                    break child.wait()?;
                }
                Ok(NativeOutputOutcome::CleanEof) => {
                    observed_output_outcome = Some(NativeOutputOutcome::CleanEof);
                }
                Err(mpsc::TryRecvError::Empty) => {}
                Err(mpsc::TryRecvError::Disconnected) => {
                    observed_output_outcome = Some(NativeOutputOutcome::Fatal(None));
                    let _ = child.kill();
                    break child.wait()?;
                }
            }
        }
        if let Some(status) = child.try_wait()? {
            break status;
        }
        thread::sleep(Duration::from_millis(10));
    };
    let joined_output_outcome = output_thread
        .join()
        .unwrap_or(NativeOutputOutcome::Fatal(None));
    let fatal_diagnostic = match observed_output_outcome.as_ref() {
        Some(NativeOutputOutcome::Fatal(diagnostic)) => diagnostic.clone(),
        _ => match &joined_output_outcome {
            NativeOutputOutcome::Fatal(diagnostic) => diagnostic.clone(),
            NativeOutputOutcome::CleanEof => None,
        },
    };
    let fatal_output_observed =
        matches!(observed_output_outcome, Some(NativeOutputOutcome::Fatal(_)))
            || matches!(joined_output_outcome, NativeOutputOutcome::Fatal(_));
    if !fatal_output_observed {
        let _ = error_thread.join();
    }
    drop(input_thread);
    drop(fallback_registry);
    if fatal_output_observed {
        if let Some(diagnostic) = fatal_diagnostic {
            eprintln!("{diagnostic}");
        }
        return Ok(1);
    }
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
        if length > MAX_NATIVE_INPUT_MESSAGE_BYTES {
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

fn forward_stderr(mut input: ChildStderr, fatal_output: Arc<AtomicBool>) {
    let mut buffer = [0_u8; 8 * 1024];
    loop {
        let Ok(read) = input.read(&mut buffer) else {
            return;
        };
        if read == 0 {
            return;
        }
        if fatal_output.load(Ordering::Acquire) {
            return;
        }
        let mut output = io::stderr().lock();
        if fatal_output.load(Ordering::Acquire) {
            return;
        }
        if output
            .write_all(&buffer[..read])
            .and_then(|_| output.flush())
            .is_err()
        {
            return;
        }
    }
}

fn forward_native_messages(
    mut input: ChildStdout,
    relay_port: u16,
    upstream_port: Arc<AtomicU16>,
    fatal_output: Arc<AtomicBool>,
) -> NativeOutputOutcome {
    let mut output = io::stdout().lock();
    loop {
        let mut header = [0_u8; 4];
        match read_exact_or_eof(&mut input, &mut header) {
            Ok(false) => return NativeOutputOutcome::CleanEof,
            Ok(true) => {}
            Err(error) => {
                fatal_output.store(true, Ordering::Release);
                return NativeOutputOutcome::Fatal(Some(format!(
                    "[codex-firefox-bridge] native header read failed: {error}"
                )));
            }
        }

        let length = u32::from_le_bytes(header) as usize;
        if length > MAX_NATIVE_OUTPUT_MESSAGE_BYTES {
            fatal_output.store(true, Ordering::Release);
            return NativeOutputOutcome::Fatal(Some(format!(
                "[codex-firefox-bridge] native output message is too large: {length}"
            )));
        }
        let mut payload = vec![0_u8; length];
        if let Err(error) = input.read_exact(&mut payload) {
            fatal_output.store(true, Ordering::Release);
            return NativeOutputOutcome::Fatal(Some(format!(
                "[codex-firefox-bridge] native payload read failed: {error}"
            )));
        }
        let enriched = match enrich_native_message(payload, relay_port, &upstream_port) {
            Ok(enriched) => enriched,
            Err(projected_length) => {
                fatal_output.store(true, Ordering::Release);
                return NativeOutputOutcome::Fatal(Some(format!(
                    "[codex-firefox-bridge] native output message is too large: {projected_length}"
                )));
            }
        };
        if enriched.len() > MAX_NATIVE_OUTPUT_MESSAGE_BYTES {
            fatal_output.store(true, Ordering::Release);
            return NativeOutputOutcome::Fatal(Some(format!(
                "[codex-firefox-bridge] native output message is too large: {}",
                enriched.len()
            )));
        }
        let output_header = (enriched.len() as u32).to_le_bytes();
        if output
            .write_all(&output_header)
            .and_then(|_| output.write_all(&enriched))
            .and_then(|_| output.flush())
            .is_err()
        {
            fatal_output.store(true, Ordering::Release);
            return NativeOutputOutcome::Fatal(None);
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

fn enrich_native_message(
    payload: Vec<u8>,
    relay_port: u16,
    upstream_port: &AtomicU16,
) -> Result<Vec<u8>, u128> {
    enrich_native_message_with_pre_read_hook(payload, relay_port, upstream_port, || {})
}

fn enrich_native_message_with_pre_read_hook(
    payload: Vec<u8>,
    relay_port: u16,
    upstream_port: &AtomicU16,
    pre_read_hook: impl FnOnce(),
) -> Result<Vec<u8>, u128> {
    let Ok(mut value) = serde_json::from_slice::<Value>(&payload) else {
        return Ok(payload);
    };
    let mut pending_files = Vec::new();
    let changed = enrich_bridge_version(&mut value)
        | enrich_commands(&mut value, &mut pending_files)
        | rewrite_websocket_urls(&mut value, relay_port, upstream_port);
    if !changed {
        return Ok(payload);
    }

    let projected_without_file_data =
        serde_json::to_vec(&value).unwrap_or_else(|_| payload.clone());
    let projected_length = pending_files.iter().fold(
        projected_without_file_data.len() as u128,
        |length, pending| length + base64_encoded_length(pending.byte_len),
    );
    if projected_length > MAX_NATIVE_OUTPUT_MESSAGE_BYTES as u128 {
        return Err(projected_length);
    }

    pre_read_hook();
    let mut encoded_files = Vec::with_capacity(pending_files.len());
    for pending in pending_files {
        let byte_len = usize::try_from(pending.byte_len)
            .expect("a preflight-approved file length must fit in usize");
        let mut data = Vec::with_capacity(byte_len);
        let read = open_regular_file(&pending.path)
            .ok_or_else(|| io::Error::other("upload path is not a readable regular file"))
            .and_then(|file| file.take(pending.byte_len).read_to_end(&mut data));
        if read.is_err() {
            encoded_files.push(None);
            continue;
        }
        encoded_files.push(Some(base64::engine::general_purpose::STANDARD.encode(data)));
    }
    apply_file_payload_data(&mut value, &mut encoded_files.into_iter());

    let enriched = serde_json::to_vec(&value).unwrap_or(payload);
    if enriched.len() > MAX_NATIVE_OUTPUT_MESSAGE_BYTES {
        return Err(enriched.len() as u128);
    }
    Ok(enriched)
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

struct PendingFilePayload {
    path: PathBuf,
    byte_len: u64,
}

fn base64_encoded_length(byte_len: u64) -> u128 {
    u128::from(byte_len).div_ceil(3) * 4
}

fn enrich_commands(value: &mut Value, pending_files: &mut Vec<PendingFilePayload>) -> bool {
    let mut changed = false;
    match value {
        Value::Object(object) => {
            if object.get("method").and_then(Value::as_str) == Some("DOM.setFileInputFiles") {
                for key in ["commandParams", "params"] {
                    let Some(Value::Object(parameters)) = object.get_mut(key) else {
                        continue;
                    };
                    changed |= parameters.remove("_firefoxFilePayloads").is_some();
                }
                for key in ["commandParams", "params"] {
                    let Some(Value::Object(parameters)) = object.get_mut(key) else {
                        continue;
                    };
                    let Some(Value::Array(files)) = parameters.get("files") else {
                        continue;
                    };
                    let mut payloads = Vec::new();
                    for path in files.iter().filter_map(Value::as_str) {
                        let Some((payload, pending)) = pending_file_payload(path) else {
                            continue;
                        };
                        payloads.push(payload);
                        pending_files.push(pending);
                    }
                    if !payloads.is_empty() {
                        parameters.insert("_firefoxFilePayloads".into(), Value::Array(payloads));
                        changed = true;
                    }
                    break;
                }
            }
            for child in object.values_mut() {
                changed |= enrich_commands(child, pending_files);
            }
        }
        Value::Array(array) => {
            for child in array {
                changed |= enrich_commands(child, pending_files);
            }
        }
        _ => {}
    }
    changed
}

fn pending_file_payload(path: &str) -> Option<(Value, PendingFilePayload)> {
    let source_path = Path::new(path);
    let path = source_path.canonicalize().ok()?;
    let file = open_regular_file(&path)?;
    let metadata = file.metadata().ok()?;
    let byte_len = metadata.len();
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);
    let payload = json!({
        "path": path.to_string_lossy(),
        "name": path.file_name()?.to_string_lossy(),
        "type": mime_type(path.extension().and_then(|value| value.to_str()).unwrap_or("")),
        "lastModified": modified,
        "data": ""
    });
    Some((payload, PendingFilePayload { path, byte_len }))
}

#[cfg(unix)]
fn open_regular_file(path: &Path) -> Option<fs::File> {
    use std::os::unix::fs::OpenOptionsExt;

    let file = fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NONBLOCK | libc::O_NOFOLLOW)
        .open(path)
        .ok()?;
    file.metadata().ok()?.is_file().then_some(file)
}

#[cfg(not(unix))]
fn open_regular_file(path: &Path) -> Option<fs::File> {
    let file = fs::File::open(path).ok()?;
    file.metadata().ok()?.is_file().then_some(file)
}

fn apply_file_payload_data(
    value: &mut Value,
    encoded_files: &mut impl Iterator<Item = Option<String>>,
) {
    match value {
        Value::Object(object) => {
            if object.get("method").and_then(Value::as_str) == Some("DOM.setFileInputFiles") {
                for key in ["commandParams", "params"] {
                    let Some(Value::Object(parameters)) = object.get_mut(key) else {
                        continue;
                    };
                    let Some(Value::Array(payloads)) = parameters.get_mut("_firefoxFilePayloads")
                    else {
                        continue;
                    };
                    payloads.retain_mut(|payload| {
                        let Some(encoded) = encoded_files.next().flatten() else {
                            return false;
                        };
                        payload["data"] = Value::String(encoded);
                        true
                    });
                    if payloads.is_empty() {
                        parameters.remove("_firefoxFilePayloads");
                    }
                    break;
                }
            }
            for child in object.values_mut() {
                apply_file_payload_data(child, encoded_files);
            }
        }
        Value::Array(array) => {
            for child in array {
                apply_file_payload_data(child, encoded_files);
            }
        }
        _ => {}
    }
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

    fn file_input_message(paths: &[&Path]) -> Vec<u8> {
        serde_json::to_vec(&json!({
            "jsonrpc": "2.0",
            "id": "file-input",
            "method": "DOM.setFileInputFiles",
            "params": {
                "files": paths
                    .iter()
                    .map(|path| path.to_string_lossy().into_owned())
                    .collect::<Vec<_>>(),
            }
        }))
        .unwrap()
    }

    fn expected_file_payload(path: &Path) -> Value {
        let metadata = fs::metadata(path).unwrap();
        let modified = metadata
            .modified()
            .unwrap()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        json!({
            "path": path.canonicalize().unwrap().to_string_lossy(),
            "name": path.file_name().unwrap().to_string_lossy(),
            "type": "text/plain",
            "lastModified": modified,
            "data": base64::engine::general_purpose::STANDARD.encode(fs::read(path).unwrap()),
        })
    }

    fn expected_enriched_file_input(paths: &[&Path]) -> Vec<u8> {
        let mut value: Value = serde_json::from_slice(&file_input_message(paths)).unwrap();
        value["params"]["_firefoxFilePayloads"] = Value::Array(
            paths
                .iter()
                .map(|path| expected_file_payload(path))
                .collect(),
        );
        serde_json::to_vec(&value).unwrap()
    }

    #[test]
    fn rejects_an_oversized_file_upload_with_the_exact_projected_output_length() {
        let directory = tempfile::tempdir().unwrap();
        let file = directory.path().join("oversized.txt");
        fs::write(&file, vec![b'x'; 786_432]).unwrap();
        let payload = file_input_message(&[&file]);
        let projected_length = expected_enriched_file_input(&[&file]).len();
        assert!(projected_length > MAX_NATIVE_OUTPUT_MESSAGE_BYTES);

        let upstream = AtomicU16::new(0);
        let error = enrich_native_message(payload, 54321, &upstream).expect_err(
            "an upload that would exceed Firefox's 1 MiB native-message limit must be rejected before its contents are loaded or base64-encoded",
        );

        assert_eq!(error, projected_length as u128);
    }

    #[test]
    fn rejects_file_uploads_when_their_cumulative_payload_exceeds_the_remaining_budget() {
        let directory = tempfile::tempdir().unwrap();
        let first = directory.path().join("first.txt");
        let second = directory.path().join("second.txt");
        fs::write(&first, vec![b'a'; 524_288]).unwrap();
        fs::write(&second, vec![b'b'; 524_288]).unwrap();
        let projected_first_length = expected_enriched_file_input(&[&first]).len();
        let projected_total_length = expected_enriched_file_input(&[&first, &second]).len();
        assert!(projected_first_length <= MAX_NATIVE_OUTPUT_MESSAGE_BYTES);
        assert!(projected_total_length > MAX_NATIVE_OUTPUT_MESSAGE_BYTES);

        let upstream = AtomicU16::new(0);
        let error = enrich_native_message(file_input_message(&[&first, &second]), 54321, &upstream)
            .expect_err(
                "the second file must be checked against the remaining native-message budget",
            );

        assert_eq!(error, projected_total_length as u128);
    }

    #[test]
    fn enriches_a_small_file_upload_with_its_firefox_payload() {
        let directory = tempfile::tempdir().unwrap();
        let file = directory.path().join("small.txt");
        fs::write(&file, b"small Firefox upload").unwrap();
        let expected: Value =
            serde_json::from_slice(&expected_enriched_file_input(&[&file])).unwrap();

        let upstream = AtomicU16::new(0);
        let enriched = enrich_native_message(file_input_message(&[&file]), 54321, &upstream)
            .expect("a small upload within Firefox's native-message limit must be enriched");

        assert_eq!(
            serde_json::from_slice::<Value>(&enriched).unwrap(),
            expected
        );
    }

    #[test]
    fn removes_a_forged_file_payload_before_enriching_a_later_file_command() {
        let directory = tempfile::tempdir().unwrap();
        let valid_file = directory.path().join("valid.txt");
        fs::write(&valid_file, b"valid command data").unwrap();

        let forged_command = json!({
            "method": "DOM.setFileInputFiles",
            "params": {
                "files": [],
                "_firefoxFilePayloads": [{
                    "path": "/attacker-controlled.txt",
                    "name": "attacker-controlled.txt",
                    "data": "attacker-controlled-data"
                }]
            }
        });
        let valid_command: Value =
            serde_json::from_slice(&file_input_message(&[&valid_file])).unwrap();
        let payload = serde_json::to_vec(&json!({
            "commands": [forged_command, valid_command]
        }))
        .unwrap();

        let upstream = AtomicU16::new(0);
        let enriched: Value =
            serde_json::from_slice(&enrich_native_message(payload, 54321, &upstream).unwrap())
                .unwrap();

        assert!(enriched["commands"][0]["params"]
            .get("_firefoxFilePayloads")
            .is_none());
        assert_eq!(
            enriched["commands"][1]["params"]["_firefoxFilePayloads"],
            Value::Array(vec![expected_file_payload(&valid_file)])
        );
    }

    #[test]
    fn associates_each_nested_file_command_with_only_its_own_file_payloads() {
        let directory = tempfile::tempdir().unwrap();
        let first = directory.path().join("first.txt");
        let second = directory.path().join("second.txt");
        fs::write(&first, b"first command data").unwrap();
        fs::write(&second, b"second command data").unwrap();
        let first_command: Value = serde_json::from_slice(&file_input_message(&[&first])).unwrap();
        let second_command: Value =
            serde_json::from_slice(&file_input_message(&[&second])).unwrap();
        let payload = serde_json::to_vec(&json!({
            "responses": [
                first_command,
                { "nested": { "command": second_command } }
            ]
        }))
        .unwrap();

        let upstream = AtomicU16::new(0);
        let enriched: Value =
            serde_json::from_slice(&enrich_native_message(payload, 54321, &upstream).unwrap())
                .unwrap();

        assert_eq!(
            enriched["responses"][0]["params"]["_firefoxFilePayloads"],
            Value::Array(vec![expected_file_payload(&first)])
        );
        assert_eq!(
            enriched["responses"][1]["nested"]["command"]["params"]["_firefoxFilePayloads"],
            Value::Array(vec![expected_file_payload(&second)])
        );
    }

    #[test]
    fn enriches_many_small_file_uploads_without_losing_any_payload() {
        let directory = tempfile::tempdir().unwrap();
        let files: Vec<PathBuf> = (0..2048)
            .map(|index| {
                let file = directory.path().join(format!("small-{index}.txt"));
                fs::write(&file, b"x").unwrap();
                file
            })
            .collect();
        let references: Vec<&Path> = files.iter().map(PathBuf::as_path).collect();

        let upstream = AtomicU16::new(0);
        let enriched: Value = serde_json::from_slice(
            &enrich_native_message(file_input_message(&references), 54321, &upstream).unwrap(),
        )
        .unwrap();

        let payloads = enriched["params"]["_firefoxFilePayloads"]
            .as_array()
            .unwrap();
        assert_eq!(payloads.len(), files.len());
        for (payload, file) in payloads.iter().zip(&files) {
            assert_eq!(payload, &expected_file_payload(file));
        }
    }

    #[test]
    fn reads_only_the_metadata_time_file_length_after_the_pre_read_hook_grows_the_file() {
        let directory = tempfile::tempdir().unwrap();
        let file = directory.path().join("snapshot.txt");
        fs::write(&file, b"metadata-time contents").unwrap();
        let expected: Value =
            serde_json::from_slice(&expected_enriched_file_input(&[&file])).unwrap();
        let hook_runs = std::sync::atomic::AtomicUsize::new(0);
        let upstream = AtomicU16::new(0);

        let enriched = enrich_native_message_with_pre_read_hook(
            file_input_message(&[&file]),
            54321,
            &upstream,
            || {
                hook_runs.fetch_add(1, Ordering::SeqCst);
                let mut grown = fs::read(&file).unwrap();
                grown.extend(vec![b'g'; MAX_NATIVE_OUTPUT_MESSAGE_BYTES + 1]);
                fs::write(&file, grown).unwrap();
            },
        )
        .expect(
            "a file that grows after metadata capture must not fabricate a 1,048,577-byte overflow",
        );

        assert_eq!(hook_runs.load(Ordering::SeqCst), 1);
        assert_eq!(
            serde_json::from_slice::<Value>(&enriched).unwrap(),
            expected
        );
    }

    #[test]
    fn preserves_file_payload_named_application_data_outside_file_input_parameters() {
        let application_payload = json!({
            "source": "application",
            "items": [{ "id": "unrelated" }]
        });
        let nested_application_payload = json!(["unrelated", { "keep": true }]);
        let payload = serde_json::to_vec(&json!({
            "applicationState": {
                "_firefoxFilePayloads": application_payload,
                "nested": {
                    "_firefoxFilePayloads": nested_application_payload
                }
            },
            "command": {
                "method": "DOM.setFileInputFiles",
                "params": {
                    "files": [],
                    "_firefoxFilePayloads": [{ "forged": true }],
                    "applicationData": {
                        "_firefoxFilePayloads": { "keep": "this value" }
                    }
                }
            }
        }))
        .unwrap();

        let upstream = AtomicU16::new(0);
        let enriched: Value =
            serde_json::from_slice(&enrich_native_message(payload, 54321, &upstream).unwrap())
                .unwrap();

        assert_eq!(
            enriched["applicationState"]["_firefoxFilePayloads"],
            application_payload
        );
        assert_eq!(
            enriched["applicationState"]["nested"]["_firefoxFilePayloads"],
            nested_application_payload
        );
        assert_eq!(
            enriched["command"]["params"]["applicationData"]["_firefoxFilePayloads"],
            json!({ "keep": "this value" })
        );
        assert!(enriched["command"]["params"]
            .get("_firefoxFilePayloads")
            .is_none());
    }

    #[cfg(unix)]
    fn create_fifo(path: &Path) {
        let status = Command::new("mkfifo").arg(path).status().unwrap();
        assert!(status.success(), "mkfifo failed for {}", path.display());
    }

    #[cfg(unix)]
    #[test]
    fn skips_a_fifo_upload_without_blocking_enrichment() {
        let directory = tempfile::tempdir().unwrap();
        let fifo = directory.path().join("upload.fifo");
        create_fifo(&fifo);
        let payload = file_input_message(&[&fifo]);
        let (result_tx, result_rx) = mpsc::channel();
        let worker = thread::spawn(move || {
            let upstream = AtomicU16::new(0);
            result_tx
                .send(enrich_native_message(payload, 54321, &upstream))
                .unwrap();
        });

        let first_result = result_rx.recv_timeout(Duration::from_millis(250));
        let timed_out = matches!(first_result, Err(mpsc::RecvTimeoutError::Timeout));
        if timed_out {
            let writer = fs::OpenOptions::new().write(true).open(&fifo).unwrap();
            drop(writer);
        }
        let result = match first_result {
            Ok(result) => result,
            Err(mpsc::RecvTimeoutError::Timeout) => result_rx
                .recv_timeout(Duration::from_secs(1))
                .expect("FIFO cleanup did not release the blocked enrichment worker"),
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                panic!("the FIFO enrichment worker exited before reporting a result")
            }
        };
        worker.join().unwrap();

        assert!(
            !timed_out,
            "a FIFO reference must be rejected or omitted without waiting for a writer"
        );
        if let Ok(enriched) = result {
            let enriched: Value = serde_json::from_slice(&enriched).unwrap();
            assert!(enriched["params"].get("_firefoxFilePayloads").is_none());
        }
    }

    #[cfg(unix)]
    #[test]
    fn skips_a_regular_upload_replaced_with_a_fifo_before_the_read_phase_without_blocking() {
        let directory = tempfile::tempdir().unwrap();
        let file = directory.path().join("replaced.txt");
        fs::write(&file, b"metadata-time contents").unwrap();
        let payload = file_input_message(&[&file]);
        let replacement_path = file.clone();
        let cleanup_fifo = file.clone();
        let (hook_tx, hook_rx) = mpsc::channel();
        let (result_tx, result_rx) = mpsc::channel();
        let worker = thread::spawn(move || {
            let upstream = AtomicU16::new(0);
            let result =
                enrich_native_message_with_pre_read_hook(payload, 54321, &upstream, || {
                    fs::remove_file(&replacement_path).unwrap();
                    create_fifo(&replacement_path);
                    hook_tx.send(()).unwrap();
                });
            result_tx.send(result).unwrap();
        });

        hook_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("the pre-read hook did not replace the prepared regular file");
        let first_result = result_rx.recv_timeout(Duration::from_millis(250));
        let timed_out = matches!(first_result, Err(mpsc::RecvTimeoutError::Timeout));
        if timed_out {
            let writer = fs::OpenOptions::new()
                .write(true)
                .open(&cleanup_fifo)
                .unwrap();
            drop(writer);
        }
        let result = match first_result {
            Ok(result) => result,
            Err(mpsc::RecvTimeoutError::Timeout) => result_rx
                .recv_timeout(Duration::from_secs(1))
                .expect("FIFO cleanup did not release the replacement-file enrichment worker"),
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                panic!("the replacement-file enrichment worker exited before reporting a result")
            }
        };
        worker.join().unwrap();

        assert!(
            !timed_out,
            "a file replaced with a FIFO before reading must not wait for a writer"
        );
        if let Ok(enriched) = result {
            let enriched: Value = serde_json::from_slice(&enriched).unwrap();
            assert!(enriched["params"].get("_firefoxFilePayloads").is_none());
        }
    }

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
            serde_json::from_slice(&enrich_native_message(payload, 54321, &upstream).unwrap())
                .unwrap();
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
        assert!(paths.contains(&PathBuf::from("/home/test/.local/opt/chatgpt/resources")));
        assert!(paths.contains(&PathBuf::from("/home/test/.local/share/chatgpt/resources")));
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
