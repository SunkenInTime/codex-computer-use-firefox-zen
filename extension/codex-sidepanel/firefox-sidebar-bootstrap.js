const extension = globalThis.browser ?? globalThis.chrome;

if (/Firefox\//.test(navigator.userAgent)) {
  try {
    const windowId = (await extension.windows.getCurrent()).id;
    const isNativeSidebar =
      extension.extension?.getViews?.({ type: "sidebar" })?.includes(window) === true;
    if (Number.isSafeInteger(windowId) && windowId >= 0) {
      await extension.runtime.sendMessage({
        embedded: isNativeSidebar || window.top !== window,
        type: "codex_firefox_sidepanel_ready",
        windowId,
      });
    }
  } catch {
    // Let the upstream surface render its normal recovery state if Firefox
    // cannot identify or acknowledge the native sidebar window.
  }
}

await import("./assets/chrome-extension-sidepanel-Bf7FJEU3.js");
