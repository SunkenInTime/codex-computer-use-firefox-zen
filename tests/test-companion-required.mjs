import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("extension/companion-required.js", "utf8");
const html = fs.readFileSync("extension/companion-required.html", "utf8");
assert.match(html, /Download Linux binary/u);
assert.match(html, /id="developer-install-label"/u);
assert.match(html, /aria-labelledby="developer-install-label developer-install-title"/u);
assert.doesNotMatch(html, /Install for Linux/u);

const elementIds = [
  "bridge-downloads",
  "bridge-version",
  "chrome-prerequisite",
  "connection-explanation",
  "copy-doctor-command",
  "copy-npm-command",
  "developer-install",
  "developer-install-copy",
  "developer-install-label",
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

async function render(search, os = "mac", arch = "x86-64") {
  const elements = new Map(elementIds.map((id) => [id, {
    addEventListener() {},
    classList: {
      added: [],
      add(name) { this.added.push(name); },
    },
    hidden: id === "extension-update-section" || id === "version-status",
    href: "",
    textContent: "",
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  }]));
  const context = vm.createContext({
    URLSearchParams,
    browser: {
      runtime: {
        getManifest() { return { version: "1.4.7" }; },
        async getPlatformInfo() { return { os, arch }; },
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

const macosSetup = await render("");
assert.deepEqual(macosSetup.get("macos-download").classList.added, ["recommended"]);
assert.deepEqual(macosSetup.get("linux-download").classList.added, []);
assert.deepEqual(macosSetup.get("developer-install").classList.added, []);

const linuxSetup = await render("", "linux");
assert.deepEqual(linuxSetup.get("linux-download").classList.added, []);
assert.deepEqual(linuxSetup.get("developer-install").classList.added, ["recommended"]);
assert.equal(
  linuxSetup.get("developer-install").attributes["aria-label"],
  "Install with npm — recommended for this device",
);
assert.equal(linuxSetup.get("developer-install-label").textContent, "Recommended on Linux");
assert.match(linuxSetup.get("developer-install-copy").textContent, /registers the Linux bridge/u);

const linuxArmSetup = await render("", "linux", "arm");
assert.deepEqual(linuxArmSetup.get("developer-install").classList.added, []);
assert.equal(linuxArmSetup.get("developer-install").attributes["aria-label"], undefined);
assert.equal(linuxArmSetup.get("developer-install-label").textContent, "Unsupported Linux architecture");
assert.match(linuxArmSetup.get("developer-install-copy").textContent, /Linux x64 bridge only/u);

console.log(JSON.stringify({
  ok: true,
  olderBridgeRecovery: true,
  olderExtensionRecovery: true,
  legacyBridgeRecovery: true,
  linuxRecommendsNpm: true,
  linuxArmUnsupported: true,
}, null, 2));
