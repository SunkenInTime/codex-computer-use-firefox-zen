import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const extensionRoot = path.join(root, "extension");
const read = (relativePath) => fs.readFileSync(path.join(extensionRoot, relativePath), "utf8");

const manifest = JSON.parse(read("manifest.json"));
const background = read("background.js");
const chatgptWebsite = read("content-scripts/chatgpt-website.js");
const sidebarAssetDirectory = path.join(extensionRoot, "codex-sidepanel", "assets");
const sidebarSources = fs.readdirSync(sidebarAssetDirectory)
  .filter((name) => name.endsWith(".js"))
  .map((name) => fs.readFileSync(path.join(sidebarAssetDirectory, name), "utf8"));
const sidebarIncludes = (needle) => sidebarSources.some((source) => source.includes(needle));

for (const permission of ["contextMenus", "history", "scripting", "sessions", "storage", "tabs"]) {
  assert.ok(manifest.permissions.includes(permission), `New ChatGPT browser features require the ${permission} permission.`);
}

const websiteRegistration = manifest.content_scripts?.find((entry) =>
  entry.matches?.includes("https://chatgpt.com/*")
  && entry.js?.includes("content-scripts/chatgpt-website.js")
);
assert.ok(websiteRegistration, "The ChatGPT website bridge must be registered so open tabs can be mentioned from chatgpt.com.");
assert.ok(chatgptWebsite.includes("search_browser_tab_mentions"), "The ChatGPT website bridge is missing tab-mention search.");
assert.ok(chatgptWebsite.includes("chatgpt-extension-request-browser-tabs"), "The ChatGPT website bridge is missing the tab-mention request event.");
assert.ok(background.includes("browserTabMentionsOnly"), "The background bundle is missing the filtered open-tab provider.");

assert.ok(background.includes('title:"Ask ChatGPT"'), "The inherited page and selection context menu is missing.");
assert.ok(background.includes('contexts:["page","frame","selection","link","editable","image","video","audio"]'), "Ask ChatGPT must be available for pages and selections.");
assert.ok(background.includes('selectedText:e.selectionText??""'), "Ask ChatGPT must forward highlighted text.");
assert.ok(background.includes('kind:"selection"'), "Selection context must be passed into the ChatGPT sidebar invocation.");

assert.ok(sidebarIncludes("<browser__youtube_transcript>"), "The sidebar runtime is missing timestamped YouTube transcript context.");
assert.ok(sidebarIncludes("/api/timedtext"), "The sidebar runtime is missing the YouTube caption retrieval path.");
assert.ok(background.includes("seek_youtube_timestamp"), "The background bundle is missing timestamp seeking for YouTube answers.");

assert.ok(background.includes("getUserHistory"), "The browser client is missing history retrieval.");
assert.ok(background.includes("chrome.history.search"), "The browser client is not wired to Firefox browser history.");

assert.ok(sidebarIncludes("header.openInApp"), "The sidebar is missing the continue-in-desktop action.");
assert.ok(sidebarIncludes("codex://threads/"), "The continue-in-desktop action is missing its shared-thread deep link.");
assert.ok(sidebarIncludes("chrome-extension-sidepanel-thread-page"), "The shared thread route needed to continue desktop chats in the browser is missing.");

console.log(JSON.stringify({
  ok: true,
  openTabMentions: true,
  highlightedText: true,
  askChatGPTContextMenu: true,
  youtubeTimestampedCaptions: true,
  browserHistory: true,
  desktopBrowserHandoff: true,
}, null, 2));
