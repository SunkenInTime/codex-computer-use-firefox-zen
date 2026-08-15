import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "chatgpt-firefox-native-test-"));
const upload = path.join(temp, "firefox-upload.txt");
const isWindows = process.platform === "win32";
const cargoCandidates = [
  process.env.CARGO,
  path.join(os.homedir(), ".cargo", "bin", isWindows ? "cargo.exe" : "cargo"),
  "cargo"
].filter(Boolean);

function createFixture() {
  if (isWindows) {
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

try {
  fs.writeFileSync(upload, "Firefox file upload parity\n", "utf8");
  const fixture = createFixture();

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
  const proxy = path.join(
    root,
    "native-host",
    "target",
    "debug",
    isWindows ? "codex-firefox-bridge.exe" : "codex-firefox-bridge"
  );

  const run = spawnSync(proxy, [], {
    encoding: null,
    env: {
      ...process.env,
      CHATGPT_FIREFOX_ORIGINAL_HOST: fixture,
      CHATGPT_FIREFOX_TEST_FILE: upload
    },
    timeout: 10_000
  });
  assert.equal(run.status, 0, run.stderr?.toString("utf8"));
  assert.ok(run.stdout.length >= 4, "The native adapter returned no framed message.");
  const length = run.stdout.readUInt32LE(0);
  assert.equal(run.stdout.length, length + 4, "The native message frame length is invalid.");
  const message = JSON.parse(run.stdout.subarray(4).toString("utf8"));
  const payloads = message.params.commandParams._firefoxFilePayloads;
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].name, "firefox-upload.txt");
  assert.equal(Buffer.from(payloads[0].data, "base64").toString("utf8"), "Firefox file upload parity\n");
  const rewrittenUrl = new URL(message.appServerUrl);
  assert.equal(rewrittenUrl.hostname, "127.0.0.1");
  assert.notEqual(rewrittenUrl.port, "45678");
  assert.equal(rewrittenUrl.searchParams.get("token"), "test");
  const serializedResult = JSON.parse(message.serializedResult);
  const nestedUrl = new URL(serializedResult.localAppServerUrl);
  assert.equal(nestedUrl.hostname, "127.0.0.1");
  assert.equal(nestedUrl.port, rewrittenUrl.port);
  assert.equal(nestedUrl.searchParams.get("clientId"), "nested");
  console.log(JSON.stringify({ ok: true, nativeMessaging: true, fileUploadBridge: true, webSocketOriginRelay: true }, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
