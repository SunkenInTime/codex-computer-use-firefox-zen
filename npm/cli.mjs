#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  HOST_NAME,
  assertSafeInstallDirectory,
  checksumAsset,
  downloadWithRetry,
  expectedChecksum,
  installLocations,
  isInstalledBridgeBinary,
  nativeManifest,
  platformAsset,
  readInstalledManifest,
  releaseBase
} from "./lib.mjs";

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(packageDirectory, "package.json"), "utf8")
);
const version = packageJson.version;
const command = process.argv[2] ?? "help";

function writeManifest(manifestPath, binaryPath) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(nativeManifest(binaryPath), null, 2)}\n`,
    "utf8"
  );
}

function registerWindows(manifestPath, registryKey) {
  execFileSync(
    "reg",
    ["add", registryKey, "/ve", "/t", "REG_SZ", "/d", manifestPath, "/f"],
    { stdio: "ignore" }
  );
}

async function install() {
  const locations = installLocations();
  const directory = assertSafeInstallDirectory(locations.directory);
  const assetName = platformAsset(version);
  const binaryName =
    process.platform === "win32"
      ? `codex-firefox-bridge-${version}.exe`
      : `codex-firefox-bridge-${version}`;
  const binaryPath = path.join(directory, binaryName);
  const suppliedBinary = process.env.CODEX_FIREFOX_BRIDGE_BINARY;

  let binary;
  if (suppliedBinary) {
    binary = fs.readFileSync(suppliedBinary);
  } else {
    const base = releaseBase(version);
    const [downloadedBinary, checksums] = await Promise.all([
      downloadWithRetry(`${base}/${assetName}`, {
        headers: { "user-agent": `codex-firefox-bridge/${version}` }
      }),
      downloadWithRetry(`${base}/${checksumAsset(version)}`, {
        headers: { "user-agent": `codex-firefox-bridge/${version}` }
      })
    ]);
    const expected = expectedChecksum(checksums.toString("utf8"), assetName);
    const actual = crypto.createHash("sha256").update(downloadedBinary).digest("hex");
    if (actual !== expected) {
      throw new Error(`Checksum mismatch for ${assetName}.`);
    }
    binary = downloadedBinary;
  }

  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = `${binaryPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, binary, { mode: 0o755 });
  fs.renameSync(temporaryPath, binaryPath);
  if (process.platform !== "win32") {
    fs.chmodSync(binaryPath, 0o755);
  }
  writeManifest(locations.manifest, binaryPath);
  if (process.platform === "win32") {
    registerWindows(locations.manifest, locations.registryKey);
  }

  console.log(`Installed Codex Firefox Bridge ${version}`);
  console.log(`Binary: ${binaryPath}`);
  console.log(`Manifest: ${locations.manifest}`);
  doctor();
}

function doctor() {
  const locations = installLocations();
  const manifest = readInstalledManifest(locations.manifest);
  if (!fs.existsSync(manifest.path)) {
    throw new Error(`Registered bridge binary is missing: ${manifest.path}`);
  }
  if (process.platform === "win32") {
    const registration = execFileSync(
      "reg",
      ["query", locations.registryKey, "/ve"],
      { encoding: "utf8" }
    );
    if (!registration.includes(locations.manifest)) {
      throw new Error("Firefox native-host registry entry is missing or incorrect.");
    }
  }
  const diagnostic = execFileSync(manifest.path, ["--diagnose"], {
    encoding: "utf8",
    timeout: 15_000
  }).trim();
  console.log("Registration: OK");
  console.log(diagnostic);
}

/**
 * Stops versioned bridge processes running from the validated install directory.
 *
 * @param {string} directory Validated bridge installation directory.
 * @returns {void}
 */
function stopWindowsBridgeProcesses(directory) {
  let output;
  try {
    output = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process | " +
          "Where-Object { $_.Name -like 'codex-firefox-bridge-*.exe' } | " +
          "Select-Object ProcessId,ExecutablePath | ConvertTo-Json -Compress"
      ],
      { encoding: "utf8", timeout: 15_000 }
    ).trim();
  } catch {
    // Removing an idle installation does not require process discovery. If a
    // bridge is still active, the final directory removal reports the failure.
    return;
  }
  if (!output) {
    return;
  }
  const parsed = JSON.parse(output);
  const processes = Array.isArray(parsed) ? parsed : [parsed];
  for (const processInfo of processes) {
    if (
      !Number.isInteger(processInfo.ProcessId) ||
      !isInstalledBridgeBinary(processInfo.ExecutablePath, directory, "win32")
    ) {
      continue;
    }
    try {
      execFileSync(
        "taskkill",
        ["/PID", String(processInfo.ProcessId), "/T", "/F"],
        { stdio: "ignore", timeout: 15_000 }
      );
    } catch {
      // The process may have exited after discovery. Directory removal below
      // reports any process that still holds an installation file.
    }
  }
}

function uninstall() {
  const locations = installLocations();
  const directory = assertSafeInstallDirectory(locations.directory);
  if (process.platform === "win32") {
    try {
      execFileSync("reg", ["delete", locations.registryKey, "/f"], {
        stdio: "ignore"
      });
    } catch {
      // The registration may already be absent.
    }
  }
  if (fs.existsSync(locations.manifest)) {
    try {
      readInstalledManifest(locations.manifest);
      fs.rmSync(locations.manifest, { force: true });
    } catch (error) {
      throw new Error(
        `Refusing to remove an unfamiliar native-host manifest: ${error.message}`
      );
    }
  }
  if (process.platform === "win32") {
    stopWindowsBridgeProcesses(directory);
  }
  fs.rmSync(directory, { recursive: true, force: true });
  console.log("Removed Codex Firefox Bridge.");
}

function help() {
  console.log(`Codex Firefox Bridge ${version}

Usage:
  codex-firefox-bridge install
  codex-firefox-bridge doctor
  codex-firefox-bridge uninstall

The install command downloads the matching bridge release, verifies its SHA-256
checksum, installs it per-user, and registers it with Firefox and Zen.`);
}

try {
  if (command === "install") {
    await install();
  } else if (command === "doctor") {
    doctor();
  } else if (command === "uninstall") {
    uninstall();
  } else if (command === "--version" || command === "version") {
    console.log(version);
  } else if (command === "help" || command === "--help" || command === "-h") {
    help();
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(`codex-firefox-bridge: ${error.message}`);
  process.exitCode = 1;
}
