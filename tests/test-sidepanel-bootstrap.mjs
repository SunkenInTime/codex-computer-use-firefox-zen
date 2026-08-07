import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("extension/codex-sidepanel/index.html", "utf8");
const bootstrap = fs.readFileSync("extension/codex-sidepanel/firefox-sidebar-bootstrap.js", "utf8");

assert.match(html, /src="\.\/firefox-sidebar-bootstrap\.js"/u);
assert.doesNotMatch(html, /src="\.\/assets\/chrome-extension-sidepanel-[^"]+\.js"/u);

const handshakeIndex = bootstrap.indexOf("await extension.runtime.sendMessage");
const upstreamImportIndex = bootstrap.indexOf('await import("./assets/chrome-extension-sidepanel-Bf7FJEU3.js")');
assert.ok(handshakeIndex >= 0, "Bootstrap must await the Firefox sidebar readiness handshake.");
assert.ok(upstreamImportIndex > handshakeIndex, "Upstream sidebar must load only after the readiness handshake.");
assert.match(bootstrap, /getViews\?\.\(\{ type: "sidebar" \}\)\?\.includes\(window\)/u);

console.log(JSON.stringify({ ok: true, nativeSidebarIdentity: true, sidebarReadyBeforeUpstreamBoot: true }, null, 2));
