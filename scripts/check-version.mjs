import fs from "node:fs";

const release = JSON.parse(fs.readFileSync("version.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8"));
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const npmPackage = JSON.parse(fs.readFileSync("npm/package.json", "utf8"));
const upstreamBuild = JSON.parse(fs.readFileSync("extension/codex/build-info.json", "utf8"));
const readme = fs.readFileSync("README.md", "utf8");
const cargo = fs.readFileSync("native-host/Cargo.toml", "utf8");
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/mu)?.[1];
const expectedTag = `v${release.version}`;

for (const [name, actual] of [
  ["extension manifest", manifest.version],
  ["package.json", packageJson.version],
  ["npm package", npmPackage.version],
  ["native companion", cargoVersion]
]) {
  if (actual !== release.version) {
    throw new Error(`${name} version ${actual} does not match ${release.version}`);
  }
}

if (!readme.includes(`packaged extension version \`${release.upstream_extension_version}\``)) {
  throw new Error(`README.md does not identify upstream extension ${release.upstream_extension_version}`);
}

if (!readme.includes(`build \`${upstreamBuild.sha}\``)) {
  throw new Error(`README.md does not identify upstream build ${upstreamBuild.sha}`);
}

if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME !== expectedTag) {
  throw new Error(`Release tag ${process.env.GITHUB_REF_NAME} must equal ${expectedTag}`);
}

console.log(JSON.stringify({ ok: true, version: release.version, tag: expectedTag }, null, 2));
