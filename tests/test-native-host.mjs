import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  console.log("Native-host adapter test skipped: Windows is required.");
  process.exit(0);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "chatgpt-firefox-native-test-"));
const csc = path.join(process.env.WINDIR, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
const proxy = path.join(temp, "proxy.exe");
const fixture = path.join(temp, "fixture.exe");
const upload = path.join(temp, "firefox-upload.txt");

try {
  fs.writeFileSync(upload, "Firefox file upload parity\n", "utf8");

  for (const [output, source, references] of [
    [proxy, path.join(root, "native-host", "NativeHostProxy.cs"), ["System.Web.Extensions.dll"]],
    [fixture, path.join(root, "tests", "NativeHostFixture.cs"), []]
  ]) {
    const args = ["/nologo", "/target:exe", "/optimize+", `/out:${output}`];
    for (const reference of references) args.push(`/reference:${reference}`);
    args.push(source);
    const compilation = spawnSync(csc, args, { encoding: "utf8" });
    assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);
  }

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
