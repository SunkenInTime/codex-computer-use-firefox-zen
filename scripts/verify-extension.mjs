import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDirectory);
const extensionDirectory = path.join(root, "extension");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function existsInExtension(relativePath) {
  return fs.existsSync(path.join(extensionDirectory, relativePath));
}

const manifest = JSON.parse(read("extension/manifest.json"));
assert(manifest.manifest_version === 3, "The port must remain a Manifest V3 extension.");
assert(manifest.browser_specific_settings?.gecko?.id === "codex-computer-use-firefox-zen@sunkenintime", "Unexpected Gecko extension ID.");
assert(manifest.sidebar_action?.default_panel === "codex-sidepanel/index.html", "The Firefox sidebar is not wired to the ChatGPT panel.");
assert(manifest.background?.scripts?.[0] === "firefox-compat.js", "The compatibility layer must load before the packaged background bundle.");
assert(manifest.background?.scripts?.[1] === "background.js", "The packaged OpenAI background bundle is missing.");
assert(!manifest.optional_permissions?.includes("userScripts"), "The publication build must not request the user-script-manager-only permission.");
for (const permission of ["browsingData", "webNavigation", "webRequest", "webRequestBlocking", "webRequestFilterResponse"]) {
  assert(manifest.permissions.includes(permission), `Firefox compatibility permission is missing: ${permission}`);
}

for (const unsupportedPermission of ["debugger", "favicon", "sidePanel"]) {
  assert(!manifest.permissions.includes(unsupportedPermission), `Unsupported Firefox permission remains: ${unsupportedPermission}`);
}

for (const backgroundScript of manifest.background.scripts) {
  assert(existsInExtension(backgroundScript), `Missing background script: ${backgroundScript}`);
  new vm.Script(fs.readFileSync(path.join(extensionDirectory, backgroundScript), "utf8"), { filename: backgroundScript });
}

for (const contentScript of manifest.content_scripts ?? []) {
  for (const script of contentScript.js ?? []) {
    assert(existsInExtension(script), `Missing content script: ${script}`);
    new vm.Script(fs.readFileSync(path.join(extensionDirectory, script), "utf8"), { filename: script });
  }
}

assert(existsInExtension(manifest.sidebar_action.default_panel), "The ChatGPT sidebar HTML is missing.");
for (const setupFile of ["companion-required.html", "companion-required.css", "companion-required.js"]) {
  assert(existsInExtension(setupFile), `Missing companion setup asset: ${setupFile}`);
}
new vm.Script(read("extension/companion-required.js"), { filename: "companion-required.js" });
const setupHtml = read("extension/companion-required.html");
assert(setupHtml.includes("codex-firefox-bridge@"), "The npm installation path is missing from setup.");
assert(setupHtml.includes("Why is this needed?"), "The setup page must explain why the companion is required.");
for (const [size, icon] of Object.entries(manifest.icons)) {
  assert(existsInExtension(icon), `Missing ${size}px icon: ${icon}`);
}

const sidebarHtml = read("extension/codex-sidepanel/index.html");
for (const match of sidebarHtml.matchAll(/(?:src|href)="\.\/([^"?#]+)"/gu)) {
  assert(existsInExtension(path.posix.join("codex-sidepanel", match[1])), `Missing sidebar asset: ${match[1]}`);
}

const compatibilitySource = read("extension/firefox-compat.js");
assert(compatibilitySource.includes("companionSetupShown:"), "Missing one-time companion setup guidance.");
const coreCdpMethods = [
  "DOM.describeNode",
  "DOM.getBoxModel",
  "DOM.getFrameOwner",
  "DOM.getOuterHTML",
  "DOM.getSearchResults",
  "DOM.getContentQuads",
  "DOM.getDocument",
  "DOM.getNodeForLocation",
  "DOM.querySelector",
  "DOM.querySelectorAll",
  "DOM.resolveNode",
  "DOM.scrollIntoViewIfNeeded",
  "DOM.setFileInputFiles",
  "DOM.setAttributeValue",
  "DOMSnapshot.captureSnapshot",
  "Emulation.setFocusEmulationEnabled",
  "Emulation.setGeolocationOverride",
  "Emulation.setTouchEmulationEnabled",
  "Emulation.setUserAgentOverride",
  "Fetch.continueRequest",
  "Fetch.fulfillRequest",
  "Fetch.failRequest",
  "Input.dispatchDragEvent",
  "Input.dispatchKeyEvent",
  "Input.dispatchMouseEvent",
  "Input.dispatchTouchEvent",
  "Input.insertText",
  "Input.setInterceptDrags",
  "Input.synthesizeScrollGesture",
  "Network.clearBrowserCookies",
  "Network.getAllCookies",
  "Network.getCookies",
  "Network.getResponseBody",
  "Network.loadNetworkResource",
  "Network.setCookie",
  "Network.setCookies",
  "Network.setExtraHTTPHeaders",
  "Network.setRequestInterception",
  "Page.addScriptToEvaluateOnNewDocument",
  "Page.captureScreenshot",
  "Page.createIsolatedWorld",
  "Page.getFrameTree",
  "Page.getLayoutMetrics",
  "Page.getNavigationHistory",
  "Page.navigate",
  "Page.navigateToHistoryEntry",
  "Page.handleJavaScriptDialog",
  "Page.reload",
  "Runtime.addBinding",
  "Runtime.callFunctionOn",
  "Runtime.evaluate",
  "Runtime.getProperties",
  "Runtime.compileScript",
  "Runtime.releaseObject",
  "Target.closeTarget",
  "Target.getTargets",
  "Target.setAutoAttach"
];
for (const method of coreCdpMethods) {
  assert(compatibilitySource.includes(`"${method}"`), `Core browser-client command is not translated: ${method}`);
}

const nativeHostSource = read("native-host/src/main.rs");
assert(nativeHostSource.includes("hehggadaopoacecdllhhajmbjkdcmajg"), "The native adapter is not pinned to the official OpenAI extension origin.");
assert(nativeHostSource.includes("DOM.setFileInputFiles"), "The native adapter does not bridge local file uploads.");
assert(nativeHostSource.includes("target_os = \"macos\""), "The native adapter does not include macOS host discovery.");

for (const fixture of ["browser-control.html", "frame-child.html", "frame-grandchild.html", "asset.svg", "upload.txt"]) {
  assert(fs.existsSync(path.join(root, "tests", "fixtures", fixture)), `Missing browser-control fixture: ${fixture}`);
}

let fileCount = 0;
let totalBytes = 0;
for (const entry of fs.readdirSync(extensionDirectory, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  fileCount += 1;
  totalBytes += fs.statSync(path.join(entry.parentPath, entry.name)).size;
}

console.log(JSON.stringify({
  ok: true,
  name: manifest.name,
  version: manifest.version,
  geckoId: manifest.browser_specific_settings.gecko.id,
  files: fileCount,
  bytes: totalBytes,
  coreCdpMethods: coreCdpMethods.length
}, null, 2));
