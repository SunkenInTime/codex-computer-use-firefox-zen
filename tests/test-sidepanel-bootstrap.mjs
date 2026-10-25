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

const css = fs.readFileSync("extension/codex-sidepanel/firefox-sidebar-layout.css", "utf8");
assert.ok(html.includes("firefox-sidebar-layout.css"));
assert.match(css, /min-height:\s*0/u);
assert.match(css, /@container composer-footer/u);
assert.match(css, /overscroll-behavior-x:\s*contain/u);


// Verify this selector against the class exported by the shipped component,
// rather than merely checking that the intended CSS text exists.
const footer = fs.readFileSync("extension/codex-sidepanel/assets/composer-footer-Cw2FUQYZ.js", "utf8");
const footerClass = /footer:`([^`]+)`/u.exec(footer)?.[1];
assert.ok(footerClass?.includes("_footer_"), "The shipped footer must match the layout adapter.");
assert.ok(footer.includes("i.footer"), "The exported footer class must be used by the component.");
assert.match(css, /\[class\*="_footer_"\]/u);
assert.doesNotMatch(css, /\[data-composer-footer-responsive\]/u);
