import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const HOST_NAME = "com.openai.codexextension";
export const GECKO_EXTENSION_ID =
  "codex-computer-use-firefox-zen@sunkenintime";
export const REPOSITORY =
  "SunkenInTime/codex-computer-use-firefox-zen";

export function platformAsset(version, platform = process.platform, arch = process.arch) {
  if (platform === "win32" && arch === "x64") {
    return `codex-firefox-bridge-${version}-windows-x64.exe`;
  }
  if (platform === "darwin" && (arch === "arm64" || arch === "x64")) {
    return `codex-firefox-bridge-${version}-macos-universal`;
  }
  throw new Error(
    `Unsupported platform: ${platform}/${arch}. Use the platform installer from the GitHub release.`
  );
}

export function checksumAsset(version, platform = process.platform) {
  if (platform === "win32") {
    return `codex-firefox-bridge-${version}-windows-x64.sha256`;
  }
  if (platform === "darwin") {
    return `codex-firefox-bridge-${version}-macos-universal.sha256`;
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

export function releaseBase(version) {
  return (
    process.env.CODEX_FIREFOX_BRIDGE_RELEASE_BASE ??
    `https://github.com/${REPOSITORY}/releases/download/v${version}`
  ).replace(/\/$/u, "");
}

export function installLocations(
  platform = process.platform,
  environment = process.env,
  home = os.homedir()
) {
  const platformPath = platform === "win32" ? path.win32 : path.posix;
  if (platform === "win32") {
    const localAppData = environment.LOCALAPPDATA;
    if (!localAppData) {
      throw new Error("LOCALAPPDATA is unavailable.");
    }
    const directory = platformPath.join(localAppData, "Codex Firefox Bridge");
    return {
      directory,
      manifest: platformPath.join(directory, `${HOST_NAME}.json`),
      registryKey: `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${HOST_NAME}`
    };
  }
  if (platform === "darwin") {
    const directory = platformPath.join(
      home,
      "Library",
      "Application Support",
      "Codex Firefox Bridge"
    );
    return {
      directory,
      manifest: platformPath.join(
        home,
        "Library",
        "Application Support",
        "Mozilla",
        "NativeMessagingHosts",
        `${HOST_NAME}.json`
      )
    };
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

export function nativeManifest(binaryPath) {
  return {
    name: HOST_NAME,
    description: "Codex Firefox native-messaging bridge",
    path: binaryPath,
    type: "stdio",
    allowed_extensions: [GECKO_EXTENSION_ID]
  };
}

export function expectedChecksum(contents, assetName) {
  for (const line of contents.split(/\r?\n/gu)) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/iu);
    if (match && path.basename(match[2]) === assetName) {
      return match[1].toLowerCase();
    }
  }
  throw new Error(`No checksum was published for ${assetName}.`);
}

export function assertSafeInstallDirectory(directory, platform = process.platform) {
  const resolved = path.resolve(directory);
  const expectedName = "Codex Firefox Bridge";
  if (path.basename(resolved) !== expectedName) {
    throw new Error(`Refusing to modify unexpected install directory: ${resolved}`);
  }
  if (platform === "win32" && !process.env.LOCALAPPDATA) {
    throw new Error("LOCALAPPDATA is unavailable.");
  }
  return resolved;
}

export function readInstalledManifest(manifestPath) {
  const value = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (
    value.name !== HOST_NAME ||
    !value.allowed_extensions?.includes(GECKO_EXTENSION_ID)
  ) {
    throw new Error("The registered native-host manifest is not this bridge.");
  }
  return value;
}
