import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  installLocations,
  manifestPaths,
  nativeManifest,
  optionalManifestPaths
} from "../lib.mjs";

const packageDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(packageDirectory, "cli.mjs");
const version = JSON.parse(
  fs.readFileSync(path.join(packageDirectory, "package.json"), "utf8")
).version;

function writeBridgeExecutable(filePath) {
  fs.writeFileSync(filePath, "#!/bin/sh\necho dummy\n", { mode: 0o755 });
}

function runInstall(home, extraEnv = {}) {
  const dummy = path.join(home, "dummy-bridge");
  writeBridgeExecutable(dummy);
  return spawnSync(process.execPath, [cli, "install"], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      XDG_DATA_HOME: path.join(home, ".local", "share"),
      CODEX_FIREFOX_BRIDGE_BINARY: dummy,
      ...extraEnv
    }
  });
}

function runDoctor(home) {
  return spawnSync(process.execPath, [cli, "doctor"], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      XDG_DATA_HOME: path.join(home, ".local", "share")
    }
  });
}

const skipUnlessLinux = (t) => {
  if (process.platform !== "linux") {
    t.skip("Linux manifest registration is required");
    return true;
  }
  return false;
};

const skipIfRoot = (t) => {
  if (typeof process.geteuid === "function" && process.geteuid() === 0) {
    t.skip("permission-based rollback is not meaningful as root");
    return true;
  }
  return false;
};

function seedWorkingInstall(home, oldVersion) {
  const locations = installLocations("linux", {}, home);
  fs.mkdirSync(locations.directory, { recursive: true });
  const oldBinary = path.join(
    locations.directory,
    `codex-firefox-bridge-${oldVersion}`
  );
  writeBridgeExecutable(oldBinary);
  fs.mkdirSync(path.dirname(locations.manifest), { recursive: true });
  fs.writeFileSync(
    locations.manifest,
    `${JSON.stringify(nativeManifest(oldBinary), null, 2)}\n`
  );
  return { locations, oldBinary };
}

test("preflights the required Linux manifest before writing the bridge binary", (t) => {
  if (skipUnlessLinux(t)) {
    return;
  }

  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-firefox-bridge-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  fs.writeFileSync(path.join(home, ".mozilla"), "not a directory");

  const result = runInstall(home);
  assert.notEqual(result.status, 0, result.stderr || result.stdout);

  const locations = installLocations("linux", {}, home);
  assert.equal(fs.existsSync(locations.manifest), false);
  const binaryPath = path.join(
    locations.directory,
    `codex-firefox-bridge-${version}`
  );
  assert.equal(fs.existsSync(binaryPath), false);
});

test("installs and skips the optional Zen manifest when the Zen host directory is unavailable", (t) => {
  if (skipUnlessLinux(t)) {
    return;
  }

  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-firefox-bridge-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  fs.writeFileSync(path.join(home, ".zen"), "not a directory");

  const result = runInstall(home);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const locations = installLocations("linux", {}, home);
  assert.equal(fs.existsSync(locations.manifest), true);
  assert.equal(fs.existsSync(optionalManifestPaths(locations)[0]), false);
  assert.match(result.stderr || "", /optional manifest .* unavailable/u);

  const doctor = runDoctor(home);
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
});

test("upgrades the Firefox registration while skipping a blocked optional Zen manifest", (t) => {
  if (skipUnlessLinux(t)) {
    return;
  }

  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-firefox-bridge-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const { locations, oldBinary } = seedWorkingInstall(home, "1.4.8");
  fs.mkdirSync(optionalManifestPaths(locations)[0], { recursive: true });

  const result = runInstall(home);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const newBinary = path.join(
    locations.directory,
    `codex-firefox-bridge-${version}`
  );
  assert.equal(fs.existsSync(newBinary), true);
  assert.equal(fs.existsSync(oldBinary), true);

  const manifest = JSON.parse(fs.readFileSync(locations.manifest, "utf8"));
  assert.equal(manifest.path, newBinary);

  const zenManifest = optionalManifestPaths(locations)[0];
  assert.equal(fs.statSync(zenManifest).isDirectory(), true);
  const leftoverTmp = fs
    .readdirSync(path.dirname(zenManifest))
    .filter((name) => name.endsWith(".tmp"));
  assert.deepEqual(leftoverTmp, []);
  assert.match(result.stderr || "", /optional manifest .* unavailable/u);

  const doctor = runDoctor(home);
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
});

test("preserves the prior binary and Firefox manifest when the required manifest cannot be written", (t) => {
  if (skipUnlessLinux(t)) {
    return;
  }
  if (skipIfRoot(t)) {
    return;
  }

  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-firefox-bridge-"));
  t.after(() => {
    try {
      fs.chmodSync(
        path.dirname(installLocations("linux", {}, home).manifest),
        0o700
      );
    } catch {
      // The directory may already be gone or writable.
    }
    fs.rmSync(home, { recursive: true, force: true });
  });

  const { locations, oldBinary } = seedWorkingInstall(home, "1.4.8");
  fs.chmodSync(path.dirname(locations.manifest), 0o500);

  const result = runInstall(home);
  assert.notEqual(result.status, 0, result.stderr || result.stdout);

  const manifest = JSON.parse(fs.readFileSync(locations.manifest, "utf8"));
  assert.equal(manifest.path, oldBinary);
  assert.equal(manifest.name, nativeManifest(oldBinary).name);

  const newBinary = path.join(
    locations.directory,
    `codex-firefox-bridge-${version}`
  );
  assert.equal(fs.existsSync(newBinary), false);
  assert.equal(fs.existsSync(oldBinary), true);

  const leftovers = fs
    .readdirSync(locations.directory)
    .filter((name) => name.endsWith(".tmp") || name.endsWith(".bak"));
  assert.deepEqual(leftovers, []);

  const doctor = runDoctor(home);
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
});
