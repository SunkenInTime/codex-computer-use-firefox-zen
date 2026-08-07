(function installEditingAssetMenus() {
  "use strict";

  const ROOT = "Editing Assets";
  const ACTIONS = Object.freeze({
    meme: { title: "Save as Meme", folder: "01 Ready to Use/Memes - Images", media: "image" },
    soundboard: { title: "Save as Soundboard", folder: "01 Ready to Use/Soundboard", media: "video" },
    polishSfx: { title: "Save as Polish SFX", folder: "01 Ready to Use/Polish SFX", media: "video" },
    logo: { title: "Save as Logo", folder: "01 Ready to Use/Assets - Logos", media: "image" },
    inbox: { title: "Save to Inbox", folder: "00 Inbox", media: "any" },
  });

  const EXTENSION_BY_MEDIA = Object.freeze({ image: "jpg", video: "mp4" });
  const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/gu;

  function safeSegment(value, fallback) {
    const cleaned = String(value ?? "")
      .replace(UNSAFE_FILENAME_CHARS, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .replace(/[. ]+$/gu, "");
    return cleaned.slice(0, 96) || fallback;
  }

  function mediaTypeFor(info) {
    return info?.mediaType === "video" || info?.contextType === "video" ? "video" : "image";
  }

  function extensionFromUrl(sourceUrl, mediaType) {
    try {
      const pathname = new URL(sourceUrl).pathname;
      const match = pathname.match(/\.([a-z0-9]{1,8})$/iu);
      if (match) return match[1].toLowerCase();
    } catch {
      // Fall through to a type-safe media default.
    }
    return EXTENSION_BY_MEDIA[mediaType] ?? "bin";
  }

  function sourceBasename(sourceUrl) {
    try {
      const pathname = new URL(sourceUrl).pathname;
      const basename = pathname.split("/").filter(Boolean).at(-1) ?? "";
      return decodeURIComponent(basename).replace(/\.[a-z0-9]{1,8}$/iu, "");
    } catch {
      return "";
    }
  }

  function timestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  function buildFilename(info, tab) {
    const mediaType = mediaTypeFor(info);
    const pageTitle = safeSegment(tab?.title, "Editing Asset");
    const itemName = safeSegment(sourceBasename(info?.srcUrl), mediaType === "video" ? "Video" : "Image");
    const ext = extensionFromUrl(info?.srcUrl, mediaType);
    const pieces = pageTitle.toLowerCase() === itemName.toLowerCase()
      ? [pageTitle, timestamp()]
      : [pageTitle, itemName, timestamp()];
    return `${pieces.join(" - ")}.${ext}`;
  }

  function isSupportedSource(sourceUrl) {
    if (typeof sourceUrl !== "string" || sourceUrl.length === 0) return false;
    try {
      return ["http:", "https:", "data:"].includes(new URL(sourceUrl).protocol);
    } catch {
      return false;
    }
  }

  function buildDownloadRequest(actionId, info, tab) {
    const action = ACTIONS[actionId];
    if (!action) throw new Error("Unknown editing asset action.");
    if (!isSupportedSource(info?.srcUrl)) {
      throw new Error("This media URL cannot be downloaded directly. Try the original media page or save it to the browser first.");
    }
    return {
      url: info.srcUrl,
      filename: `${ROOT}/${action.folder}/${buildFilename(info, tab)}`,
      saveAs: false,
      conflictAction: "uniquify",
    };
  }

  async function notifyFailure(message) {
    console.warn(`[Editing Assets] ${message}`);
    if (globalThis.browser?.notifications?.create) {
      await browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("images/firefox-zen-icon48.png"),
        title: "Editing Assets save failed",
        message,
      }).catch(() => {});
    }
  }

  async function saveAsset(actionId, info, tab) {
    try {
      const request = buildDownloadRequest(actionId, info, tab);
      await browser.downloads.download(request);
      return request;
    } catch (error) {
      await notifyFailure(error?.message ?? "The asset could not be downloaded.");
      return null;
    }
  }

  async function createMenus() {
    // Only replace this helper's own entries. The inherited ChatGPT bundle also
    // owns context-menu items (including "Ask ChatGPT"), so removeAll() would
    // silently erase upstream features whenever Firefox starts.
    await Promise.all(Object.keys(ACTIONS).map((id) =>
      browser.contextMenus.remove(`editing-assets-${id}`).catch(() => {})
    ));
    for (const [id, action] of Object.entries(ACTIONS)) {
      await browser.contextMenus.create({
        id: `editing-assets-${id}`,
        title: action.title,
        contexts: ["image", "video"],
      });
    }
  }

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const prefix = "editing-assets-";
    if (typeof info?.menuItemId !== "string" || !info.menuItemId.startsWith(prefix)) return;
    void saveAsset(info.menuItemId.slice(prefix.length), info, tab);
  });
  browser.runtime.onInstalled.addListener(() => void createMenus());
  browser.runtime.onStartup.addListener(() => void createMenus());
  void createMenus();

  globalThis.__editingAssets = { ACTIONS, buildFilename, buildDownloadRequest, isSupportedSource, saveAsset, createMenus };
})();
