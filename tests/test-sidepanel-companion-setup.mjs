import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CODEX_LOGO_PATH,
  getFirefoxCompanionSetupDetails,
  isFirefoxCompanionSetupError,
} from "../extension/codex-sidepanel/firefox-companion-setup.js";

assert.ok(
  fs.existsSync(`extension/${CODEX_LOGO_PATH}`),
  `The Codex logo referenced by the companion setup screen must exist: ${CODEX_LOGO_PATH}`,
);

assert.equal(isFirefoxCompanionSetupError("Native transport disconnected"), true);
assert.equal(
  isFirefoxCompanionSetupError("Startup failed: Native host request codexRuntime/hello timed out after 10s"),
  true,
);
assert.equal(isFirefoxCompanionSetupError("A normal ChatGPT error"), false);

const details = getFirefoxCompanionSetupDetails("1.2.3");
assert.equal(details.command, "npx --yes codex-firefox-bridge@1.2.3 install");
assert.equal(details.doctorCommand, "npx --yes codex-firefox-bridge@1.2.3 doctor");
assert.match(details.chromeSetupUrl, /^https:\/\/learn\.chatgpt\.com\/docs\/chrome-extension/u);
assert.match(details.windowsUrl, /v1\.2\.3\/codex-firefox-bridge-1\.2\.3-windows-x64-setup\.exe$/u);
assert.match(details.macosUrl, /v1\.2\.3\/codex-firefox-bridge-1\.2\.3-macos-universal\.pkg$/u);
assert.match(details.linuxUrl, /v1\.2\.3\/codex-firefox-bridge-1\.2\.3-linux-x64$/u);

const html = fs.readFileSync("extension/codex-sidepanel/index.html", "utf8");
const bootstrap = fs.readFileSync("extension/codex-sidepanel/firefox-sidebar-bootstrap.js", "utf8");
const css = fs.readFileSync("extension/codex-sidepanel/firefox-companion-setup.css", "utf8");
assert.match(html, /href="\.\/firefox-companion-setup\.css"/u);
assert.match(bootstrap, /installFirefoxCompanionSetup\(\{ extension \}\)/u);
assert.ok(
  bootstrap.indexOf("installFirefoxCompanionSetup") <
    bootstrap.indexOf('await import("./assets/chrome-extension-sidepanel-Bf7FJEU3.js")'),
  "Companion error observation must begin before the upstream sidebar loads.",
);
assert.match(css, /height: 100vh/u);
assert.match(css, /overflow-y: auto/u);
assert.match(css, /firefox-companion-setup__developer--recommended/u);

const setupSource = fs.readFileSync("extension/codex-sidepanel/firefox-companion-setup.js", "utf8");
assert.match(setupSource, /Download Linux binary/u);
assert.match(setupSource, /Recommended on Linux/u);
assert.doesNotMatch(setupSource, /os === "linux" \? linux/u);

console.log(JSON.stringify({
  ok: true,
  embeddedSetup: true,
  nativeErrorsDetected: true,
  releaseLinksVersioned: true,
  setupExplained: true,
}, null, 2));
