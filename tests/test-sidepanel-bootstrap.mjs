import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("extension/codex-sidepanel/index.html", "utf8");
const bootstrap = fs.readFileSync("extension/codex-sidepanel/firefox-sidebar-bootstrap.js", "utf8");

assert.match(html, /src="\.\/firefox-sidebar-bootstrap\.js"/u);
assert.doesNotMatch(html, /src="\.\/assets\/chrome-extension-sidepanel-[^"]+\.js"/u);

const handshakeIndex = bootstrap.indexOf("await extension.runtime.sendMessage");
const upstreamImportIndex = bootstrap.indexOf('await import("./assets/chrome-extension-sidepanel-Bf7FJEU3.js")');
const permissionGateIndex = bootstrap.indexOf("await ensureFirefoxHostAccess");
const tabMentionProviderIndex = bootstrap.indexOf("__codexFirefoxTabMentionProviderAvailable = true");
assert.ok(permissionGateIndex >= 0, "Bootstrap must check Firefox host access.");
assert.ok(tabMentionProviderIndex > permissionGateIndex, "Firefox tab mentions must be enabled only after the host-access preflight.");
assert.ok(upstreamImportIndex > tabMentionProviderIndex, "Firefox tab-mention availability must be declared before the upstream sidebar loads.");
assert.ok(handshakeIndex > permissionGateIndex, "Firefox host access must be granted before the sidebar handshake.");
assert.ok(handshakeIndex >= 0, "Bootstrap must await the Firefox sidebar readiness handshake.");
assert.ok(upstreamImportIndex > handshakeIndex, "Upstream sidebar must load only after the readiness handshake.");
assert.match(bootstrap, /getViews\?\.\(\{ type: "sidebar" \}\)\?\.includes\(window\)/u);

console.log(JSON.stringify({ ok: true, hostAccessBeforeSidebarBoot: true, nativeSidebarIdentity: true, firefoxTabMentionsBeforeUpstreamBoot: true, sidebarReadyBeforeUpstreamBoot: true }, null, 2));
