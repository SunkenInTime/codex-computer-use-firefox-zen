import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "chatgpt-firefox-native-test-"));
const upload = path.join(temp, "firefox-upload.txt");
const isWindows = process.platform === "win32";
const outputLimit = 1024 * 1024;
const lingeringHostMilliseconds = 3000;
const supervisorTerminationMaximumMilliseconds = 1500;
const smallUploadContents = "Firefox file upload parity\n";
const bridgeVersion = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).version;
const enrichmentBytes = Buffer.byteLength(`,"_firefoxBridgeVersion":"${bridgeVersion}"`, "utf8");
const firefoxExtensionId = "codex-computer-use-firefox-zen@sunkenintime";
const chromeExtensionId = "hehggadaopoacecdllhhajmbjkdcmajg";
const selectedCase = process.env.CHATGPT_FIREFOX_TEST_CASE;
const cargoCandidates = [
  process.env.CARGO,
  path.join(os.homedir(), ".cargo", "bin", isWindows ? "cargo.exe" : "cargo"),
  "cargo"
].filter(Boolean);

function requireWindowsDotNetFramework45() {
  const releaseKey = "HKLM\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full";
  const query = spawnSync("reg", ["query", releaseKey, "/v", "Release"], { encoding: "utf8" });
  const output = `${query.stdout ?? ""}${query.stderr ?? ""}`;
  assert.equal(
    query.status,
    0,
    `.NET Framework 4.5+ is required to compile the Windows native-host fixture (Release >= 378389). reg query failed: ${output}`
  );
  const match = output.match(/Release\s+REG_DWORD\s+(0x[\da-f]+|\d+)/i);
  assert.ok(
    match,
    `.NET Framework 4.5+ is required to compile the Windows native-host fixture (Release >= 378389). The Release registry value was not found.`
  );
  const release = Number.parseInt(match[1], /^0x/i.test(match[1]) ? 16 : 10);
  assert.ok(
    release >= 378389,
    `.NET Framework 4.5+ is required to compile the Windows native-host fixture (Release >= 378389). Found Release ${release}.`
  );
}

function base64EncodedLength(byteLength) {
  return 4 * Math.ceil(byteLength / 3);
}

function rustWindowsExtendedLengthPath(canonicalPath) {
  if (canonicalPath.startsWith("\\\\?\\")) {
    return canonicalPath;
  }
  if (canonicalPath.startsWith("\\\\")) {
    return `\\\\?\\UNC\\${canonicalPath.slice(2)}`;
  }
  if (/^[a-z]:[\\/]/i.test(canonicalPath)) {
    return `\\\\?\\${canonicalPath.replaceAll("/", "\\")}`;
  }
  return canonicalPath;
}

function rustCanonicalPath(file) {
  const canonicalPath = fs.realpathSync(file);
  return isWindows ? rustWindowsExtendedLengthPath(canonicalPath) : canonicalPath;
}

function assertWindowsCanonicalPathOracle() {
  assert.equal(
    rustWindowsExtendedLengthPath("C:\\native\\fixture.txt"),
    "\\\\?\\C:\\native\\fixture.txt"
  );
  assert.equal(
    rustWindowsExtendedLengthPath("\\\\server\\share\\fixture.txt"),
    "\\\\?\\UNC\\server\\share\\fixture.txt"
  );
}

function projectedOversizedFileUploadLength(file) {
  const metadata = fs.statSync(file);
  const projected = {
    method: "DOM.setFileInputFiles",
    params: {
      files: [file],
      _firefoxFilePayloads: [{
        path: rustCanonicalPath(file),
        name: path.basename(file),
        type: "text/plain",
        lastModified: Math.floor(metadata.mtimeMs),
        data: "A".repeat(base64EncodedLength(metadata.size))
      }]
    }
  };
  return Buffer.byteLength(JSON.stringify(projected), "utf8");
}

function createFixture() {
  if (isWindows) {
    requireWindowsDotNetFramework45();
    assertWindowsCanonicalPathOracle();
    const csc = path.join(process.env.WINDIR, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
    const fixture = path.join(temp, "fixture.exe");
    const compilation = spawnSync(csc, [
      "/nologo",
      "/target:exe",
      "/optimize+",
      `/out:${fixture}`,
      path.join(root, "tests", "NativeHostFixture.cs")
    ], { encoding: "utf8" });
    assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);
    return fixture;
  }

  const fixture = path.join(temp, "fixture");
  fs.writeFileSync(
    fixture,
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(root, "tests", "native-host-fixture.mjs"))} "$@"\n`,
    { mode: 0o755 }
  );
  return fixture;
}

function buildBridge() {
  const cargo = cargoCandidates.find((candidate) => {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    return result.status === 0;
  });
  assert.ok(cargo, "Cargo is required to build the cross-platform native bridge.");
  const build = spawnSync(cargo, [
    "build",
    "--locked",
    "--manifest-path",
    path.join(root, "native-host", "Cargo.toml")
  ], { encoding: "utf8", cwd: root });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  return path.join(
    root,
    "native-host",
    "target",
    "debug",
    isWindows ? "codex-firefox-bridge.exe" : "codex-firefox-bridge"
  );
}

function runBridge(proxy, fixture, mode, input = Buffer.alloc(0), environment = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(proxy, [], {
      env: {
        ...process.env,
        CHATGPT_FIREFOX_ORIGINAL_HOST: fixture,
        CHATGPT_FIREFOX_TEST_FILE: upload,
        CHATGPT_FIREFOX_FIXTURE_MODE: mode,
        ...environment
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    const outputMaximum = (2 * outputLimit) + 4096;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 10_000);
    child.stdout.on("data", (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > outputMaximum) {
        child.kill();
        reject(new Error("The bridge exceeded the bounded test output capture."));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (status, signal) => {
      clearTimeout(timer);
      resolve({
        durationMilliseconds: Date.now() - startedAt,
        signal,
        status,
        stderr: Buffer.concat(stderr),
        stdout: Buffer.concat(stdout),
        timedOut
      });
    });
    child.stdin.end(input);
  });
}

function readFrames(stdout) {
  const frames = [];
  let offset = 0;
  while (offset < stdout.length) {
    assert.ok(stdout.length - offset >= 4, "The native message header is truncated.");
    const length = stdout.readUInt32LE(offset);
    offset += 4;
    assert.ok(stdout.length - offset >= length, "The native message payload is truncated.");
    frames.push(JSON.parse(stdout.subarray(offset, offset + length).toString("utf8")));
    offset += length;
  }
  return frames;
}

function shouldRun(name) {
  return selectedCase == null || selectedCase === name;
}

function assertFatalBridgeRun(run) {
  assert.equal(run.signal, null, "A protocol violation must not crash or signal-terminate the bridge.");
  assert.equal(Number.isInteger(run.status), true, "A protocol violation must produce an integer bridge exit status.");
  assert.notEqual(run.status, 0, "A protocol violation must make the bridge exit nonzero.");
}

try {
  fs.writeFileSync(upload, smallUploadContents, "utf8");
  const fixture = createFixture();
  const proxy = buildBridge();

  if (shouldRun("file-upload")) {
    const run = await runBridge(proxy, fixture, "file-upload");
    assert.equal(run.status, 0, run.stderr?.toString("utf8"));
    const [message] = readFrames(run.stdout);
    assert.ok(message, "The native adapter returned no framed message.");
    const payloads = message.params.commandParams._firefoxFilePayloads;
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].name, "firefox-upload.txt");
    assert.equal(Buffer.from(payloads[0].data, "base64").toString("utf8"), smallUploadContents);
    const rewrittenUrl = new URL(message.appServerUrl);
    assert.equal(rewrittenUrl.hostname, "127.0.0.1");
    assert.notEqual(rewrittenUrl.port, "45678");
    assert.equal(rewrittenUrl.searchParams.get("token"), "test");
    const serializedResult = JSON.parse(message.serializedResult);
    const nestedUrl = new URL(serializedResult.localAppServerUrl);
    assert.equal(nestedUrl.hostname, "127.0.0.1");
    assert.equal(nestedUrl.port, rewrittenUrl.port);
    assert.equal(nestedUrl.searchParams.get("clientId"), "nested");
  }

  if (shouldRun("output-at-limit")) {
    const run = await runBridge(proxy, fixture, "output-at-limit");
    assert.equal(run.status, 0, run.stderr?.toString("utf8"));
    assert.ok(run.stdout.length >= 4, "The native adapter returned no framed message.");
    assert.equal(run.stdout.readUInt32LE(0), outputLimit);
    const [message] = readFrames(run.stdout);
    assert.equal(message.kind, "output-at-limit");
  }

  if (shouldRun("output-above-limit")) {
    const run = await runBridge(proxy, fixture, "output-above-limit");
    assertFatalBridgeRun(run);
    assert.equal(
      run.stderr.toString("utf8"),
      `[codex-firefox-bridge] native output message is too large: ${outputLimit + 1}\n`
    );
    assert.equal(run.stdout.length, 0, "An oversized host message must not be emitted to Firefox.");
  }

  if (shouldRun("output-above-limit-then-normal")) {
    const run = await runBridge(proxy, fixture, "output-above-limit-then-normal");
    assertFatalBridgeRun(run);
    assert.equal(
      run.stderr.toString("utf8"),
      `[codex-firefox-bridge] native output message is too large: ${outputLimit + 1}\n`
    );
    assert.equal(run.stdout.length, 0, "The frame after an oversized host message must not reach Firefox.");
  }

  if (shouldRun("output-above-limit-then-wait")) {
    const completionMarker = path.join(temp, "violating-host-completed");
    const run = await runBridge(proxy, fixture, "output-above-limit-then-wait", Buffer.alloc(0), {
      CHATGPT_FIREFOX_FIXTURE_COMPLETION_MARKER: completionMarker
    });
    assert.equal(run.timedOut, false, "The test harness deadline terminated the bridge instead of its supervisor.");
    assert.ok(
      run.durationMilliseconds < supervisorTerminationMaximumMilliseconds,
      `The bridge waited ${run.durationMilliseconds}ms for an oversized-message host that remains alive for ${lingeringHostMilliseconds}ms.`
    );
    assertFatalBridgeRun(run);
    assert.equal(
      run.stderr.toString("utf8"),
      `[codex-firefox-bridge] native output message is too large: ${outputLimit + 1}\n`
    );
    assert.equal(run.stdout.length, 0, "The violating host must not emit data to Firefox.");
    await new Promise((resolve) => setTimeout(resolve, lingeringHostMilliseconds + 250));
    assert.equal(fs.existsSync(completionMarker), false, "The violating host survived the bridge after its termination deadline.");
  }

  if (shouldRun("output-above-limit-header-then-wait")) {
    const completionMarker = path.join(temp, "header-only-violating-host-completed");
    const run = await runBridge(proxy, fixture, "output-above-limit-header-then-wait", Buffer.alloc(0), {
      CHATGPT_FIREFOX_FIXTURE_COMPLETION_MARKER: completionMarker
    });
    assert.equal(run.timedOut, false, "The test harness deadline terminated the bridge instead of its supervisor.");
    assert.ok(
      run.durationMilliseconds < supervisorTerminationMaximumMilliseconds,
      `The bridge waited ${run.durationMilliseconds}ms for a host that declared an oversized message but withheld its payload for ${lingeringHostMilliseconds}ms.`
    );
    assertFatalBridgeRun(run);
    assert.equal(
      run.stderr.toString("utf8"),
      `[codex-firefox-bridge] native output message is too large: ${outputLimit + 1}\n`
    );
    assert.equal(run.stdout.length, 0, "A header-only oversized message must not emit data to Firefox.");
    await new Promise((resolve) => setTimeout(resolve, lingeringHostMilliseconds + 250));
    assert.equal(fs.existsSync(completionMarker), false, "The header-only violating host survived the bridge after its termination deadline.");
  }

  if (shouldRun("output-above-limit-header-then-stderr-descendant")) {
    const completionMarker = path.join(temp, "stderr-descendant-completed");
    const run = await runBridge(proxy, fixture, "output-above-limit-header-then-stderr-descendant", Buffer.alloc(0), {
      CHATGPT_FIREFOX_FIXTURE_COMPLETION_MARKER: completionMarker
    });
    assert.equal(run.timedOut, false, "The test harness deadline terminated the bridge instead of its supervisor.");
    assert.ok(
      run.durationMilliseconds < supervisorTerminationMaximumMilliseconds,
      `The bridge waited ${run.durationMilliseconds}ms for a violating host descendant that retained stderr for ${lingeringHostMilliseconds}ms.`
    );
    assertFatalBridgeRun(run);
    assert.equal(
      run.stderr.toString("utf8"),
      `[codex-firefox-bridge] native output message is too large: ${outputLimit + 1}\n`
    );
    assert.equal(run.stdout.length, 0, "A violating host with a stderr-retaining descendant must not emit data to Firefox.");
    await new Promise((resolve) => setTimeout(resolve, lingeringHostMilliseconds + 250));
    assert.equal(
      fs.existsSync(completionMarker),
      true,
      "The fixture descendant did not remain alive long enough to retain the inherited stderr pipe beyond the bridge deadline."
    );
  }

  if (shouldRun("enrichment-overflow")) {
    const run = await runBridge(proxy, fixture, "enrichment-overflow");
    assertFatalBridgeRun(run);
    assert.equal(
      run.stderr.toString("utf8"),
      `[codex-firefox-bridge] native output message is too large: ${outputLimit + enrichmentBytes}\n`
    );
    assert.equal(run.stdout.length, 0, "Enrichment must not make an oversized message reach Firefox.");
  }

  if (shouldRun("oversized-file-upload")) {
    try {
      fs.writeFileSync(upload, Buffer.alloc(786_432, "x"));
      const projectedLength = projectedOversizedFileUploadLength(upload);
      assert.ok(projectedLength > outputLimit, "The oversized fixture must exceed Firefox's native-message limit after enrichment.");
      const run = await runBridge(proxy, fixture, "oversized-file-upload");
      assert.equal(run.timedOut, false, "The test harness deadline terminated the bridge instead of a fatal enrichment rejection.");
      assertFatalBridgeRun(run);
      assert.equal(
        run.stderr.toString("utf8"),
        `[codex-firefox-bridge] native output message is too large: ${projectedLength}\n`
      );
      assert.equal(run.stdout.length, 0, "An oversized file upload must not emit a Firefox native-message frame.");
    } finally {
      fs.writeFileSync(upload, smallUploadContents, "utf8");
    }
  }

  if (shouldRun("truncated-input")) {
    const declaredLength = 32;
    const input = Buffer.alloc(4 + 2);
    input.writeUInt32LE(declaredLength, 0);
    input.write("{}", 4, "utf8");
    const run = await runBridge(proxy, fixture, "verify-truncated-input", input);
    assert.equal(run.status, 0, run.stderr?.toString("utf8"));
    const [message] = readFrames(run.stdout);
    assert.deepEqual(message, { kind: "truncated-input-not-forwarded" });
  }

  if (shouldRun("firefox-extension-id-rewrite")) {
    const request = {
      extensionId: firefoxExtensionId,
      metadata: {
        extensionId: firefoxExtensionId,
        geckoExtensionId: firefoxExtensionId
      },
      params: {
        extensionId: firefoxExtensionId
      }
    };
    const payload = Buffer.from(JSON.stringify(request), "utf8");
    const input = Buffer.alloc(payload.length + 4);
    input.writeUInt32LE(payload.length, 0);
    payload.copy(input, 4);
    const run = await runBridge(proxy, fixture, "echo-input", input);
    assert.equal(run.status, 0, run.stderr?.toString("utf8"));
    const [message] = readFrames(run.stdout);
    assert.equal(message.extensionId, chromeExtensionId);
    assert.equal(message.metadata.extensionId, chromeExtensionId);
    assert.equal(message.params.extensionId, chromeExtensionId);
    assert.equal(message.metadata.geckoExtensionId, firefoxExtensionId);
  }

  if (shouldRun("input-above-output-limit")) {
    const payload = Buffer.alloc(outputLimit + 1, "i");
    const input = Buffer.alloc(payload.length + 4);
    input.writeUInt32LE(payload.length, 0);
    payload.copy(input, 4);
    const run = await runBridge(proxy, fixture, "verify-large-input", input);
    assert.equal(run.status, 0, run.stderr?.toString("utf8"));
    const [message] = readFrames(run.stdout);
    assert.deepEqual(message, {
      kind: "large-input-received",
      receivedLength: input.length
    });
  }

  console.log(JSON.stringify({ ok: true, nativeMessaging: true, selectedCase: selectedCase ?? "all" }, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
