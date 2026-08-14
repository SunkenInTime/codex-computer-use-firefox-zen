import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("extension/companion-required.js", "utf8");
const elementIds = [
  "bridge-downloads",
  "bridge-version",
  "chrome-prerequisite",
  "connection-explanation",
  "copy-doctor-command",
  "copy-npm-command",
  "developer-install",
  "doctor-command",
  "eyebrow",
  "extension-update-section",
  "extension-version",
  "macos-download",
  "linux-download",
  "npm-command",
  "page-lede",
  "page-title",
  "setup-step-one",
  "setup-step-two",
  "setup-step-three",
  "version-status",
  "windows-download",
];

async function render(search) {
  const elements = new Map(elementIds.map((id) => [id, {
    addEventListener() {},
    classList: { add() {} },
    hidden: id === "extension-update-section" || id === "version-status",
    href: "",
    textContent: "",
  }]));
  const context = vm.createContext({
    URLSearchParams,
    browser: {
      runtime: {
        getManifest() { return { version: "1.4.7" }; },
        async getPlatformInfo() { return { os: "mac" }; },
      },
    },
    document: {
      querySelector(selector) { return elements.get(selector.slice(1)); },
    },
    location: { search },
    navigator: { clipboard: { async writeText() {} } },
    setTimeout,
  });
  new vm.Script(source, { filename: "companion-required.js" }).runInContext(context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return elements;
}

const olderBridge = await render("?reason=version-mismatch&extensionVersion=1.4.7&bridgeVersion=1.4.6");
assert.equal(olderBridge.get("eyebrow").textContent, "Version mismatch");
assert.equal(olderBridge.get("extension-version").textContent, "v1.4.7");
assert.equal(olderBridge.get("bridge-version").textContent, "v1.4.6");
assert.equal(olderBridge.get("version-status").hidden, false);
assert.equal(olderBridge.get("extension-update-section").hidden, true);
assert.equal(olderBridge.get("npm-command").textContent, "npx --yes codex-firefox-bridge@1.4.7 install");
assert.equal(olderBridge.get("doctor-command").textContent, "npx --yes codex-firefox-bridge@1.4.7 doctor");
assert.match(olderBridge.get("linux-download").href, /codex-firefox-bridge-1\.4\.7-linux-x64$/u);
assert.equal(olderBridge.get("connection-explanation").hidden, true);
assert.equal(olderBridge.get("chrome-prerequisite").hidden, true);
assert.match(olderBridge.get("page-lede").textContent, /Update the bridge/u);

const olderExtension = await render("?reason=version-mismatch&extensionVersion=1.4.7&bridgeVersion=1.4.8");
assert.equal(olderExtension.get("extension-update-section").hidden, false);
assert.equal(olderExtension.get("bridge-downloads").hidden, false);
assert.equal(olderExtension.get("developer-install").hidden, false);
assert.match(olderExtension.get("page-lede").textContent, /Update the signed extension/u);
assert.match(olderExtension.get("setup-step-one").textContent, /matching bridge installer/u);
assert.match(olderExtension.get("setup-step-three").textContent, /Restart Firefox or Zen Browser/u);

const legacyBridge = await render("?reason=version-mismatch&extensionVersion=1.4.7&bridgeVersion=unknown");
assert.equal(legacyBridge.get("bridge-version").textContent, "Older version");
assert.match(legacyBridge.get("page-lede").textContent, /Update the bridge/u);

console.log(JSON.stringify({
  ok: true,
  olderBridgeRecovery: true,
  olderExtensionRecovery: true,
  legacyBridgeRecovery: true,
}, null, 2));
