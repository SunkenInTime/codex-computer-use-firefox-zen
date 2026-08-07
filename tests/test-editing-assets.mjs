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

const createdMenus = [{ id: "ask-chatgpt", title: "Ask ChatGPT", contexts: ["page", "selection"] }];
const removedMenus = [];
const downloads = [];
const notifications = [];
const browser = {
  contextMenus: {
    onClicked: new EventMock(),
    async remove(id) {
      removedMenus.push(id);
      const index = createdMenus.findIndex((menu) => menu.id === id);
      if (index < 0) throw new Error("Cannot find menu item");
      createdMenus.splice(index, 1);
    },
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
  "Ask ChatGPT",
  "Save as Meme",
  "Save as Soundboard",
  "Save as Polish SFX",
  "Save as Logo",
  "Save to Inbox",
]);
assert.deepEqual(removedMenus, Object.keys(editingAssets.ACTIONS).map((id) => `editing-assets-${id}`));
assert.ok(createdMenus.slice(1).every((menu) => JSON.stringify(menu.contexts) === JSON.stringify(["image", "video"])));
assert.equal(createdMenus[0].title, "Ask ChatGPT", "Refreshing custom menus must preserve the upstream ChatGPT menu.");

browser.runtime.onStartup.emit();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(createdMenus.filter((menu) => menu.title === "Ask ChatGPT").length, 1, "Startup must preserve Ask ChatGPT.");
assert.equal(createdMenus.length, 6, "Startup must replace, not duplicate, Editing Assets menus.");

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

console.log(JSON.stringify({ ok: true, menus: createdMenus.length, askChatGPTPreserved: true, downloadPath: downloads[0].filename, unsupportedSourceNotDownloaded: true }, null, 2));
