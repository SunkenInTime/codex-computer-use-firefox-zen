import { ensureFirefoxHostAccess } from "./firefox-host-access.js";

const extension = globalThis.browser ?? globalThis.chrome;
const isFirefox = /Firefox\//.test(navigator.userAgent);

if (isFirefox && !await ensureFirefoxHostAccess({ extension })) {
  // The permission prompt owns the sidebar until Firefox grants website access.
} else if (isFirefox) {
  // The Firefox port supplies open-tab mentions directly through its own
  // privileged runtime. The inherited UI otherwise waits for a Chrome-only
  // plugin-discovery flag and discards valid Firefox tab candidates.
  globalThis.__codexFirefoxTabMentionProviderAvailable = true;
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
  await import("./assets/chrome-extension-sidepanel-Bf7FJEU3.js");
} else {
  await import("./assets/chrome-extension-sidepanel-Bf7FJEU3.js");
}
