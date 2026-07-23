import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  checksumAsset,
  expectedChecksum,
  installLocations,
  nativeManifest,
  platformAsset
} from "../lib.mjs";

test("selects release assets for every supported platform", () => {
  assert.equal(
    platformAsset("1.4.0", "win32", "x64"),
    "codex-firefox-bridge-1.4.0-windows-x64.exe"
  );
  assert.equal(
    platformAsset("1.4.0", "darwin", "arm64"),
    "codex-firefox-bridge-1.4.0-macos-universal"
  );
  assert.equal(
    platformAsset("1.4.0", "darwin", "x64"),
    "codex-firefox-bridge-1.4.0-macos-universal"
  );
  assert.equal(
    checksumAsset("1.4.0", "darwin"),
    "codex-firefox-bridge-1.4.0-macos-universal.sha256"
  );
});

test("extracts the matching checksum from multi-file checksum lists", () => {
  const contents = [
    `${"a".repeat(64)}  installer.exe`,
    `${"b".repeat(64)}  codex-firefox-bridge-1.4.0-windows-x64.exe`
  ].join("\n");
  assert.equal(
    expectedChecksum(contents, "codex-firefox-bridge-1.4.0-windows-x64.exe"),
    "b".repeat(64)
  );
});

test("generates Firefox native-host manifests", () => {
  const manifest = nativeManifest("/tmp/bridge");
  assert.equal(manifest.name, "com.openai.codexextension");
  assert.equal(manifest.path, "/tmp/bridge");
  assert.deepEqual(manifest.allowed_extensions, [
    "codex-computer-use-firefox-zen@sunkenintime"
  ]);
});

test("uses per-user installation locations", () => {
  const windows = installLocations(
    "win32",
    { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" },
    "/unused"
  );
  assert.equal(
    windows.directory,
    path.win32.join("C:\\Users\\test\\AppData\\Local", "Codex Firefox Bridge")
  );
  const macos = installLocations("darwin", {}, "/Users/test");
  assert.equal(
    macos.manifest,
    "/Users/test/Library/Application Support/Mozilla/NativeMessagingHosts/com.openai.codexextension.json"
  );
});
