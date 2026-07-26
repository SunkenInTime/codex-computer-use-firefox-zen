import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(path.join(root, "extension", "editing-assets.js"), "utf8");

class EventMock {
  listeners = [];
  addListener(listener) { this.listeners.push(listener); }
  emit(...args) { for (const listener of [...this.listeners]) listener(...args); }
}

const createdMenus = [];
const downloads = [];
const notifications = [];
const browser = {
  contextMenus: {
    onClicked: new EventMock(),
    async removeAll() { createdMenus.length = 0; },
    async create(details) { createdMenus.push(details); return details.id; },
  },
  runtime: {
    onInstalled: new EventMock(),
    onStartup: new EventMock(),
    getURL(pathname) { return `moz-extension://test/${pathname}`; },
  },
  downloads: {
    async download(details) { downloads.push(details); return downloads.length; },
  },
  notifications: {
    async create(details) { notifications.push(details); return "notification"; },
  },
};

const context = vm.createContext({ browser, console, URL, globalThis: null });
context.globalThis = context;
new vm.Script(source, { filename: "editing-assets.js" }).runInContext(context);
await new Promise((resolve) => setTimeout(resolve, 0));

const editingAssets = context.__editingAssets;
assert.ok(editingAssets, "Editing Assets helpers were not exported.");
assert.deepEqual(createdMenus.map((menu) => menu.title), [
  "Save as Meme",
  "Save as Soundboard",
  "Save as Polish SFX",
  "Save as Logo",
  "Save to Inbox",
]);
assert.ok(createdMenus.every((menu) => JSON.stringify(menu.contexts) === JSON.stringify(["image", "video"])));

const info = {
  srcUrl: "https://cdn.example.test/clip.webm?download=1",
  mediaType: "video",
};
const tab = { title: "My / Test: Edit*Page" };
const request = editingAssets.buildDownloadRequest("polishSfx", info, tab);
assert.equal(request.url, info.srcUrl);
assert.match(request.filename, /^Editing Assets\/01 Ready to Use\/Polish SFX\/My Test Edit Page - clip - \d{8}-\d{6}\.webm$/u);
assert.equal(request.saveAs, false);
assert.equal(request.conflictAction, "uniquify");

const imageRequest = editingAssets.buildDownloadRequest("meme", {
  srcUrl: "https://example.test/assets/no-extension",
  mediaType: "image",
}, { title: "A page" });
assert.match(imageRequest.filename, /^Editing Assets\/01 Ready to Use\/Memes - Images\/A page - no-extension - \d{8}-\d{6}\.jpg$/u);

await editingAssets.saveAsset("inbox", { srcUrl: "https://example.test/a.png", mediaType: "image" }, { title: "Inbox" });
assert.equal(downloads.length, 1);
assert.match(downloads[0].filename, /^Editing Assets\/00 Inbox\/Inbox - a - \d{8}-\d{6}\.png$/u);

const failed = await editingAssets.saveAsset("logo", { srcUrl: "blob:https://example.test/not-downloadable" }, { title: "Unsupported" });
assert.equal(failed, null);
assert.equal(downloads.length, 1, "Unsupported sources must not start a download.");
assert.equal(notifications.length, 1);
assert.match(notifications[0].message, /cannot be downloaded directly/u);

console.log(JSON.stringify({ ok: true, menus: createdMenus.length, downloadPath: downloads[0].filename, unsupportedSourceNotDownloaded: true }, null, 2));
