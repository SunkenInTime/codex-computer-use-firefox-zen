(() => {
  "use strict";

  if (globalThis.__chatgptFirefoxCdpBridgeInstalled) {
    return;
  }
  globalThis.__chatgptFirefoxCdpBridgeInstalled = true;

  // Firefox WebExtensions cannot drive a native synchronous page prompt after
  // it blocks the content process. Hooking before page scripts run prevents the
  // browser UI from hanging and exposes the prompt through the compatibility
  // event stream. When the caller responds, event-driven confirm/prompt calls
  // are replayed once with that response so the page observes the chosen value.
  let respondToDialog = null;
  try {
    const pageWindow = window.wrappedJSObject;
    if (pageWindow && pageWindow.__chatgptFirefoxDialogsPatched !== true && typeof exportFunction === "function") {
      pageWindow.__chatgptFirefoxDialogsPatched = true;
      const report = (type, message, defaultPrompt = "") => {
        browser.runtime.sendMessage({
          type: "CHATGPT_FIREFOX_DIALOG_OPENED",
          dialogType: type,
          message: String(message ?? ""),
          defaultPrompt: String(defaultPrompt ?? ""),
        }).catch(() => {});
      };
      const takeResponse = () => {
        let response;
        try { response = pageWindow.__chatgptFirefoxNextDialogResponse; delete pageWindow.__chatgptFirefoxNextDialogResponse; } catch {}
        return response && typeof response === "object" ? response : null;
      };
      const rememberTrigger = () => {
        try { pageWindow.__chatgptFirefoxPendingDialogTrigger = pageWindow.document.activeElement; } catch {}
      };
      pageWindow.alert = exportFunction((message) => { report("alert", message); }, pageWindow);
      pageWindow.confirm = exportFunction((message) => {
        const response = takeResponse();
        if (response != null) return response.accept === true;
        rememberTrigger();
        report("confirm", message);
        return false;
      }, pageWindow);
      pageWindow.prompt = exportFunction((message, defaultPrompt = "") => {
        const response = takeResponse();
        if (response == null) {
          rememberTrigger();
          report("prompt", message, defaultPrompt);
          return null;
        }
        return response.accept === true ? String(response.promptText ?? defaultPrompt ?? "") : null;
      }, pageWindow);
      respondToDialog = ({ accept, promptText, replay }) => {
        const response = { accept: accept === true, promptText: String(promptText ?? "") };
        try {
          pageWindow.__chatgptFirefoxNextDialogResponse = typeof cloneInto === "function"
            ? cloneInto(response, pageWindow)
            : response;
          const trigger = pageWindow.__chatgptFirefoxPendingDialogTrigger;
          delete pageWindow.__chatgptFirefoxPendingDialogTrigger;
          if (replay === true && trigger?.isConnected && typeof trigger.click === "function") trigger.click();
        } catch {}
      };
    }
  } catch {
    // The normal native prompt remains available on pages Firefox won't wrap.
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== "CHATGPT_FIREFOX_DIALOG_RESPONSE" || respondToDialog == null) return undefined;
    respondToDialog(message);
    return Promise.resolve({ ok: true });
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    const message = event.data;
    if (
      message == null ||
      typeof message !== "object" ||
      message.source !== "chatgpt-firefox-cdp" ||
      message.type !== "binding"
    ) {
      return;
    }

    browser.runtime
      .sendMessage({
        type: "CHATGPT_FIREFOX_CDP_BINDING",
        name: message.name,
        payload: message.payload,
      })
      .catch(() => {});
  });
})();
