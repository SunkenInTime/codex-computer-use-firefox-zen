import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temp = fs.mkdtempSync(path.resolve(os.tmpdir(), "portable-packaging-"));
let checkout = path.join(temp, "checkout");
const git = (...args) => execFileSync("git", args, { cwd: checkout, encoding: "utf8" });
function zipEntries(buffer) {
  const entries = new Map();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameSize = buffer.readUInt16LE(offset + 26);
    const extraSize = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameSize).toString();
    const start = offset + 30 + nameSize + extraSize;
    entries.set(name, inflateRawSync(buffer.subarray(start, start + compressedSize)));
    offset = start + compressedSize;
  }
  return entries;
}
try {
  execFileSync("git", ["clone", "--quiet", "--no-hardlinks", root, checkout]);
  // Test the script being edited, even before its parent commit is published.
  fs.copyFileSync(path.join(root, "scripts/package-extension.mjs"), path.join(checkout, "scripts/package-extension.mjs"));
  git("add", "scripts/package-extension.mjs");
  // A disposable fixture must not depend on the contributor's signing key.
  git("-c", "user.name=Packaging regression", "-c", "user.email=packaging@localhost",
    "-c", "commit.gpgsign=false", "commit", "--quiet", "--allow-empty", "-m", "Canonical packaging fixture");
  const { version } = JSON.parse(fs.readFileSync(path.join(checkout, "version.json")));
  const stem = `codex-computer-use-firefox-zen-${version}`;
  const build = () => {
    execFileSync(process.execPath, ["scripts/package-extension.mjs"], { cwd: checkout, stdio: "pipe" });
    return ["zip", "xpi", "source.zip"].map(suffix => fs.readFileSync(
      path.join(checkout, "dist", suffix === "source.zip" ? `${stem}-source.zip` : `${stem}.${suffix}`),
    ));
  };
  const baseline = build();
  assert.deepEqual(baseline[0], baseline[1], "ZIP and XPI must carry identical bytes.");
  const packaged = zipEntries(baseline[0]);
  const source = zipEntries(baseline[2]);
  assert.equal(packaged.size, [...source.keys()].filter(name => name.startsWith("extension/")).length);
  for (const [name, data] of packaged) {
    assert.deepEqual(data, source.get(`extension/${name}`), `Review source must contain the exact bytes for ${name}`);
  }
  fs.appendFileSync(path.join(checkout, ".git/info/exclude"), "\nextension/debug.log\n");
  fs.writeFileSync(path.join(checkout, "extension/debug.log"), "ignored local secret\n");
  assert.equal(git("status", "--porcelain").trim(), "", "The contaminating local file is ignored.");
  assert.deepEqual(build(), baseline, "Ignored local files must not affect either archive.");
  const crlfCheckout = path.join(temp, "crlf-checkout");
  execFileSync("git", ["clone", "--quiet", "--no-hardlinks", "--config", "core.autocrlf=true", checkout, crlfCheckout]);
  checkout = crlfCheckout;
  assert.equal(git("status", "--porcelain").trim(), "", "CRLF checkout remains clean.");
  assert.ok(fs.readFileSync(path.join(checkout, "extension/manifest.json"), "utf8").includes("\r\n"),
    "The fixture must actually exercise checkout byte conversion.");
  assert.deepEqual(build(), baseline, "Checkout line-ending filters must not affect committed package bytes.");
  console.log(JSON.stringify({ ok: true, exactReviewSource: true, ignoredFilesExcluded: true, checkoutFiltersIgnored: true }));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
