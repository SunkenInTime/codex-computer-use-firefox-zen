import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { installLocations, manifestPaths } from "../lib.mjs";

const packageDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(packageDirectory, "cli.mjs");
const version = JSON.parse(
  fs.readFileSync(path.join(packageDirectory, "package.json"), "utf8")
).version;

function runInstall(home, extraEnv = {}) {
  const dummy = path.join(home, "dummy-bridge");
  fs.writeFileSync(dummy, "#!/bin/sh\necho dummy\n", { mode: 0o755 });
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

test("does not register Firefox when a later Linux manifest cannot be written", (t) => {
  if (process.platform !== "linux") {
    t.skip("Linux multi-manifest registration is required");
    return;
  }

  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-firefox-bridge-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));

  const locations = installLocations("linux", {}, home);
  const zenManifest = manifestPaths(locations)[1];
  fs.mkdirSync(zenManifest, { recursive: true });

  const result = runInstall(home);
  assert.notEqual(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(locations.manifest), false);
  assert.equal(fs.existsSync(zenManifest) && fs.statSync(zenManifest).isDirectory(), true);

  const doctor = spawnSync(process.execPath, [cli, "doctor"], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      XDG_DATA_HOME: path.join(home, ".local", "share")
    }
  });
  assert.notEqual(doctor.status, 0);
  assert.match(doctor.stderr, /Native-host manifest is missing/u);
});

test("preflight fails before writing manifests when a Linux host directory is blocked", (t) => {
  if (process.platform !== "linux") {
    t.skip("Linux multi-manifest registration is required");
    return;
  }

  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-firefox-bridge-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  fs.writeFileSync(path.join(home, ".zen"), "not a directory");

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
