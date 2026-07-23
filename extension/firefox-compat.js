(() => {
  "use strict";

  const firefox = globalThis.browser;
  if (firefox == null) {
    throw new Error("The ChatGPT Firefox compatibility layer requires the browser WebExtension API.");
  }

  const OFFICIAL_CHROME_EXTENSION_ID = "hehggadaopoacecdllhhajmbjkdcmajg";
  const BINDING_MESSAGE_SOURCE = "chatgpt-firefox-cdp";

  class CompatEvent {
    constructor() {
      this.listeners = new Set();
    }

    addListener(listener) {
      this.listeners.add(listener);
    }

    removeListener(listener) {
      this.listeners.delete(listener);
    }

    hasListener(listener) {
      return this.listeners.has(listener);
    }

    hasListeners() {
      return this.listeners.size > 0;
    }

    emit(...args) {
      for (const listener of [...this.listeners]) {
        try {
          listener(...args);
        } catch (error) {
          console.error("ChatGPT Firefox compatibility event listener failed", error);
        }
      }
    }
  }

  function bindValue(target, property) {
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  }

  function createNativePortProxy(port) {
    const getInfoRequestIds = new Set();
    const listenerWrappers = new WeakMap();
    let receivedNativeMessage = false;

    port.onMessage.addListener(() => {
      receivedNativeMessage = true;
      firefox.action.setBadgeText({ text: "" }).catch(() => {});
    });
    port.onDisconnect.addListener(() => {
      if (receivedNativeMessage) {
        return;
      }
      const error = firefox.runtime.lastError?.message ?? "";
      if (
        !error.includes("native messaging host") &&
        !error.includes("Native host has exited")
      ) {
        return;
      }
      firefox.action.setBadgeBackgroundColor({ color: "#d97706" }).catch(() => {});
      firefox.action.setBadgeText({ text: "SETUP" }).catch(() => {});
      const storageKey = `companionSetupShown:${firefox.runtime.getManifest().version}`;
      firefox.storage.local.get(storageKey).then((stored) => {
        if (stored[storageKey]) {
          return;
        }
        return firefox.storage.local
          .set({ [storageKey]: true })
          .then(() =>
            firefox.tabs.create({
              url: firefox.runtime.getURL("companion-required.html"),
            }),
          );
      }).catch(() => {});
    });

    const onMessage = {
      addListener(listener) {
        const wrapped = (message) => {
          if (message?.method === "getInfo" && message.id != null) {
            getInfoRequestIds.add(String(message.id));
          }
          listener(message);
        };
        listenerWrappers.set(listener, wrapped);
        port.onMessage.addListener(wrapped);
      },
      removeListener(listener) {
        const wrapped = listenerWrappers.get(listener);
        if (wrapped != null) {
          port.onMessage.removeListener(wrapped);
          listenerWrappers.delete(listener);
        }
      },
      hasListener(listener) {
        const wrapped = listenerWrappers.get(listener);
        return wrapped != null && port.onMessage.hasListener(wrapped);
      },
    };

    return new Proxy(port, {
      get(target, property) {
        if (property === "onMessage") {
          return onMessage;
        }
        if (property === "postMessage") {
          return (message) => {
            let outgoing = message;

            if (
              message?.params?.constraints != null &&
              typeof message.params.constraints === "object"
            ) {
              outgoing = {
                ...message,
                params: {
                  ...message.params,
                  constraints: {
                    ...message.params.constraints,
                    extensionId: OFFICIAL_CHROME_EXTENSION_ID,
                  },
                },
              };
            }

            const responseId = message?.id == null ? null : String(message.id);
            if (responseId != null && getInfoRequestIds.delete(responseId) && message?.result) {
              outgoing = {
                ...message,
                result: {
                  ...message.result,
                  name: "Firefox",
                  metadata: {
                    ...message.result.metadata,
                    extensionId: OFFICIAL_CHROME_EXTENSION_ID,
                    geckoExtensionId: firefox.runtime.id,
                  },
                },
              };
            }

            target.postMessage(outgoing);
          };
        }
        return bindValue(target, property);
      },
    });
  }

  const runtimeCompat = new Proxy(firefox.runtime, {
    get(target, property) {
      if (property === "connectNative") {
        return (application) => createNativePortProxy(target.connectNative(application));
      }
      return bindValue(target, property);
    },
  });

  const sidePanelOpened = new CompatEvent();
  const sidePanelClosed = new CompatEvent();

  const sidePanelCompat = {
    onOpened: sidePanelOpened,
    onClosed: sidePanelClosed,
    setPanelBehavior: async () => {},
    async open({ windowId } = {}) {
      const openRequest = firefox.sidebarAction.open();
      const [openResult] = await Promise.allSettled([openRequest]);
      if (openResult.status === "rejected") {
        throw openResult.reason;
      }
      await reapplyViewportWindows();
      sidePanelOpened.emit({ windowId });
    },
    async close({ windowId } = {}) {
      await firefox.sidebarAction.close();
      await reapplyViewportWindows();
      sidePanelClosed.emit({ windowId });
    },
  };

  const debuggerAttachedTabs = new Set();
  const debuggerOnEvent = new CompatEvent();
  const debuggerOnDetach = new CompatEvent();
  const initScriptsByTab = new Map();
  const bindingNamesByTab = new Map();
  const viewportOverridesByTab = new Map();
  const viewportWindowStates = new Map();
  const viewportWindowByTab = new Map();
  const fileChooserInterceptByTab = new Map();
  const targetIdToTabId = new Map();
  const targetFrameById = new Map();
  const navigationStateByTab = new Map();
  const networkEnabledTabs = new Set();
  const networkRequests = new Map();
  const networkBodies = new Map();
  const fetchConfigByTab = new Map();
  const networkInterceptionByTab = new Map();
  const pendingInterceptions = new Map();
  const extraHttpHeadersByTab = new Map();
  const blockedUrlPatternsByTab = new Map();
  const cacheDisabledTabs = new Set();
  const networkConditionsByTab = new Map();
  const userAgentByTab = new Map();
  const bypassCspTabs = new Set();
  const emulationStateByTab = new Map();
  const pendingDialogsByFrame = new Map();
  const autoAttachByTab = new Map();
  const sessionFrameById = new Map();
  const sessionIdByFrame = new Map();
  const externalNodeReferences = new Map();
  const externalNodeIdsByReference = new Map();
  const ioStreams = new Map();
  let nextInitScriptId = 1;
  let nextStreamId = 1;
  let nextExternalNodeId = 1_000_000;

  function tabTargetId(tabId) {
    const targetId = `firefox-tab-${tabId}`;
    targetIdToTabId.set(targetId, tabId);
    return targetId;
  }

  function frameKey(tabId, frameId) {
    return `${tabId}:${frameId}`;
  }

  function cdpFrameId(tabId, frameId = 0) {
    return frameId === 0 ? `firefox-frame-${tabId}` : `firefox-frame-${tabId}-${frameId}`;
  }

  function firefoxFrameIdFromCdp(tabId, value) {
    if (typeof value !== "string") return null;
    const match = /^firefox-frame-(\d+)(?:-(\d+))?$/u.exec(value);
    if (match == null || Number(match[1]) !== tabId) return null;
    return match[2] == null ? 0 : Number(match[2]);
  }

  function executionContextIdForFrame(frameId) {
    return Math.max(1, Number(frameId) + 1);
  }

  function sessionIdForFrame(tabId, frameId) {
    const key = frameKey(tabId, frameId);
    let sessionId = sessionIdByFrame.get(key);
    if (sessionId == null) {
      sessionId = `firefox-session-${tabId}-${frameId}`;
      sessionIdByFrame.set(key, sessionId);
      sessionFrameById.set(sessionId, { tabId, frameId });
    }
    return sessionId;
  }

  function frameTargetId(tabId, frameId) {
    const targetId = `firefox-frame-target-${tabId}-${frameId}`;
    targetIdToTabId.set(targetId, tabId);
    targetFrameById.set(targetId, { tabId, frameId });
    return targetId;
  }

  function exposeNodeId(tabId, frameId, localNodeId) {
    if (!Number.isInteger(localNodeId) || localNodeId <= 0 || frameId === 0) return localNodeId;
    const key = `${tabId}:${frameId}:${localNodeId}`;
    let externalNodeId = externalNodeIdsByReference.get(key);
    if (externalNodeId == null) {
      externalNodeId = nextExternalNodeId++;
      externalNodeIdsByReference.set(key, externalNodeId);
      externalNodeReferences.set(externalNodeId, { tabId, frameId, localNodeId });
    }
    return externalNodeId;
  }

  function exposeObjectId(tabId, frameId, localObjectId) {
    if (frameId === 0 || typeof localObjectId !== "string") return localObjectId;
    return `firefox-frame-object-${tabId}-${frameId}:${localObjectId}`;
  }

  function parseExposedObjectId(tabId, objectId) {
    if (typeof objectId !== "string") return null;
    const match = /^firefox-frame-object-(\d+)-(\d+):(.*)$/su.exec(objectId);
    if (match == null || Number(match[1]) !== tabId) return null;
    return { tabId, frameId: Number(match[2]), localObjectId: match[3] };
  }

  function exposePageReferences(value, tabId, frameId, key = "") {
    if (Array.isArray(value)) {
      if ((key === "nodeId" || key === "backendNodeId") && frameId !== 0) {
        return value.map((item) => exposeNodeId(tabId, frameId, item));
      }
      return value.map((item) => exposePageReferences(item, tabId, frameId));
    }
    if (value == null || typeof value !== "object") return value;
    const exposed = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if ((entryKey === "nodeId" || entryKey === "backendNodeId") && Number.isInteger(entryValue)) {
        exposed[entryKey] = exposeNodeId(tabId, frameId, entryValue);
      } else if (entryKey === "objectId" && typeof entryValue === "string") {
        exposed[entryKey] = exposeObjectId(tabId, frameId, entryValue);
      } else {
        exposed[entryKey] = exposePageReferences(entryValue, tabId, frameId, entryKey);
      }
    }
    return exposed;
  }

  function findCommandFrameId(tabId, debuggee, params) {
    if (typeof debuggee?.sessionId === "string") {
      const session = sessionFrameById.get(debuggee.sessionId);
      if (session?.tabId === tabId) return session.frameId;
    }
    for (const contextKey of ["contextId", "executionContextId"] ) {
      if (Number.isInteger(params?.[contextKey])) return Math.max(0, params[contextKey] - 1);
    }
    const explicitFrameId = firefoxFrameIdFromCdp(tabId, params?.frameId);
    if (explicitFrameId != null) return explicitFrameId;
    const objectCandidates = [params?.objectId, ...(params?.arguments ?? []).map((argument) => argument?.objectId)];
    for (const objectId of objectCandidates) {
      const reference = parseExposedObjectId(tabId, objectId);
      if (reference != null) return reference.frameId;
    }
    for (const key of ["nodeId", "backendNodeId"] ) {
      const reference = externalNodeReferences.get(params?.[key]);
      if (reference?.tabId === tabId) return reference.frameId;
    }
    return 0;
  }

  function localizePageReferences(value, tabId) {
    if (Array.isArray(value)) return value.map((item) => localizePageReferences(item, tabId));
    if (value == null || typeof value !== "object") return value;
    const localized = {};
    for (const [key, entryValue] of Object.entries(value)) {
      if ((key === "nodeId" || key === "backendNodeId") && Number.isInteger(entryValue)) {
        const reference = externalNodeReferences.get(entryValue);
        localized[key] = reference?.tabId === tabId ? reference.localNodeId : entryValue;
      } else if (key === "objectId" && typeof entryValue === "string") {
        localized[key] = parseExposedObjectId(tabId, entryValue)?.localObjectId ?? entryValue;
      } else {
        localized[key] = localizePageReferences(entryValue, tabId);
      }
    }
    return localized;
  }

  function resolveTabId(debuggee) {
    if (Number.isInteger(debuggee?.tabId)) {
      return debuggee.tabId;
    }
    if (typeof debuggee?.targetId === "string") {
      const mapped = targetIdToTabId.get(debuggee.targetId);
      if (mapped != null) {
        return mapped;
      }
      const numeric = Number(debuggee.targetId.replace(/^firefox-tab-/, ""));
      if (Number.isInteger(numeric)) {
        return numeric;
      }
    }
    throw new Error("Firefox CDP target does not identify a browser tab.");
  }

  function emitDebuggerEvent(tabId, method, params = {}, sessionId = null) {
    if (debuggerAttachedTabs.has(tabId)) {
      debuggerOnEvent.emit(sessionId == null ? { tabId } : { tabId, sessionId }, method, params);
    }
  }

  async function requirePageScriptExecution() {
    if (firefox.scripting?.executeScript == null) {
      throw new Error(
        "Firefox page automation requires scripting.executeScript support.",
      );
    }
  }

  function stripSourceUrl(source) {
    return String(source ?? "")
      .replace(/^\s*\/\/[#@]\s*sourceURL=.*$/gmu, "")
      .trim();
  }

  const PAGE_PREAMBLE = String.raw`
    const __state = globalThis.__chatgptFirefoxCdpState ??= {
      nextObjectId: 1,
      nextNodeId: 2,
      objects: new Map(),
      objectGroups: new Map(),
      nodes: new Map([[1, document]]),
      nodeIds: new WeakMap([[document, 1]]),
      nextSearchId: 1,
      searchResults: new Map(),
      nextScriptId: 1,
      compiledScripts: new Map(),
      pointer: { x: 0, y: 0, element: null },
    };
    const __nodeId = (node) => {
      if (node == null || (typeof node !== "object" && typeof node !== "function")) return 0;
      let id = __state.nodeIds.get(node);
      if (id == null) {
        id = __state.nextNodeId++;
        __state.nodeIds.set(node, id);
        __state.nodes.set(id, node);
      }
      return id;
    };
    const __unserializable = (value) => {
      if (typeof value === "number") {
        if (Number.isNaN(value)) return "NaN";
        if (value === Infinity) return "Infinity";
        if (value === -Infinity) return "-Infinity";
        if (Object.is(value, -0)) return "-0";
      }
      if (typeof value === "bigint") return String(value) + "n";
      return undefined;
    };
    const __description = (value) => {
      try {
        if (typeof value === "function") return String(value);
        if (Array.isArray(value)) return "Array(" + value.length + ")";
        if (value instanceof Error) return value.name + ": " + value.message;
        if (value?.constructor?.name) return value.constructor.name;
        return String(value);
      } catch {
        return "Object";
      }
    };
    const __remote = (value, returnByValue = false, objectGroup = null) => {
      const primitiveType = typeof value;
      if (value === null) return { type: "object", subtype: "null", value: null };
      if (primitiveType === "undefined") return { type: "undefined" };
      if (primitiveType === "string" || primitiveType === "boolean") {
        return { type: primitiveType, value };
      }
      if (primitiveType === "number") {
        const unserializableValue = __unserializable(value);
        return unserializableValue == null
          ? { type: "number", value }
          : { type: "number", unserializableValue };
      }
      if (primitiveType === "bigint") {
        return { type: "bigint", unserializableValue: __unserializable(value), description: String(value) };
      }
      if (primitiveType === "symbol") {
        return { type: "symbol", description: String(value) };
      }
      if (returnByValue) {
        try {
          return { type: primitiveType === "function" ? "function" : "object", value: structuredClone(value) };
        } catch {}
        try {
          return { type: primitiveType === "function" ? "function" : "object", value: JSON.parse(JSON.stringify(value)) };
        } catch {}
      }
      const objectId = "firefox-object-" + __state.nextObjectId++;
      __state.objects.set(objectId, value);
      if (objectGroup) __state.objectGroups.set(objectId, objectGroup);
      let subtype;
      if (Array.isArray(value)) subtype = "array";
      else if (value instanceof Date) subtype = "date";
      else if (value instanceof RegExp) subtype = "regexp";
      else if (value instanceof Error) subtype = "error";
      else if (value instanceof Map) subtype = "map";
      else if (value instanceof Set) subtype = "set";
      else if (value instanceof Promise) subtype = "promise";
      else if (value instanceof Node) subtype = "node";
      return {
        type: primitiveType === "function" ? "function" : "object",
        ...(subtype ? { subtype } : {}),
        className: value?.constructor?.name ?? "Object",
        description: __description(value),
        objectId,
      };
    };
    const __argument = (argument) => {
      if (argument && Object.prototype.hasOwnProperty.call(argument, "objectId")) {
        return __state.objects.get(argument.objectId);
      }
      if (argument && Object.prototype.hasOwnProperty.call(argument, "unserializableValue")) {
        const value = argument.unserializableValue;
        if (value === "NaN") return NaN;
        if (value === "Infinity") return Infinity;
        if (value === "-Infinity") return -Infinity;
        if (value === "-0") return -0;
        if (typeof value === "string" && value.endsWith("n")) return BigInt(value.slice(0, -1));
      }
      return argument?.value;
    };
    const __exception = (error) => ({
      text: error?.message ?? String(error),
      lineNumber: 0,
      columnNumber: 0,
      exception: __remote(error),
      stackTrace: error?.stack ? { callFrames: [] } : undefined,
    });
  `;

  async function executeUserScript(tabId, code, { frameId } = {}) {
    await requirePageScriptExecution();
    const target = { tabId };
    if (Number.isInteger(frameId)) {
      target.frameIds = [frameId];
    }

    const results = await firefox.scripting.executeScript({
      target,
      world: "MAIN",
      injectImmediately: true,
      func: (source) => {
        // The callback is serialized by Firefox and runs in the page's main world.
        return (0, eval)(source);
      },
      args: [code],
    });

    const result = results.find((candidate) => candidate.frameId === (frameId ?? 0)) ?? results[0];
    if (result == null) {
      throw new Error("Firefox did not return a page-script result.");
    }
    if (result.error) {
      throw new Error(result.error);
    }
    if (typeof result.result !== "string") {
      return exposePageReferences(result.result, tabId, frameId ?? 0);
    }

    const parsed = JSON.parse(result.result);
    if (parsed?.ok === false) {
      throw new Error(parsed.error?.message ?? "Firefox page script failed.");
    }
    return exposePageReferences(parsed?.value, tabId, frameId ?? 0);
  }

  function operationScript(body) {
    return `(async () => {
      ${PAGE_PREAMBLE}
      try {
        const __value = await (async () => { ${body} })();
        return JSON.stringify({ ok: true, value: __value });
      } catch (__error) {
        return JSON.stringify({
          ok: false,
          error: { name: __error?.name ?? "Error", message: __error?.message ?? String(__error), stack: __error?.stack },
        });
      }
    })()`;
  }

  function rememberNavigation(tabId, url, title = "") {
    if (typeof url !== "string" || url.length === 0) {
      return;
    }
    let state = navigationStateByTab.get(tabId);
    if (state == null) {
      state = { currentIndex: -1, entries: [] };
      navigationStateByTab.set(tabId, state);
    }
    const current = state.entries[state.currentIndex];
    if (current?.url === url) {
      current.title = title || current.title;
      return;
    }
    state.entries.splice(state.currentIndex + 1);
    state.entries.push({ id: state.entries.length + 1, url, userTypedURL: url, title, transitionType: "other" });
    state.currentIndex = state.entries.length - 1;
  }

  async function getDebuggerTargets() {
    const tabs = await firefox.tabs.query({});
    return tabs
      .filter((tab) => Number.isInteger(tab.id))
      .map((tab) => ({
        id: tabTargetId(tab.id),
        tabId: tab.id,
        type: "page",
        title: tab.title ?? "",
        url: tab.url ?? tab.pendingUrl ?? "",
        attached: debuggerAttachedTabs.has(tab.id),
      }));
  }

  function frameTargetInfo(tabId, frame) {
    return {
      targetId: frameTargetId(tabId, frame.frameId),
      type: "iframe",
      title: "",
      url: frame.url ?? "about:blank",
      attached: sessionIdByFrame.has(frameKey(tabId, frame.frameId)),
      canAccessOpener: false,
      browserContextId: `firefox-context-${tabId}`,
    };
  }

  function emitExecutionContext(tabId, frameId, sessionId = null, url = "") {
    let origin = "";
    try { origin = new URL(url).origin; } catch {}
    emitDebuggerEvent(tabId, "Runtime.executionContextCreated", {
      context: {
        id: executionContextIdForFrame(frameId),
        origin,
        name: "",
        uniqueId: `firefox-context-${tabId}-${frameId}`,
        auxData: { isDefault: true, type: "default", frameId: cdpFrameId(tabId, frameId) },
      },
    }, sessionId);
  }

  async function emitAutoAttachedFrames(tabId) {
    const config = autoAttachByTab.get(tabId);
    if (config?.autoAttach !== true) return;
    const frames = await firefox.webNavigation.getAllFrames({ tabId }).catch(() => null);
    for (const frame of frames ?? []) {
      if (frame.frameId === 0) continue;
      const key = frameKey(tabId, frame.frameId);
      const alreadyKnown = sessionIdByFrame.has(key);
      const sessionId = sessionIdForFrame(tabId, frame.frameId);
      if (!alreadyKnown) {
        emitDebuggerEvent(tabId, "Target.attachedToTarget", {
          sessionId,
          targetInfo: frameTargetInfo(tabId, frame),
          waitingForDebugger: config.waitForDebuggerOnStart === true,
        });
      }
    }
  }

  async function evaluateRuntime(tabId, params, frameId = 0) {
    let expression = stripSourceUrl(params.expression ?? "undefined").replace(/;+\s*$/u, "");
    if (expression.length === 0) {
      expression = "undefined";
    }
    const returnByValue = params.returnByValue === true;
    const awaitPromise = params.awaitPromise === true;
    const objectGroup = typeof params.objectGroup === "string" ? params.objectGroup : null;
    const code = `(async () => {
      ${PAGE_PREAMBLE}
      try {
        const __value = (${expression});
        const __evaluated = ${JSON.stringify(awaitPromise)} ? await __value : __value;
        return JSON.stringify({ ok: true, value: { result: __remote(__evaluated, ${JSON.stringify(returnByValue)}, ${JSON.stringify(objectGroup)}) } });
      } catch (__error) {
        return JSON.stringify({ ok: true, value: { result: { type: "undefined" }, exceptionDetails: __exception(__error) } });
      }
    })()`;
    return executeUserScript(tabId, code, { frameId });
  }

  async function callRuntimeFunction(tabId, params, frameId = 0) {
    const declaration = stripSourceUrl(params.functionDeclaration ?? "function () {}");
    const argumentsJson = JSON.stringify(params.arguments ?? []);
    const returnByValue = params.returnByValue === true;
    const awaitPromise = params.awaitPromise === true;
    const objectGroup = typeof params.objectGroup === "string" ? params.objectGroup : null;
    const code = `(async () => {
      ${PAGE_PREAMBLE}
      try {
        const __fn = (${declaration});
        const __thisValue = ${JSON.stringify(params.objectId ?? null)} == null
          ? globalThis
          : __state.objects.get(${JSON.stringify(params.objectId ?? null)});
        const __args = ${argumentsJson}.map(__argument);
        const __value = Reflect.apply(__fn, __thisValue, __args);
        const __evaluated = ${JSON.stringify(awaitPromise)} ? await __value : __value;
        return JSON.stringify({ ok: true, value: { result: __remote(__evaluated, ${JSON.stringify(returnByValue)}, ${JSON.stringify(objectGroup)}) } });
      } catch (__error) {
        return JSON.stringify({ ok: true, value: { result: { type: "undefined" }, exceptionDetails: __exception(__error) } });
      }
    })()`;
    return executeUserScript(tabId, code, { frameId });
  }

  async function getRuntimeProperties(tabId, params, frameId = 0) {
    const code = operationScript(`
      const __target = __state.objects.get(${JSON.stringify(params.objectId)});
      if (__target == null) return { result: [] };
      const __properties = [];
      for (const __key of Reflect.ownKeys(__target)) {
        let __descriptor;
        try { __descriptor = Object.getOwnPropertyDescriptor(__target, __key); } catch { continue; }
        if (!__descriptor) continue;
        let __propertyValue;
        try { __propertyValue = __target[__key]; } catch (__error) { __propertyValue = __error; }
        __properties.push({
          name: typeof __key === "symbol" ? String(__key) : __key,
          value: __remote(__propertyValue),
          writable: __descriptor.writable !== false,
          configurable: __descriptor.configurable === true,
          enumerable: __descriptor.enumerable === true,
          isOwn: true,
        });
      }
      return { result: __properties, internalProperties: [] };
    `);
    return executeUserScript(tabId, code, { frameId });
  }

  async function runRawInitScript(tabId, source, frameId = 0) {
    const cleanSource = stripSourceUrl(source);
    if (cleanSource.length === 0) {
      return;
    }
    const code = `(async () => {
      ${PAGE_PREAMBLE}
      try {
        ${cleanSource}
        return JSON.stringify({ ok: true });
      } catch (__error) {
        return JSON.stringify({ ok: false, error: { message: __error?.message ?? String(__error), stack: __error?.stack } });
      }
    })()`;
    await executeUserScript(tabId, code, { frameId });
  }

  async function installBinding(tabId, name, frameId = 0) {
    const code = operationScript(`
      const __name = ${JSON.stringify(name)};
      Object.defineProperty(globalThis, __name, {
        configurable: true,
        enumerable: false,
        writable: true,
        value(payload) {
          window.postMessage({
            source: ${JSON.stringify(BINDING_MESSAGE_SOURCE)},
            type: "binding",
            name: __name,
            payload: typeof payload === "string" ? payload : JSON.stringify(payload),
          }, "*");
        },
      });
      return {};
    `);
    await executeUserScript(tabId, code, { frameId });
  }

  async function reapplyPageState(tabId) {
    if (!debuggerAttachedTabs.has(tabId)) {
      return;
    }
    const frames = await firefox.webNavigation.getAllFrames({ tabId }).catch(() => null);
    for (const frame of frames ?? [{ frameId: 0 }]) {
      for (const source of initScriptsByTab.get(tabId)?.values() ?? []) {
        await runRawInitScript(tabId, source, frame.frameId).catch(() => {});
      }
      for (const name of bindingNamesByTab.get(tabId) ?? []) {
        await installBinding(tabId, name, frame.frameId).catch(() => {});
      }
      await applyEmulationToFrame(tabId, frame.frameId).catch(() => {});
    }
  }

  function mutableEmulationState(tabId) {
    let state = emulationStateByTab.get(tabId);
    if (state == null) {
      state = {};
      emulationStateByTab.set(tabId, state);
    }
    return state;
  }

  async function applyEmulationToFrame(tabId, frameId = 0) {
    const state = emulationStateByTab.get(tabId) ?? null;
    await executeUserScript(
      tabId,
      operationScript(`
        const state = ${JSON.stringify(state)};
        const originals = globalThis.__chatgptFirefoxEmulationOriginals ??= {
          matchMedia: globalThis.matchMedia.bind(globalThis),
          dateTimeFormat: Intl.DateTimeFormat,
          hasFocus: document.hasFocus.bind(document),
        };
        const define = (target, name, value) => {
          try { Object.defineProperty(target, name, { configurable: true, enumerable: true, get: () => value }); } catch {}
        };
        const clear = (target, name) => { try { delete target[name]; } catch {} };
        for (const name of ["devicePixelRatio"]) clear(globalThis, name);
        for (const name of ["width", "height", "availWidth", "availHeight", "colorDepth", "pixelDepth", "orientation"]) clear(screen, name);
        for (const name of ["userAgent", "platform", "language", "languages", "maxTouchPoints", "hardwareConcurrency", "webdriver"]) clear(navigator, name);
        for (const name of ["width", "height", "scale"]) if (globalThis.visualViewport) clear(globalThis.visualViewport, name);
        clear(globalThis, "ontouchstart");
        if (navigator.connection) clear(navigator.connection, "saveData");
        try { delete document.hasFocus; } catch {}
        globalThis.matchMedia = originals.matchMedia;
        Intl.DateTimeFormat = originals.dateTimeFormat;
        if (navigator.geolocation) {
          clear(navigator.geolocation, "getCurrentPosition");
          clear(navigator.geolocation, "watchPosition");
          clear(navigator.geolocation, "clearWatch");
        }
        document.getElementById("__chatgpt-firefox-emulation-style")?.remove();
        document.documentElement?.style.removeProperty("color-scheme");
        if (state == null) return {};

        const metrics = state.metrics ?? {};
        if (Number.isFinite(metrics.deviceScaleFactor) && metrics.deviceScaleFactor > 0) define(globalThis, "devicePixelRatio", metrics.deviceScaleFactor);
        if (Number.isFinite(metrics.screenWidth ?? metrics.width)) {
          define(screen, "width", metrics.screenWidth ?? metrics.width);
          define(screen, "availWidth", metrics.screenWidth ?? metrics.width);
        }
        if (Number.isFinite(metrics.screenHeight ?? metrics.height)) {
          define(screen, "height", metrics.screenHeight ?? metrics.height);
          define(screen, "availHeight", metrics.screenHeight ?? metrics.height);
        }
        if (metrics.screenOrientation?.type) {
          const angle = Number(metrics.screenOrientation.angle) || 0;
          define(screen, "orientation", { type: metrics.screenOrientation.type, angle, onchange: null, lock: async () => {}, unlock: () => {} });
        }
        if (globalThis.visualViewport) {
          if (Number.isFinite(metrics.width)) define(globalThis.visualViewport, "width", metrics.width);
          if (Number.isFinite(metrics.height)) define(globalThis.visualViewport, "height", metrics.height);
          if (Number.isFinite(metrics.scale) && metrics.scale > 0) define(globalThis.visualViewport, "scale", metrics.scale);
        }

        const agent = state.userAgent ?? {};
        if (agent.userAgent) define(navigator, "userAgent", agent.userAgent);
        if (agent.platform) define(navigator, "platform", agent.platform);
        const language = agent.acceptLanguage?.split(",", 1)[0]?.trim() || state.locale;
        if (language) {
          define(navigator, "language", language);
          define(navigator, "languages", agent.acceptLanguage ? agent.acceptLanguage.split(",").map((item) => item.trim()).filter(Boolean) : [language]);
        }
        if (Number.isFinite(state.hardwareConcurrency)) define(navigator, "hardwareConcurrency", state.hardwareConcurrency);
        if (state.automationOverride != null) define(navigator, "webdriver", state.automationOverride);
        const touchPoints = state.touch?.enabled === true ? Math.max(1, Number(state.touch.maxTouchPoints) || 1) : (metrics.mobile === true ? 1 : undefined);
        if (touchPoints != null) {
          define(navigator, "maxTouchPoints", touchPoints);
          if (!("ontouchstart" in globalThis)) define(globalThis, "ontouchstart", null);
        }
        if (state.dataSaver != null && navigator.connection) define(navigator.connection, "saveData", state.dataSaver === true);
        if (state.focus === true) Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });

        if (state.geolocation != null && navigator.geolocation) {
          const coordinates = {
            latitude: Number(state.geolocation.latitude), longitude: Number(state.geolocation.longitude), accuracy: Number(state.geolocation.accuracy) || 0,
            altitude: state.geolocation.altitude ?? null, altitudeAccuracy: state.geolocation.altitudeAccuracy ?? null,
            heading: state.geolocation.heading ?? null, speed: state.geolocation.speed ?? null,
          };
          let nextWatchId = 1;
          const position = () => ({ coords: coordinates, timestamp: Date.now() });
          define(navigator.geolocation, "getCurrentPosition", (success) => queueMicrotask(() => success(position())));
          define(navigator.geolocation, "watchPosition", (success) => { const id = nextWatchId++; queueMicrotask(() => success(position())); return id; });
          define(navigator.geolocation, "clearWatch", () => {});
        }

        if (state.timezone) {
          const NativeDateTimeFormat = originals.dateTimeFormat;
          Intl.DateTimeFormat = new Proxy(NativeDateTimeFormat, {
            apply(target, thisArg, args) { const [locales, options = {}] = args; return Reflect.apply(target, thisArg, [locales, { timeZone: state.timezone, ...options }]); },
            construct(target, args, newTarget) { const [locales, options = {}] = args; return Reflect.construct(target, [locales, { timeZone: state.timezone, ...options }], newTarget); },
          });
        }

        const mediaFeatures = Object.fromEntries((state.media?.features ?? []).map((feature) => [feature.name, feature.value]));
        globalThis.matchMedia = (query) => {
          const nativeResult = originals.matchMedia(query);
          let matches = nativeResult.matches;
          for (const [name, value] of Object.entries(mediaFeatures)) {
            if (String(query).includes("(" + name)) matches = String(query).includes(String(value));
          }
          return new Proxy(nativeResult, { get(target, property) { return property === "matches" ? matches : Reflect.get(target, property, target); } });
        };
        if (mediaFeatures["prefers-color-scheme"]) document.documentElement?.style.setProperty("color-scheme", mediaFeatures["prefers-color-scheme"]);
        if (state.scrollbarsHidden === true || state.backgroundColor != null) {
          const style = document.createElement("style");
          style.id = "__chatgpt-firefox-emulation-style";
          style.textContent = (state.scrollbarsHidden === true ? "*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}" : "")
            + (state.backgroundColor ? "html{background:rgba(" + (state.backgroundColor.r ?? 0) + "," + (state.backgroundColor.g ?? 0) + "," + (state.backgroundColor.b ?? 0) + "," + (state.backgroundColor.a ?? 1) + ")!important}" : "");
          (document.head ?? document.documentElement)?.append(style);
        }
        return {};
      `),
      { frameId },
    );
  }

  async function applyEmulationState(tabId) {
    const frames = await firefox.webNavigation.getAllFrames({ tabId }).catch(() => null);
    await Promise.all((frames ?? [{ frameId: 0 }]).map((frame) => applyEmulationToFrame(tabId, frame.frameId).catch(() => {})));
  }

  async function captureScreenshot(tabId, params) {
    const format = params.format === "jpeg" ? "jpeg" : "png";
    const options = { format };
    if (format === "jpeg" && Number.isInteger(params.quality)) {
      options.quality = Math.max(0, Math.min(100, params.quality));
    }
    const dataUrl = await firefox.tabs.captureTab(tabId, options);
    const comma = dataUrl.indexOf(",");
    return { data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl };
  }

  async function getFrameTree(tabId) {
    const tab = await firefox.tabs.get(tabId);
    const topUrl = tab.url ?? tab.pendingUrl ?? "about:blank";
    let frameEntries = await firefox.webNavigation.getAllFrames({ tabId }).catch(() => null);
    if (!Array.isArray(frameEntries) || frameEntries.length === 0) {
      frameEntries = [{ frameId: 0, parentFrameId: -1, url: topUrl, frameType: "outermost_frame" }];
    }
    if (!frameEntries.some((frame) => frame.frameId === 0)) {
      frameEntries.unshift({ frameId: 0, parentFrameId: -1, url: topUrl, frameType: "outermost_frame" });
    }

    const metadata = new Map();
    await Promise.all(frameEntries.map(async (frame) => {
      try {
        const value = await executeUserScript(
          tabId,
          operationScript(`return { name: window.name || "", mimeType: document.contentType || "text/html", title: document.title || "", securityOrigin: location.origin };`),
          { frameId: frame.frameId },
        );
        metadata.set(frame.frameId, value);
      } catch {
        metadata.set(frame.frameId, {});
      }
    }));

    let observedResources = [];
    try {
      observedResources = await executeUserScript(
        tabId,
        operationScript(`
          return performance.getEntriesByType("resource").map((entry) => ({
            url: entry.name,
            initiatorType: entry.initiatorType || "other",
            contentSize: entry.decodedBodySize || entry.encodedBodySize || entry.transferSize || 0,
          }));
        `),
      );
    } catch {
      observedResources = [];
    }
    const resources = await Promise.all(
      [...new Map((observedResources ?? []).filter((resource) => /^https?:/iu.test(resource.url)).map((resource) => [resource.url, resource])).values()]
        .slice(0, 500)
        .map(async (resource) => {
          let mimeType = "application/octet-stream";
          try {
            let response = await fetch(resource.url, { method: "HEAD", credentials: "include", redirect: "follow" });
            if (!response.ok && response.status === 405) {
              response = await fetch(resource.url, { credentials: "include", redirect: "follow" });
            }
            mimeType = (response.headers.get("content-type") ?? mimeType).split(";", 1)[0].trim() || mimeType;
          } catch {}
          return {
            url: resource.url,
            type: cdpResourceType(resource.initiatorType),
            mimeType,
            lastModified: 0,
            contentSize: Number(resource.contentSize) || 0,
            failed: false,
            canceled: false,
          };
        }),
    );
    const trees = new Map();
    for (const entry of frameEntries) {
      const frameMetadata = metadata.get(entry.frameId) ?? {};
      const url = entry.url || (entry.frameId === 0 ? topUrl : "about:blank");
      const frame = {
        id: cdpFrameId(tabId, entry.frameId),
        loaderId: `firefox-loader-${tabId}-${entry.frameId}`,
        url,
        name: frameMetadata.name ?? "",
        domainAndRegistry: "",
        securityOrigin: frameMetadata.securityOrigin ?? (() => {
          try { return new URL(url).origin; } catch { return "null"; }
        })(),
        mimeType: frameMetadata.mimeType ?? "text/html",
      };
      if (entry.frameId !== 0) frame.parentId = cdpFrameId(tabId, entry.parentFrameId);
      trees.set(entry.frameId, { frame, resources: entry.frameId === 0 ? resources : [], childFrames: [] });
    }
    for (const entry of frameEntries) {
      if (entry.frameId === 0) continue;
      const parent = trees.get(entry.parentFrameId) ?? trees.get(0);
      const child = trees.get(entry.frameId);
      if (parent != null && child != null) parent.childFrames.push(child);
    }
    return { frameTree: trees.get(0) };
  }

  async function getLayoutMetrics(tabId, frameId = 0) {
    return executeUserScript(
      tabId,
      operationScript(`
        const width = window.innerWidth;
        const height = window.innerHeight;
        const contentWidth = Math.max(document.documentElement?.scrollWidth ?? 0, document.body?.scrollWidth ?? 0, width);
        const contentHeight = Math.max(document.documentElement?.scrollHeight ?? 0, document.body?.scrollHeight ?? 0, height);
        return {
          layoutViewport: { pageX: window.scrollX, pageY: window.scrollY, clientWidth: width, clientHeight: height },
          visualViewport: { offsetX: 0, offsetY: 0, pageX: window.scrollX, pageY: window.scrollY, clientWidth: width, clientHeight: height, scale: 1, zoom: 1 },
          contentSize: { x: 0, y: 0, width: contentWidth, height: contentHeight },
          cssLayoutViewport: { pageX: window.scrollX, pageY: window.scrollY, clientWidth: width, clientHeight: height },
          cssVisualViewport: { offsetX: 0, offsetY: 0, pageX: window.scrollX, pageY: window.scrollY, clientWidth: width, clientHeight: height, scale: 1, zoom: 1 },
          cssContentSize: { x: 0, y: 0, width: contentWidth, height: contentHeight },
        };
      `),
      { frameId },
    );
  }

  async function readViewportSize(tabId) {
    return executeUserScript(
      tabId,
      operationScript(`return { width: window.innerWidth, height: window.innerHeight };`),
    );
  }

  async function resizeWindowForViewport(windowId, tabId, viewport, state) {
    const [previousActiveTab] = await firefox.tabs.query({ active: true, windowId });
    const shouldRestoreActiveTab = previousActiveTab?.id != null && previousActiveTab.id !== tabId;
    if (shouldRestoreActiveTab) {
      // Firefox does not reflow every background tab immediately after a window
      // resize. Briefly selecting the controlled tab makes its measured viewport
      // authoritative; the user's prior tab is restored before this call returns.
      await firefox.tabs.update(tabId, { active: true });
    }

    try {
      let browserWindow = await firefox.windows.get(windowId);
      if (browserWindow.state !== "normal") {
        await firefox.windows.update(windowId, { state: "normal" });
        await new Promise((resolve) => setTimeout(resolve, 50));
        browserWindow = await firefox.windows.get(windowId);
      }

      for (let attempt = 0; attempt < 4; attempt += 1) {
        let pageSize;
        try {
          pageSize = await readViewportSize(tabId);
        } catch {
          pageSize = null;
        }

        if (pageSize != null) {
          state.frameWidth = (browserWindow.width ?? viewport.width) - pageSize.width;
          state.frameHeight = (browserWindow.height ?? viewport.height) - pageSize.height;
          if (Math.abs(pageSize.width - viewport.width) <= 1 && Math.abs(pageSize.height - viewport.height) <= 1) {
            return;
          }
        }

        const width = Math.max(100, Math.round(viewport.width + (state.frameWidth ?? 0)));
        const height = Math.max(100, Math.round(viewport.height + (state.frameHeight ?? 0)));
        await firefox.windows.update(windowId, { width, height });
        await new Promise((resolve) => setTimeout(resolve, 50));
        browserWindow = await firefox.windows.get(windowId);
      }
    } finally {
      if (shouldRestoreActiveTab) {
        await firefox.tabs.update(previousActiveTab.id, { active: true }).catch(() => {});
      }
    }
  }

  async function setViewportOverride(tabId, params) {
    const viewport = {
      width: Math.max(1, Math.round(Number(params.width) || 1)),
      height: Math.max(1, Math.round(Number(params.height) || 1)),
    };
    const tab = await firefox.tabs.get(tabId);
    if (!Number.isInteger(tab.windowId)) {
      throw new Error("Firefox could not identify the window for viewport emulation.");
    }

    let state = viewportWindowStates.get(tab.windowId);
    if (state == null) {
      const original = await firefox.windows.get(tab.windowId);
      state = {
        original: {
          state: original.state ?? "normal",
          width: original.width,
          height: original.height,
          left: original.left,
          top: original.top,
        },
        tabIds: new Set(),
        viewport,
        frameWidth: null,
        frameHeight: null,
      };
      viewportWindowStates.set(tab.windowId, state);
    }

    const previousWindowId = viewportWindowByTab.get(tabId);
    if (previousWindowId != null && previousWindowId !== tab.windowId) {
      await clearViewportOverride(tabId);
    }
    state.tabIds.add(tabId);
    state.viewport = viewport;
    viewportWindowByTab.set(tabId, tab.windowId);
    viewportOverridesByTab.set(tabId, viewport);
    mutableEmulationState(tabId).metrics = { ...params, width: viewport.width, height: viewport.height };
    await resizeWindowForViewport(tab.windowId, tabId, viewport, state);
    await applyEmulationState(tabId);
  }

  async function restoreViewportWindow(windowId, state, tabId) {
    let previousActiveTab = null;
    let activatedControlledTab = false;
    try {
      [previousActiveTab] = await firefox.tabs.query({ active: true, windowId });
      if (Number.isInteger(tabId) && previousActiveTab?.id !== tabId) {
        await firefox.tabs.update(tabId, { active: true });
        activatedControlledTab = true;
      }
    } catch {
      // The controlled tab may already have closed; window restoration still works.
    }

    try {
      const current = await firefox.windows.get(windowId);
      if (current.state !== "normal") {
        await firefox.windows.update(windowId, { state: "normal" });
      }
      const bounds = {};
      for (const key of ["width", "height", "left", "top"]) {
        if (Number.isInteger(state.original[key])) bounds[key] = state.original[key];
      }
      if (Object.keys(bounds).length > 0) {
        await firefox.windows.update(windowId, bounds);
      }
      if (state.original.state !== "normal") {
        await firefox.windows.update(windowId, { state: state.original.state });
      }
      await new Promise((resolve) => setTimeout(resolve, 75));
    } catch {
      // The browser window may already have been closed.
    } finally {
      if (activatedControlledTab && previousActiveTab?.id != null) {
        await firefox.tabs.update(previousActiveTab.id, { active: true }).catch(() => {});
      }
    }
  }

  async function clearViewportOverride(tabId) {
    viewportOverridesByTab.delete(tabId);
    const emulation = emulationStateByTab.get(tabId);
    if (emulation != null) delete emulation.metrics;
    void applyEmulationState(tabId);
    const windowId = viewportWindowByTab.get(tabId);
    viewportWindowByTab.delete(tabId);
    if (windowId == null) return;
    const state = viewportWindowStates.get(windowId);
    if (state == null) return;
    state.tabIds.delete(tabId);
    if (state.tabIds.size > 0) return;
    viewportWindowStates.delete(windowId);
    await restoreViewportWindow(windowId, state, tabId);
  }

  async function reapplyViewportWindows() {
    for (const [windowId, state] of viewportWindowStates) {
      const tabId = [...state.tabIds][0];
      if (tabId != null) {
        await resizeWindowForViewport(windowId, tabId, state.viewport, state).catch(() => {});
      }
    }
  }

  async function getDocument(tabId, params, frameId = 0) {
    const depth = Number.isInteger(params.depth) ? params.depth : 2;
    const result = await executeUserScript(
      tabId,
      operationScript(`
        const __maxDepth = ${JSON.stringify(depth)};
        const __frameOwners = [...document.querySelectorAll("iframe,frame")];
        const __ownerUrl = (element) => {
          try {
            const source = element.hasAttribute("srcdoc") ? "about:srcdoc" : (element.getAttribute("src") || "about:blank");
            return new URL(source, document.baseURI).href;
          } catch { return ""; }
        };
        const __serialize = (node, currentDepth) => {
          const nodeId = __nodeId(node);
          const attributes = node.nodeType === Node.ELEMENT_NODE
            ? [...node.attributes].flatMap((attribute) => [attribute.name, attribute.value])
            : [];
          const serialized = {
            nodeId,
            backendNodeId: nodeId,
            nodeType: node.nodeType,
            nodeName: node.nodeName,
            localName: node.localName ?? "",
            nodeValue: node.nodeValue ?? "",
            childNodeCount: node.childNodes?.length ?? 0,
            attributes,
          };
          if (currentDepth < __maxDepth || __maxDepth < 0) {
            serialized.children = [...(node.childNodes ?? [])].map((child) => __serialize(child, currentDepth + 1));
          }
          if (node === document) {
            serialized.documentURL = location.href;
            serialized.baseURL = document.baseURI;
          }
          if (node instanceof HTMLIFrameElement || node instanceof HTMLFrameElement) {
            const ownerIndex = __frameOwners.indexOf(node);
            const ownerUrl = __ownerUrl(node);
            serialized.__frameOwnerIndex = ownerIndex;
            serialized.__sameUrlOwnerIndex = __frameOwners.slice(0, ownerIndex).filter((element) => __ownerUrl(element) === ownerUrl).length;
            serialized.__resolvedFrameUrl = ownerUrl;
          }
          return serialized;
        };
        return { root: __serialize(document, 0) };
      `),
      { frameId },
    );
    const frames = await firefox.webNavigation.getAllFrames({ tabId }).catch(() => []);
    const visit = (node) => {
      if (node == null) return;
      setFrameOwnerFrameId(tabId, frameId, node, frames ?? []);
      for (const child of node.children ?? []) visit(child);
    };
    visit(result?.root);
    return result;
  }

  async function getAccessibilityTree(tabId, frameId = 0, rootBackendNodeId = null) {
    return executeUserScript(
      tabId,
      operationScript(`
        const roleFor = (element) => element.getAttribute?.("role") || ({A:"link",BUTTON:"button",INPUT:element.type==="checkbox"?"checkbox":"textbox",TEXTAREA:"textbox",SELECT:"combobox",IMG:"img",H1:"heading",H2:"heading",H3:"heading",MAIN:"main",NAV:"navigation",FORM:"form"}[element.tagName] ?? "generic");
        const nameFor = (element) => element.getAttribute?.("aria-label") || element.getAttribute?.("alt") || element.getAttribute?.("title") || element.labels?.[0]?.textContent?.trim() || element.textContent?.trim()?.slice(0,500) || "";
        const root = ${JSON.stringify(rootBackendNodeId)} == null ? document.documentElement : (__state.nodes.get(${JSON.stringify(rootBackendNodeId)}) ?? document.documentElement);
        const elements = [root, ...(root.querySelectorAll?.("*") ?? [])].filter((element) => element instanceof Element);
        const nodeIds = new Map(elements.map((element) => [element, "firefox-ax-" + __nodeId(element)]));
        const nodes = elements.map((element) => {
          const backendDOMNodeId = __nodeId(element);
          const children = [...element.children].map((child) => nodeIds.get(child)).filter(Boolean);
          const role = roleFor(element);
          const name = nameFor(element);
          return {
            nodeId: nodeIds.get(element), ignored: false, role: {type:"role",value:role}, name: {type:"computedString",value:name},
            description: {type:"computedString",value:element.getAttribute?.("aria-description")??""}, value: {type:"computedString",value:element.value??""},
            properties: [], childIds: children, backendDOMNodeId, frameId: ${JSON.stringify(cdpFrameId(tabId, frameId))},
          };
        });
        return { nodes };
      `),
      { frameId },
    );
  }

  async function querySelector(tabId, params, frameId = 0) {
    return executeUserScript(
      tabId,
      operationScript(`
        const root = __state.nodes.get(${JSON.stringify(params.nodeId)}) ?? document;
        const node = root.querySelector?.(${JSON.stringify(params.selector)}) ?? null;
        return { nodeId: __nodeId(node) };
      `),
      { frameId },
    );
  }

  function setFrameOwnerFrameId(tabId, parentFrameId, node, frames) {
    const ownerIndex = node?.__frameOwnerIndex;
    const sameUrlOwnerIndex = node?.__sameUrlOwnerIndex;
    const resolvedFrameUrl = node?.__resolvedFrameUrl;
    delete node?.__frameOwnerIndex;
    delete node?.__sameUrlOwnerIndex;
    delete node?.__resolvedFrameUrl;
    if (!Number.isInteger(ownerIndex)) return node;

    const child = childFrameForOwner(parentFrameId, { ownerIndex, sameUrlOwnerIndex, resolvedFrameUrl }, frames);
    if (child != null) node.frameId = cdpFrameId(tabId, child.frameId);
    return node;
  }

  function childFrameForOwner(parentFrameId, owner, frames) {
    const children = (frames ?? [])
      .filter((frame) => frame.parentFrameId === parentFrameId)
      .sort((left, right) => left.frameId - right.frameId);
    const matching = owner.resolvedFrameUrl
      ? children.filter((frame) => frame.url === owner.resolvedFrameUrl)
      : [];
    return matching[Number.isInteger(owner.sameUrlOwnerIndex) ? owner.sameUrlOwnerIndex : 0]
      ?? matching[0]
      ?? children[owner.ownerIndex];
  }

  async function describeNode(tabId, params, frameId = 0) {
    const result = await executeUserScript(
      tabId,
      operationScript(`
        const objectId = ${JSON.stringify(params.objectId ?? null)};
        const id = ${JSON.stringify(params.nodeId ?? params.backendNodeId ?? 0)};
        const node = objectId ? __state.objects.get(objectId) : __state.nodes.get(id);
        if (!(node instanceof Node)) throw new Error("DOM node not found");
        const nodeId = __nodeId(node);
        const frameOwners = [...document.querySelectorAll("iframe,frame")];
        const ownerIndex = frameOwners.indexOf(node);
        const ownerUrl = ownerIndex < 0 ? "" : (() => {
          try {
            const source = node.hasAttribute("srcdoc") ? "about:srcdoc" : (node.getAttribute("src") || "about:blank");
            return new URL(source, document.baseURI).href;
          } catch { return ""; }
        })();
        return { node: {
          nodeId,
          backendNodeId: nodeId,
          nodeType: node.nodeType,
          nodeName: node.nodeName,
          localName: node.localName ?? "",
          nodeValue: node.nodeValue ?? "",
          childNodeCount: node.childNodes?.length ?? 0,
          attributes: node.nodeType === Node.ELEMENT_NODE ? [...node.attributes].flatMap((attribute) => [attribute.name, attribute.value]) : [],
          __frameOwnerIndex: ownerIndex < 0 ? undefined : ownerIndex,
          __sameUrlOwnerIndex: ownerIndex < 0 ? undefined : frameOwners.slice(0, ownerIndex).filter((element) => {
            try {
              const source = element.hasAttribute("srcdoc") ? "about:srcdoc" : (element.getAttribute("src") || "about:blank");
              return new URL(source, document.baseURI).href === ownerUrl;
            } catch { return false; }
          }).length,
          __resolvedFrameUrl: ownerIndex < 0 ? undefined : ownerUrl,
        } };
      `),
      { frameId },
    );
    if (Number.isInteger(result?.node?.__frameOwnerIndex)) {
      const frames = await firefox.webNavigation.getAllFrames({ tabId }).catch(() => []);
      setFrameOwnerFrameId(tabId, frameId, result.node, frames ?? []);
    }
    return result;
  }

  async function resolveNode(tabId, params, frameId = 0) {
    return executeUserScript(
      tabId,
      operationScript(`
        const id = ${JSON.stringify(params.nodeId ?? params.backendNodeId ?? 0)};
        const node = __state.nodes.get(id);
        if (!(node instanceof Node)) throw new Error("DOM node not found");
        return { object: __remote(node, false, ${JSON.stringify(params.objectGroup ?? null)}) };
      `),
      { frameId },
    );
  }

  async function requestNode(tabId, params, frameId = 0) {
    return executeUserScript(
      tabId,
      operationScript(`
        const node = __state.objects.get(${JSON.stringify(params.objectId)});
        return { nodeId: node instanceof Node ? __nodeId(node) : 0 };
      `),
      { frameId },
    );
  }

  async function getBoxModel(tabId, params, frameId = 0) {
    return executeUserScript(
      tabId,
      operationScript(`
        const objectId = ${JSON.stringify(params.objectId ?? null)};
        const id = ${JSON.stringify(params.nodeId ?? params.backendNodeId ?? 0)};
        const node = objectId ? __state.objects.get(objectId) : __state.nodes.get(id);
        if (!(node instanceof Element)) throw new Error("DOM element not found");
        const rect = node.getBoundingClientRect();
        const quad = [rect.left, rect.top, rect.right, rect.top, rect.right, rect.bottom, rect.left, rect.bottom];
        return { model: { content: quad, padding: quad, border: quad, margin: quad, width: rect.width, height: rect.height, shapeOutside: { bounds: quad, shape: [], marginShape: [] } } };
      `),
      { frameId },
    );
  }

  async function getContentQuads(tabId, params, frameId = 0) {
    const model = await getBoxModel(tabId, params, frameId);
    return { quads: [model.model.border] };
  }

  async function scrollIntoView(tabId, params, frameId = 0) {
    await executeUserScript(
      tabId,
      operationScript(`
        const objectId = ${JSON.stringify(params.objectId ?? null)};
        const id = ${JSON.stringify(params.nodeId ?? params.backendNodeId ?? 0)};
        const node = objectId ? __state.objects.get(objectId) : __state.nodes.get(id);
        if (!(node instanceof Element)) throw new Error("DOM element not found");
        node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        return {};
      `),
      { frameId },
    );
    return {};
  }

  async function nodeForLocation(tabId, params, frameId = 0) {
    return executeUserScript(
      tabId,
      operationScript(`
        const node = document.elementFromPoint(${Number(params.x) || 0}, ${Number(params.y) || 0});
        const nodeId = __nodeId(node);
        return { backendNodeId: nodeId, nodeId, frameId: ${JSON.stringify(cdpFrameId(tabId, frameId))} };
      `),
      { frameId },
    );
  }

  async function getFrameOwner(tabId, params, fallbackFrameId = 0) {
    const childFrameId = firefoxFrameIdFromCdp(tabId, params.frameId) ?? fallbackFrameId;
    if (childFrameId == null || childFrameId === 0) {
      // Some CDP clients ask for an owner while iterating every snapshot
      // document, including the top-level one. Chrome treats the top-level
      // document as ownerless; a zero node reference lets those clients keep
      // their frame-offset accumulator at the viewport origin.
      return { nodeId: 0, backendNodeId: 0 };
    }
    const frames = await firefox.webNavigation.getAllFrames({ tabId });
    const child = frames?.find((frame) => frame.frameId === childFrameId);
    if (child == null || child.parentFrameId < 0) {
      throw new Error("Firefox child frame is no longer available.");
    }
    const siblings = frames
      .filter((frame) => frame.parentFrameId === child.parentFrameId)
      .sort((left, right) => left.frameId - right.frameId);
    const childIndex = Math.max(0, siblings.findIndex((frame) => frame.frameId === childFrameId));
    return executeUserScript(
      tabId,
      operationScript(`
        const frames = [...document.querySelectorAll("iframe,frame")];
        const wantedUrl = ${JSON.stringify(child.url ?? "")};
        const matching = frames.filter((element) => {
          try { return new URL(element.getAttribute("src") || "about:blank", document.baseURI).href === wantedUrl; }
          catch { return false; }
        });
        const element = matching.length === 1
          ? matching[0]
          : matching[${JSON.stringify(childIndex)}] ?? frames[${JSON.stringify(childIndex)}] ?? null;
        if (!(element instanceof Element)) throw new Error("Firefox could not associate the child frame with its owner element.");
        const nodeId = __nodeId(element);
        return { nodeId, backendNodeId: nodeId };
      `),
      { frameId: child.parentFrameId },
    );
  }

  async function captureFrameDomSnapshot(tabId, params, frameId = 0) {
    return executeUserScript(
      tabId,
      operationScript(`
        const strings = [];
        const stringIndexes = new Map();
        const stringIndex = (value) => {
          const text = String(value ?? "");
          let index = stringIndexes.get(text);
          if (index == null) {
            index = strings.length;
            strings.push(text);
            stringIndexes.set(text, index);
          }
          return index;
        };
        const nodes = {
          parentIndex: [], nodeType: [], nodeName: [], nodeValue: [], backendNodeId: [], attributes: [],
        };
        const layout = { nodeIndex: [], styles: [], bounds: [], text: [], stackingContexts: { index: [] } };
        const walk = (node, parentIndex) => {
          const index = nodes.nodeType.length;
          nodes.parentIndex.push(parentIndex);
          nodes.nodeType.push(node.nodeType);
          nodes.nodeName.push(stringIndex(node.nodeName));
          nodes.nodeValue.push(stringIndex(node.nodeValue ?? ""));
          nodes.backendNodeId.push(__nodeId(node));
          nodes.attributes.push(node.nodeType === Node.ELEMENT_NODE
            ? [...node.attributes].flatMap((attribute) => [stringIndex(attribute.name), stringIndex(attribute.value)])
            : []);
          if (node instanceof Element || node.nodeType === Node.TEXT_NODE) {
            let bounds;
            if (node instanceof Element) {
              const box = node.getBoundingClientRect();
              bounds = [box.left, box.top, box.width, box.height];
            } else {
              const range = document.createRange();
              range.selectNode(node);
              const box = range.getBoundingClientRect();
              bounds = [box.left, box.top, box.width, box.height];
            }
            layout.nodeIndex.push(index);
            layout.styles.push([]);
            layout.bounds.push(bounds);
            layout.text.push(stringIndex(node.textContent ?? ""));
          }
          for (const child of node.childNodes ?? []) walk(child, index);
        };
        walk(document, -1);
        return {
          strings,
          documents: [{
            documentURL: stringIndex(location.href), title: stringIndex(document.title), baseURL: stringIndex(document.baseURI),
            contentLanguage: stringIndex(document.documentElement.lang), encodingName: stringIndex(document.characterSet),
            publicId: stringIndex(document.doctype?.publicId ?? ""), systemId: stringIndex(document.doctype?.systemId ?? ""),
            frameId: stringIndex(${JSON.stringify(cdpFrameId(tabId, frameId))}), nodes, layout, textBoxes: { layoutIndex: [], bounds: [], start: [], length: [] },
          }],
        };
      `),
      { frameId },
    );
  }

  async function captureDomSnapshot(tabId, params, frameId = 0) {
    if (frameId !== 0) return captureFrameDomSnapshot(tabId, params, frameId);
    const frames = await firefox.webNavigation.getAllFrames({ tabId }).catch(() => null);
    const snapshots = await Promise.all((frames ?? [{ frameId: 0 }]).map((frame) => captureFrameDomSnapshot(tabId, params, frame.frameId).catch(() => null)));
    const strings = [];
    const indexes = new Map();
    const stringIndex = (value) => {
      let index = indexes.get(value);
      if (index == null) { index = strings.length; strings.push(value); indexes.set(value, index); }
      return index;
    };
    const documents = [];
    for (const snapshot of snapshots) {
      if (snapshot?.documents?.[0] == null) continue;
      const document = snapshot.documents[0];
      const remap = (index) => stringIndex(snapshot.strings[index] ?? "");
      for (const key of ["documentURL", "title", "baseURL", "contentLanguage", "encodingName", "publicId", "systemId", "frameId"]) document[key] = remap(document[key]);
      document.nodes.nodeName = document.nodes.nodeName.map(remap);
      document.nodes.nodeValue = document.nodes.nodeValue.map(remap);
      document.nodes.attributes = document.nodes.attributes.map((attributes) => attributes.map(remap));
      document.layout.text = document.layout.text.map(remap);
      document.layout.styles = document.layout.styles.map((styles) => styles.map(remap));
      documents.push(document);
    }
    return { strings, documents };
  }

  async function hitTestFrame(tabId, frameId, x, y, frames, depth = 0) {
    if (depth > 16) return { frameId, x, y };
    const hit = await executeUserScript(
      tabId,
      operationScript(`
        const x = ${JSON.stringify(x)};
        const y = ${JSON.stringify(y)};
        const element = document.elementFromPoint(x, y);
        if (!(element instanceof HTMLIFrameElement || element instanceof HTMLFrameElement)) return null;
        const owners = [...document.querySelectorAll("iframe,frame")];
        const ownerIndex = owners.indexOf(element);
        const ownerUrl = (() => {
          try {
            const source = element.hasAttribute("srcdoc") ? "about:srcdoc" : (element.getAttribute("src") || "about:blank");
            return new URL(source, document.baseURI).href;
          } catch { return ""; }
        })();
        const sameUrlOwnerIndex = owners.slice(0, ownerIndex).filter((owner) => {
          try {
            const source = owner.hasAttribute("srcdoc") ? "about:srcdoc" : (owner.getAttribute("src") || "about:blank");
            return new URL(source, document.baseURI).href === ownerUrl;
          } catch { return false; }
        }).length;
        const rect = element.getBoundingClientRect();
        return {
          ownerIndex, sameUrlOwnerIndex, resolvedFrameUrl: ownerUrl,
          left: rect.left + element.clientLeft,
          top: rect.top + element.clientTop,
        };
      `),
      { frameId },
    ).catch(() => null);
    if (hit == null) return { frameId, x, y };
    const child = childFrameForOwner(frameId, hit, frames);
    if (child == null) return { frameId, x, y };
    return hitTestFrame(tabId, child.frameId, x - hit.left, y - hit.top, frames, depth + 1);
  }

  async function routePointToFrame(tabId, frameId, x, y) {
    if (frameId !== 0) return { frameId, x, y };
    const frames = await firefox.webNavigation.getAllFrames({ tabId }).catch(() => []);
    return hitTestFrame(tabId, frameId, x, y, frames ?? []);
  }

  async function focusedFrameId(tabId, frameId) {
    if (frameId !== 0) return frameId;
    const frames = await firefox.webNavigation.getAllFrames({ tabId }).catch(() => []);
    if (!Array.isArray(frames) || frames.length < 2) return frameId;
    const focus = await Promise.all(frames.map(async (frame) => ({
      frame,
      state: await executeUserScript(
        tabId,
        operationScript(`
          const active = document.activeElement;
          return {
            focused: document.hasFocus(),
            meaningful: active != null && active !== document.body && active !== document.documentElement,
            frameOwner: active instanceof HTMLIFrameElement || active instanceof HTMLFrameElement,
          };
        `),
        { frameId: frame.frameId },
      ).catch(() => null),
    })));
    const parentByFrame = new Map(frames.map((frame) => [frame.frameId, frame.parentFrameId]));
    const depthOf = (candidate) => {
      let depth = 0;
      let current = candidate;
      const seen = new Set();
      while (parentByFrame.has(current) && !seen.has(current)) {
        seen.add(current);
        const parent = parentByFrame.get(current);
        if (parent == null || parent < 0) break;
        depth += 1;
        current = parent;
      }
      return depth;
    };
    const candidates = focus
      .filter(({ state }) => state?.focused === true && state.meaningful === true && state.frameOwner !== true)
      .sort((left, right) => depthOf(right.frame.frameId) - depthOf(left.frame.frameId));
    return candidates[0]?.frame.frameId ?? frameId;
  }

  async function dispatchMouse(tabId, params, frameId = 0) {
    const routed = await routePointToFrame(tabId, frameId, Number(params.x) || 0, Number(params.y) || 0);
    frameId = routed.frameId;
    params = { ...params, x: routed.x, y: routed.y };
    const result = await executeUserScript(
      tabId,
      operationScript(`
        const event = ${JSON.stringify(params)};
        const x = Number(event.x ?? __state.pointer.x);
        const y = Number(event.y ?? __state.pointer.y);
        __state.pointer.x = x;
        __state.pointer.y = y;
        const target = document.elementFromPoint(x, y) ?? document.body ?? document.documentElement;
        const fileInput = target instanceof HTMLInputElement && target.type === "file" ? target : null;
        __state.pointer.element = target;
        const buttonNames = ["left", "middle", "right", "back", "forward"];
        const button = Math.max(0, buttonNames.indexOf(event.button));
        const buttons = Number(event.buttons ?? (event.type === "mouseReleased" ? 0 : 1 << button));
        const common = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, button, buttons, detail: event.clickCount ?? 1 };
        if (event.type === "mouseWheel") {
          target.dispatchEvent(new WheelEvent("wheel", { ...common, deltaX: event.deltaX ?? 0, deltaY: event.deltaY ?? 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
          window.scrollBy({ left: event.deltaX ?? 0, top: event.deltaY ?? 0, behavior: "instant" });
        } else if (event.type === "mouseMoved") {
          target.dispatchEvent(new PointerEvent("pointermove", { ...common, pointerId: 1, pointerType: "mouse", isPrimary: true }));
          target.dispatchEvent(new MouseEvent("mousemove", common));
          const drag = __state.drag;
          if (drag != null && (buttons & 1) !== 0) {
            const dragInit = { ...common, dataTransfer: drag.dataTransfer };
            if (!drag.started) {
              drag.started = drag.source.dispatchEvent(new DragEvent("dragstart", dragInit));
            }
            if (drag.started) {
              drag.source.dispatchEvent(new DragEvent("drag", dragInit));
              if (drag.target !== target) {
                drag.target?.dispatchEvent(new DragEvent("dragleave", dragInit));
                target.dispatchEvent(new DragEvent("dragenter", dragInit));
                drag.target = target;
              }
              target.dispatchEvent(new DragEvent("dragover", dragInit));
            }
          }
        } else if (event.type === "mousePressed") {
          target.dispatchEvent(new PointerEvent("pointerdown", { ...common, pointerId: 1, pointerType: "mouse", isPrimary: true }));
          target.dispatchEvent(new MouseEvent("mousedown", common));
          target.focus?.({ preventScroll: true });
          if (event.button === "left") {
            const source = target.closest?.('[draggable="true"]') ?? (target.draggable ? target : null);
            __state.drag = source == null ? null : { source, target: source, dataTransfer: new DataTransfer(), started: false };
          }
        } else if (event.type === "mouseReleased") {
          target.dispatchEvent(new PointerEvent("pointerup", { ...common, pointerId: 1, pointerType: "mouse", isPrimary: true }));
          target.dispatchEvent(new MouseEvent("mouseup", common));
          const drag = __state.drag;
          const completedDrag = drag?.started === true;
          if (completedDrag) {
            const dragInit = { ...common, dataTransfer: drag.dataTransfer };
            target.dispatchEvent(new DragEvent("dragover", dragInit));
            target.dispatchEvent(new DragEvent("drop", dragInit));
            drag.source.dispatchEvent(new DragEvent("dragend", dragInit));
          }
          __state.drag = null;
          if (completedDrag) {
            // A completed drag must not also activate the drop target as a click.
          } else if (event.button === "right") {
            target.dispatchEvent(new MouseEvent("contextmenu", common));
          } else if (!(fileInput && ${JSON.stringify(fileChooserInterceptByTab.get(tabId) === true)})) {
            target.click?.();
            if ((event.clickCount ?? 1) >= 2) target.dispatchEvent(new MouseEvent("dblclick", common));
          }
        }
        return event.type === "mouseReleased" && fileInput
          ? { fileChooser: { backendNodeId: __nodeId(fileInput), mode: fileInput.multiple ? "selectMultiple" : "selectSingle" } }
          : {};
      `),
      { frameId },
    );
    if (result?.fileChooser) {
      emitDebuggerEvent(tabId, "Page.fileChooserOpened", {
        frameId: cdpFrameId(tabId, frameId),
        mode: result.fileChooser.mode,
        backendNodeId: result.fileChooser.backendNodeId,
      });
    }
    return {};
  }

  async function dispatchTouch(tabId, params, frameId = 0) {
    if (frameId === 0 && (params.touchPoints?.length ?? 0) > 0) {
      const first = params.touchPoints[0];
      const routed = await routePointToFrame(tabId, frameId, Number(first.x) || 0, Number(first.y) || 0);
      if (routed.frameId !== frameId) {
        const dx = routed.x - (Number(first.x) || 0);
        const dy = routed.y - (Number(first.y) || 0);
        frameId = routed.frameId;
        params = { ...params, touchPoints: params.touchPoints.map((point) => ({ ...point, x: (Number(point.x) || 0) + dx, y: (Number(point.y) || 0) + dy })) };
      }
    }
    return executeUserScript(
      tabId,
      operationScript(`
        const event = ${JSON.stringify(params)};
        const points = event.touchPoints ?? [];
        __state.touches ??= new Map();
        const changed = [];
        for (const point of points) {
          const x = Number(point.x) || 0;
          const y = Number(point.y) || 0;
          const target = document.elementFromPoint(x, y) ?? document.body ?? document.documentElement;
          const init = { identifier: Number(point.id) || 0, target, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x + scrollX, pageY: y + scrollY,
            radiusX: Number(point.radiusX) || 1, radiusY: Number(point.radiusY) || 1, rotationAngle: Number(point.rotationAngle) || 0, force: Number(point.force) || 1 };
          let touch;
          try { touch = new Touch(init); } catch { touch = init; }
          changed.push(touch);
          if (event.type === "touchEnd" || event.type === "touchCancel") __state.touches.delete(init.identifier);
          else __state.touches.set(init.identifier, touch);
        }
        const active = [...__state.touches.values()];
        const target = changed[0]?.target ?? document.elementFromPoint(points[0]?.x ?? 0, points[0]?.y ?? 0) ?? document.body;
        const type = event.type === "touchStart" ? "touchstart" : event.type === "touchMove" ? "touchmove" : event.type === "touchCancel" ? "touchcancel" : "touchend";
        try {
          target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches: active, targetTouches: active.filter((touch) => touch.target === target), changedTouches: changed,
            altKey: Boolean(event.modifiers & 1), ctrlKey: Boolean(event.modifiers & 2), metaKey: Boolean(event.modifiers & 4), shiftKey: Boolean(event.modifiers & 8) }));
        } catch {
          for (const point of points) {
            target.dispatchEvent(new PointerEvent(type === "touchstart" ? "pointerdown" : type === "touchmove" ? "pointermove" : "pointerup", {
              bubbles: true, cancelable: true, composed: true, pointerId: Number(point.id) || 1, pointerType: "touch", isPrimary: (Number(point.id) || 0) === 0,
              clientX: Number(point.x) || 0, clientY: Number(point.y) || 0, pressure: Number(point.force) || 1,
            }));
          }
        }
        return {};
      `),
      { frameId },
    );
  }

  async function dispatchDrag(tabId, params, frameId = 0) {
    return executeUserScript(
      tabId,
      operationScript(`
        const event = ${JSON.stringify(params)};
        const x = Number(event.x ?? __state.pointer.x ?? 0);
        const y = Number(event.y ?? __state.pointer.y ?? 0);
        const target = document.elementFromPoint(x, y) ?? document.body ?? document.documentElement;
        if (event.type === "dragEnter" || __state.externalDrag == null) {
          const dataTransfer = new DataTransfer();
          for (const item of event.data?.items ?? []) {
            if (typeof item?.mimeType === "string" && typeof item?.data === "string") {
              dataTransfer.setData(item.mimeType, item.data);
            }
          }
          __state.externalDrag = { dataTransfer, target: null };
        }
        const drag = __state.externalDrag;
        const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, dataTransfer: drag.dataTransfer };
        if (drag.target !== target && event.type !== "dragCancel") {
          drag.target?.dispatchEvent(new DragEvent("dragleave", init));
          target.dispatchEvent(new DragEvent("dragenter", init));
          drag.target = target;
        }
        if (event.type === "dragEnter" || event.type === "dragOver") {
          target.dispatchEvent(new DragEvent("dragover", init));
        } else if (event.type === "drop") {
          target.dispatchEvent(new DragEvent("drop", init));
          __state.externalDrag = null;
        } else if (event.type === "dragCancel") {
          drag.target?.dispatchEvent(new DragEvent("dragleave", init));
          __state.externalDrag = null;
        }
        return {};
      `),
      { frameId },
    );
  }

  async function dispatchKeyboard(tabId, params, frameId = 0) {
    frameId = await focusedFrameId(tabId, frameId);
    return executeUserScript(
      tabId,
      operationScript(`
        const event = ${JSON.stringify(params)};
        const target = document.activeElement ?? document.body;
        const type = event.type === "keyUp" ? "keyup" : event.type === "char" ? "keypress" : "keydown";
        const key = event.key ?? event.text ?? event.code ?? "";
        const modifiers = Number(event.modifiers ?? 0);
        const init = { bubbles: true, cancelable: true, composed: true, key, code: event.code ?? "", repeat: event.autoRepeat === true,
          altKey: Boolean(modifiers & 1), ctrlKey: Boolean(modifiers & 2), metaKey: Boolean(modifiers & 4), shiftKey: Boolean(modifiers & 8) };
        const allowed = target.dispatchEvent(new KeyboardEvent(type, init));
        if (type === "keydown" && allowed) {
          const editable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
          const text = event.text ?? (event.type === "char" ? key : "");
          if (text && editable && !init.ctrlKey && !init.metaKey) {
            const start = target.selectionStart ?? target.value.length;
            const end = target.selectionEnd ?? start;
            target.setRangeText(text, start, end, "end");
            target.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: text, inputType: "insertText" }));
          } else if (text && target.isContentEditable && !init.ctrlKey && !init.metaKey) {
            document.execCommand("insertText", false, text);
          } else if (key === "Backspace" && editable) {
            const start = target.selectionStart ?? 0;
            const end = target.selectionEnd ?? start;
            const from = start === end ? Math.max(0, start - 1) : start;
            target.setRangeText("", from, end, "end");
            target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
          } else if (key === "Delete" && editable) {
            const start = target.selectionStart ?? 0;
            const end = target.selectionEnd ?? start;
            const to = start === end ? Math.min(target.value.length, end + 1) : end;
            target.setRangeText("", start, to, "start");
            target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentForward" }));
          } else if (key === "Enter") {
            if (target instanceof HTMLTextAreaElement) {
              const start = target.selectionStart ?? target.value.length;
              const end = target.selectionEnd ?? start;
              target.setRangeText("\\n", start, end, "end");
              target.dispatchEvent(new InputEvent("input", { bubbles: true, data: "\\n", inputType: "insertLineBreak" }));
            } else if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) {
              target.click();
            } else if (target instanceof HTMLInputElement && target.form) {
              target.form.requestSubmit?.();
            }
          } else if (key === "Tab") {
            const candidates = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
              .filter((element) => !element.disabled && element.getClientRects().length > 0);
            const index = candidates.indexOf(target);
            const next = candidates[(index + (init.shiftKey ? -1 : 1) + candidates.length) % candidates.length];
            next?.focus();
          } else if ((init.ctrlKey || init.metaKey) && key.toLowerCase() === "a" && editable) {
            target.select();
          }
        }
        return {};
      `),
      { frameId },
    );
  }

  async function insertText(tabId, text, frameId = 0) {
    frameId = await focusedFrameId(tabId, frameId);
    return executeUserScript(
      tabId,
      operationScript(`
        const target = document.activeElement ?? document.body;
        const text = ${JSON.stringify(text ?? "")};
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          const start = target.selectionStart ?? target.value.length;
          const end = target.selectionEnd ?? start;
          target.setRangeText(text, start, end, "end");
          target.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: text, inputType: "insertText" }));
        } else if (target?.isContentEditable) {
          document.execCommand("insertText", false, text);
        }
        return {};
      `),
      { frameId },
    );
  }

  async function synthesizeScroll(tabId, params, frameId = 0) {
    return executeUserScript(
      tabId,
      operationScript(`
        // CDP defines positive gesture distances as scrolling content left/up;
        // window.scrollBy uses the opposite sign convention.
        window.scrollBy({ left: ${-(Number(params.xDistance) || 0)}, top: ${-(Number(params.yDistance) || 0)}, behavior: "instant" });
        window.dispatchEvent(new Event("scroll", { bubbles: true }));
        return {};
      `),
      { frameId },
    );
  }

  async function setFileInputFiles(tabId, params, frameId = 0) {
    const payloads = Array.isArray(params._firefoxFilePayloads) ? params._firefoxFilePayloads : [];
    if (payloads.length === 0) {
      throw new Error(
        "Firefox requires the bundled native-host adapter to transfer local file bytes for DOM.setFileInputFiles.",
      );
    }

    return executeUserScript(
      tabId,
      operationScript(`
        const objectId = ${JSON.stringify(params.objectId ?? null)};
        const id = ${JSON.stringify(params.nodeId ?? params.backendNodeId ?? 0)};
        const input = objectId ? __state.objects.get(objectId) : __state.nodes.get(id);
        if (!(input instanceof HTMLInputElement) || input.type !== "file") {
          throw new Error("DOM.setFileInputFiles target is not a file input");
        }
        const payloads = ${JSON.stringify(payloads)};
        const transfer = new DataTransfer();
        for (const payload of payloads) {
          const binary = atob(payload.data);
          const bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
          transfer.items.add(new File([bytes], payload.name, { type: payload.type || "application/octet-stream", lastModified: payload.lastModified || Date.now() }));
        }
        input.files = transfer.files;
        input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        return {};
      `),
      { frameId },
    );
  }

  function cookieToCdp(cookie) {
    return {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expirationDate ?? -1,
      size: cookie.name.length + cookie.value.length,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      session: cookie.session,
      sameSite: cookie.sameSite === "no_restriction" ? "None" : cookie.sameSite === "strict" ? "Strict" : "Lax",
      priority: "Medium",
      sameParty: false,
      sourceScheme: cookie.secure ? "Secure" : "NonSecure",
      sourcePort: -1,
    };
  }

  function cookieUrl(params) {
    if (typeof params.url === "string") {
      return params.url;
    }
    const domain = String(params.domain ?? "").replace(/^\./u, "");
    const scheme = params.secure ? "https" : "http";
    return `${scheme}://${domain}${params.path || "/"}`;
  }

  async function setCookie(params) {
    const sameSite = params.sameSite === "None" ? "no_restriction" : params.sameSite === "Strict" ? "strict" : "lax";
    const details = {
      url: cookieUrl(params),
      name: params.name,
      value: params.value,
      path: params.path,
      secure: params.secure,
      httpOnly: params.httpOnly,
      sameSite,
    };
    if (Number.isFinite(params.expires) && params.expires > 0) {
      details.expirationDate = params.expires;
    }
    if (typeof params.domain === "string") {
      details.domain = params.domain;
    }
    const cookie = await firefox.cookies.set(details);
    return { success: cookie != null };
  }

  async function clearCookies() {
    const cookies = await firefox.cookies.getAll({});
    await Promise.allSettled(
      cookies.map((cookie) =>
        firefox.cookies.remove({
          url: `${cookie.secure ? "https" : "http"}://${cookie.domain.replace(/^\./u, "")}${cookie.path}`,
          name: cookie.name,
          storeId: cookie.storeId,
        }),
      ),
    );
    return {};
  }

  function cdpRequestId(requestId) {
    return `firefox-request-${requestId}`;
  }

  function webRequestResourceType(type) {
    switch (type) {
      case "main_frame": case "sub_frame": return "Document";
      case "stylesheet": return "Stylesheet";
      case "script": return "Script";
      case "image": case "imageset": return "Image";
      case "font": return "Font";
      case "media": return "Media";
      case "object": return "Other";
      case "xmlhttprequest": return "XHR";
      case "websocket": return "WebSocket";
      case "ping": case "beacon": return "Ping";
      default: return "Other";
    }
  }

  function headersArrayToObject(headers = []) {
    const result = {};
    for (const header of headers ?? []) {
      if (typeof header?.name !== "string") continue;
      result[header.name] = header.value ?? (header.binaryValue ? atob(header.binaryValue) : "");
    }
    return result;
  }

  function headersObjectToArray(headers = {}) {
    return Object.entries(headers ?? {}).map(([name, value]) => ({ name, value: String(value) }));
  }

  function requestBodyText(requestBody) {
    if (requestBody?.formData != null) {
      const form = new URLSearchParams();
      for (const [name, values] of Object.entries(requestBody.formData)) {
        for (const value of values ?? []) form.append(name, value);
      }
      return form.toString();
    }
    if (!Array.isArray(requestBody?.raw)) return undefined;
    const chunks = [];
    for (const item of requestBody.raw) {
      if (item?.bytes instanceof ArrayBuffer) chunks.push(new Uint8Array(item.bytes));
    }
    if (chunks.length === 0) return undefined;
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
    try { return new TextDecoder().decode(combined); } catch { return undefined; }
  }

  function wildcardPatternMatches(pattern, value) {
    if (pattern == null || pattern === "" || pattern === "*") return true;
    const source = String(pattern).replace(/[.+?^${}()|[\]\\]/gu, "\\$&").replace(/\*/gu, ".*");
    try { return new RegExp(`^${source}$`, "u").test(value); } catch { return false; }
  }

  function interceptionPatternMatches(pattern, details, stage, networkStyle = false) {
    const expectedStage = networkStyle
      ? (pattern.interceptionStage === "HeadersReceived" ? "Response" : "Request")
      : (pattern.requestStage ?? "Request");
    if (expectedStage !== stage) return false;
    if (!wildcardPatternMatches(pattern.urlPattern ?? "*", details.url)) return false;
    if (pattern.resourceType != null && pattern.resourceType !== webRequestResourceType(details.type)) return false;
    return true;
  }

  function networkRequestFromDetails(details, state = {}) {
    return {
      url: details.url,
      urlFragment: "",
      method: details.method ?? "GET",
      headers: state.requestHeaders ?? {},
      postData: state.postData,
      hasPostData: state.postData != null,
      mixedContentType: "none",
      initialPriority: "Medium",
      referrerPolicy: "no-referrer-when-downgrade",
    };
  }

  function responseHeadersForWebRequest(headers = []) {
    return (headers ?? []).map((header) => ({ name: header.name, value: header.value ?? "" }));
  }

  function responseHeadersForCdp(headers = []) {
    return Object.fromEntries((headers ?? []).map((header) => [header.name, header.value ?? ""]));
  }

  function requestFrameId(details) {
    return cdpFrameId(details.tabId, Math.max(0, Number(details.frameId) || 0));
  }

  function responseDataUrl(params) {
    const contentTypeHeader = (params.responseHeaders ?? []).find((header) => String(header.name).toLowerCase() === "content-type");
    const mimeType = contentTypeHeader?.value || "application/octet-stream";
    const body = typeof params.body === "string" ? params.body : "";
    return `data:${mimeType};base64,${body}`;
  }

  function settleInterception(requestId, blockingResponse = {}) {
    const pending = pendingInterceptions.get(requestId);
    if (pending == null) throw new Error("Firefox request interception is no longer pending.");
    clearTimeout(pending.timeoutId);
    pendingInterceptions.delete(requestId);
    pending.resolve(blockingResponse);
    return pending;
  }

  function pauseWebRequest(details, stage, responseDetails = null) {
    const fetchConfig = fetchConfigByTab.get(details.tabId);
    const fetchPatterns = fetchConfig?.patterns?.length ? fetchConfig.patterns : [{ urlPattern: "*", requestStage: "Request" }];
    const fetchMatches = fetchConfig != null && fetchPatterns.some((pattern) => interceptionPatternMatches(pattern, details, stage));
    const networkPatterns = networkInterceptionByTab.get(details.tabId) ?? [];
    const networkMatches = !fetchMatches && networkPatterns.some((pattern) => interceptionPatternMatches(pattern, details, stage, true));
    if (!fetchMatches && !networkMatches) return null;

    const kind = fetchMatches ? "fetch" : "network";
    const requestId = `${kind}-${details.tabId}-${details.requestId}-${stage.toLowerCase()}-${Date.now()}`;
    const state = networkRequests.get(cdpRequestId(details.requestId)) ?? {};
    const promise = new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        pendingInterceptions.delete(requestId);
        resolve({});
      }, 30_000);
      pendingInterceptions.set(requestId, { resolve, timeoutId, tabId: details.tabId, stage, details, state, kind });
    });

    if (fetchMatches) {
      emitDebuggerEvent(details.tabId, "Fetch.requestPaused", {
        requestId,
        request: networkRequestFromDetails(details, state),
        frameId: requestFrameId(details),
        resourceType: webRequestResourceType(details.type),
        networkId: cdpRequestId(details.requestId),
        ...(stage === "Response" ? {
          responseStatusCode: responseDetails?.statusCode ?? 200,
          responseStatusText: responseDetails?.statusLine?.split(" ").slice(2).join(" ") ?? "",
          responseHeaders: responseHeadersForWebRequest(responseDetails?.responseHeaders),
        } : {}),
      });
    } else {
      emitDebuggerEvent(details.tabId, "Network.requestIntercepted", {
        interceptionId: requestId,
        request: networkRequestFromDetails(details, state),
        frameId: requestFrameId(details),
        resourceType: webRequestResourceType(details.type),
        isNavigationRequest: details.type === "main_frame" || details.type === "sub_frame",
        ...(stage === "Response" ? {
          responseStatusCode: responseDetails?.statusCode ?? 200,
          responseHeaders: responseHeadersForCdp(responseDetails?.responseHeaders),
        } : {}),
      });
    }
    return promise;
  }

  function pauseAuthRequest(details) {
    if (details.tabId < 0 || fetchConfigByTab.get(details.tabId)?.handleAuthRequests !== true) return null;
    const requestId = `fetch-${details.tabId}-${details.requestId}-auth-${Date.now()}`;
    const state = networkRequests.get(cdpRequestId(details.requestId)) ?? {};
    const promise = new Promise((resolve) => {
      const timeoutId = setTimeout(() => { pendingInterceptions.delete(requestId); resolve({ cancel: true }); }, 30_000);
      pendingInterceptions.set(requestId, { resolve, timeoutId, tabId: details.tabId, stage: "Auth", details, state, kind: "fetch" });
    });
    emitDebuggerEvent(details.tabId, "Fetch.authRequired", {
      requestId,
      request: networkRequestFromDetails(details, state),
      frameId: requestFrameId(details),
      resourceType: webRequestResourceType(details.type),
      authChallenge: { source: details.isProxy ? "Proxy" : "Server", origin: details.challenger ? `${details.challenger.host}:${details.challenger.port}` : "", scheme: details.scheme ?? "", realm: details.realm ?? "" },
    });
    return promise;
  }

  function startResponseBodyCapture(details, state) {
    if (state.filterStarted || firefox.webRequest?.filterResponseData == null) return;
    if (!networkEnabledTabs.has(details.tabId) && fetchConfigByTab.get(details.tabId) == null) return;
    try {
      const filter = firefox.webRequest.filterResponseData(details.requestId);
      state.filterStarted = true;
      const chunks = [];
      let total = 0;
      let truncated = false;
      const downloadThroughput = Number(networkConditionsByTab.get(details.tabId)?.downloadThroughput) || -1;
      const writeQueue = [];
      let draining = false;
      let stopped = false;
      let disconnected = false;
      const finish = () => {
        if (disconnected) return;
        try { filter.close(); } catch {}
        const body = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
        networkBodies.set(cdpRequestId(details.requestId), { body, mimeType: state.mimeType ?? "", truncated });
      };
      const drain = () => {
        if (draining || disconnected) return;
        const next = writeQueue.shift();
        if (next == null) {
          if (stopped) finish();
          return;
        }
        draining = true;
        try { filter.write(next); } catch { disconnected = true; return; }
        const delay = Math.max(1, Math.ceil((next.byteLength / downloadThroughput) * 1000));
        setTimeout(() => { draining = false; drain(); }, Math.min(delay, 30_000));
      };
      filter.ondata = (event) => {
        const bytes = new Uint8Array(event.data);
        if (!truncated && total + bytes.length <= 32 * 1024 * 1024) {
          chunks.push(bytes.slice());
          total += bytes.length;
        } else {
          truncated = true;
        }
        if (downloadThroughput > 0) {
          writeQueue.push(bytes.slice().buffer);
          drain();
        } else {
          filter.write(event.data);
        }
      };
      filter.onstop = () => {
        stopped = true;
        if (downloadThroughput > 0) drain();
        else finish();
      };
      filter.onerror = () => { disconnected = true; try { filter.disconnect(); } catch {} };
    } catch {
      state.filterStarted = false;
    }
  }

  function bodyToBase64(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }

  function responseBodyResult(requestId) {
    const captured = networkBodies.get(requestId);
    if (captured == null) throw new Error("Firefox has not captured a response body for this request.");
    const textLike = /^(?:text\/|application\/(?:json|javascript|xml|xhtml\+xml))/iu.test(captured.mimeType);
    return textLike
      ? { body: new TextDecoder().decode(captured.body), base64Encoded: false }
      : { body: bodyToBase64(captured.body), base64Encoded: true };
  }

  async function loadNetworkResource(params) {
    const response = await fetch(params.url, { credentials: "include", redirect: "follow" });
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    const stream = `firefox-stream-${nextStreamId++}`;
    ioStreams.set(stream, { data: btoa(binary), offset: 0 });
    return {
      resource: {
        success: response.ok,
        httpStatusCode: response.status,
        stream,
        headers: Object.fromEntries(response.headers.entries()),
      },
    };
  }

  function cdpResourceType(initiatorType) {
    switch (initiatorType) {
      case "document": return "Document";
      case "css": case "link": return "Stylesheet";
      case "script": return "Script";
      case "img": case "image": return "Image";
      case "font": return "Font";
      case "audio": case "video": case "media": return "Media";
      case "xmlhttprequest": return "XHR";
      case "fetch": return "Fetch";
      default: return "Other";
    }
  }

  async function emitNetworkResources(tabId) {
    if (!networkEnabledTabs.has(tabId) || !debuggerAttachedTabs.has(tabId)) return;
    let resources;
    try {
      resources = await executeUserScript(
        tabId,
        operationScript(`
          const entries = performance.getEntriesByType("resource").map((entry) => ({
            url: entry.name,
            initiatorType: entry.initiatorType || "other",
            encodedBodySize: entry.encodedBodySize || entry.transferSize || 0,
          }));
          return [{ url: location.href, initiatorType: "document", encodedBodySize: 0 }, ...entries];
        `),
      );
    } catch {
      return;
    }

    const seen = new Set();
    let index = 0;
    for (const resource of resources ?? []) {
      if (typeof resource?.url !== "string" || !/^https?:/iu.test(resource.url) || seen.has(resource.url)) continue;
      seen.add(resource.url);
      index += 1;
      const requestId = `firefox-resource-${tabId}-${Date.now()}-${index}`;
      const loaderId = `firefox-loader-${tabId}`;
      const timestamp = performance.now() / 1000;
      const type = cdpResourceType(resource.initiatorType);
      emitDebuggerEvent(tabId, "Network.requestWillBeSent", {
        requestId,
        loaderId,
        documentURL: resource.url,
        request: { url: resource.url, method: "GET", headers: {}, mixedContentType: "none", initialPriority: "Medium", referrerPolicy: "no-referrer-when-downgrade" },
        timestamp,
        wallTime: Date.now() / 1000,
        initiator: { type: "other" },
        type,
        frameId: `firefox-frame-${tabId}`,
      });

      try {
        let response = await fetch(resource.url, { method: "HEAD", credentials: "include", redirect: "follow" });
        if (!response.ok && response.status === 405) {
          response = await fetch(resource.url, { credentials: "include", redirect: "follow" });
        }
        const headers = Object.fromEntries(response.headers.entries());
        const mimeType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim();
        emitDebuggerEvent(tabId, "Network.responseReceived", {
          requestId,
          loaderId,
          timestamp: performance.now() / 1000,
          type,
          frameId: `firefox-frame-${tabId}`,
          hasExtraInfo: false,
          response: {
            url: response.url || resource.url,
            status: response.status,
            statusText: response.statusText,
            headers,
            mimeType,
            charset: "",
            connectionReused: false,
            connectionId: 0,
            encodedDataLength: Number(resource.encodedBodySize) || 0,
            securityState: response.url.startsWith("https:") ? "secure" : "neutral",
            protocol: new URL(response.url || resource.url).protocol.replace(":", ""),
          },
        });
        emitDebuggerEvent(tabId, "Network.loadingFinished", {
          requestId,
          timestamp: performance.now() / 1000,
          encodedDataLength: Number(resource.encodedBodySize) || Number(response.headers.get("content-length")) || 0,
        });
      } catch (error) {
        emitDebuggerEvent(tabId, "Network.loadingFailed", {
          requestId,
          timestamp: performance.now() / 1000,
          type,
          errorText: error?.message ?? String(error),
          canceled: false,
        });
      }
    }
  }

  async function sendDebuggerCommand(debuggee, method, params = {}) {
    if (method === "Target.getTargets") {
      return { targetInfos: await getDebuggerTargets() };
    }

    const tabId = resolveTabId(debuggee);
    let frameId = findCommandFrameId(tabId, debuggee, params);
    if (
      frameId === 0 &&
      method === "Runtime.evaluate" &&
      typeof params.expression === "string" &&
      params.expression.includes("Browser Use virtual clipboard") &&
      params.expression.includes("clipboardItems")
    ) {
      // Chromium can run the Browser Use clipboard helper against the focused
      // cross-origin frame through its renderer target. Firefox exposes no
      // equivalent frame target to extensions, so tunnel this specific focused
      // evaluation into the frame where the editable element was focused.
      frameId = await focusedFrameId(tabId, frameId);
    }
    params = localizePageReferences(params, tabId);
    if (!debuggerAttachedTabs.has(tabId) && !method.startsWith("Target.")) {
      throw new Error("Debugger is not attached to this Firefox tab.");
    }

    switch (method) {
      case "Browser.getVersion": {
        const info = await firefox.runtime.getBrowserInfo();
        return {
          protocolVersion: "1.3",
          product: `${info.name}/${info.version}`,
          revision: info.buildID ?? "",
          userAgent: navigator.userAgent,
          jsVersion: "",
        };
      }
      case "Browser.getWindowForTarget": {
        const tab = await firefox.tabs.get(tabId);
        const window = await firefox.windows.get(tab.windowId);
        return { windowId: tab.windowId, bounds: { left: window.left, top: window.top, width: window.width, height: window.height, windowState: window.state } };
      }
      case "Browser.getWindowBounds": {
        const window = await firefox.windows.get(params.windowId);
        return { bounds: { left: window.left, top: window.top, width: window.width, height: window.height, windowState: window.state } };
      }
      case "Browser.setWindowBounds": {
        const bounds = { ...params.bounds };
        if (bounds.windowState != null) { bounds.state = bounds.windowState; delete bounds.windowState; }
        await firefox.windows.update(params.windowId, bounds);
        return {};
      }
      case "Target.setAutoAttach":
        autoAttachByTab.set(tabId, { ...params });
        queueMicrotask(() => void emitAutoAttachedFrames(tabId));
        return {};
      case "Target.setDiscoverTargets":
        return {};
      case "Target.attachToTarget": {
        const target = targetFrameById.get(params.targetId);
        if (target?.tabId !== tabId) throw new Error("Firefox frame target was not found.");
        return { sessionId: sessionIdForFrame(tabId, target.frameId) };
      }
      case "Target.detachFromTarget": {
        const session = sessionFrameById.get(params.sessionId);
        if (session?.tabId === tabId) {
          sessionFrameById.delete(params.sessionId);
          sessionIdByFrame.delete(frameKey(tabId, session.frameId));
          emitDebuggerEvent(tabId, "Target.detachedFromTarget", { sessionId: params.sessionId, targetId: frameTargetId(tabId, session.frameId) });
        }
        return {};
      }
      case "Target.getTargetInfo": {
        const frame = targetFrameById.get(params.targetId);
        if (frame?.tabId === tabId) {
          const entries = await firefox.webNavigation.getAllFrames({ tabId });
          const entry = entries?.find((candidate) => candidate.frameId === frame.frameId);
          return { targetInfo: frameTargetInfo(tabId, entry ?? { frameId: frame.frameId, url: "about:blank" }) };
        }
        const tab = await firefox.tabs.get(tabId);
        return { targetInfo: { targetId: tabTargetId(tabId), type: "page", title: tab.title ?? "", url: tab.url ?? "", attached: debuggerAttachedTabs.has(tabId) } };
      }
      case "Target.closeTarget":
      case "Page.close":
        await firefox.tabs.remove(tabId);
        return method === "Target.closeTarget" ? { success: true } : {};
      case "Runtime.enable":
        queueMicrotask(async () => {
          const frame = await firefox.webNavigation.getFrame({ tabId, frameId }).catch(() => null);
          emitExecutionContext(tabId, frameId, debuggee.sessionId ?? null, frame?.url ?? "");
        });
        return {};
      case "Runtime.disable":
        return {};
      case "Runtime.evaluate":
        return evaluateRuntime(tabId, params, frameId);
      case "Runtime.callFunctionOn":
        return callRuntimeFunction(tabId, params, frameId);
      case "Runtime.getProperties":
        return getRuntimeProperties(tabId, params, frameId);
      case "Runtime.compileScript":
        return executeUserScript(tabId, operationScript(`const scriptId = "firefox-script-" + __state.nextScriptId++; __state.compiledScripts.set(scriptId, ${JSON.stringify(params.expression ?? "")}); return { scriptId };`), { frameId });
      case "Runtime.runScript":
        return executeUserScript(tabId, `(async () => { ${PAGE_PREAMBLE} try { const source = __state.compiledScripts.get(${JSON.stringify(params.scriptId)}); if (source == null) throw new Error("Compiled script not found"); const value = await (0, eval)(source); return JSON.stringify({ok:true,value:{result:__remote(value,${JSON.stringify(params.returnByValue === true)},${JSON.stringify(params.objectGroup ?? null)})}}); } catch(error) { return JSON.stringify({ok:true,value:{result:{type:"undefined"},exceptionDetails:__exception(error)}}); } })()`, { frameId });
      case "Runtime.awaitPromise":
        return callRuntimeFunction(tabId, { objectId: params.promiseObjectId, functionDeclaration: "function () { return this; }", awaitPromise: true, returnByValue: params.returnByValue, objectGroup: params.objectGroup }, frameId);
      case "Runtime.globalLexicalScopeNames":
        return executeUserScript(tabId, operationScript(`return { names: Object.getOwnPropertyNames(globalThis) };`), { frameId });
      case "Runtime.runIfWaitingForDebugger":
        return {};
      case "Runtime.releaseObject":
        await executeUserScript(
          tabId,
          operationScript(`__state.objects.delete(${JSON.stringify(params.objectId)}); __state.objectGroups.delete(${JSON.stringify(params.objectId)}); return {};`),
          { frameId },
        );
        return {};
      case "Runtime.releaseObjectGroup":
        await executeUserScript(
          tabId,
          operationScript(`for (const [id, group] of __state.objectGroups) { if (group === ${JSON.stringify(params.objectGroup)}) { __state.objectGroups.delete(id); __state.objects.delete(id); } } return {};`),
          { frameId },
        );
        return {};
      case "Runtime.addBinding": {
        const names = bindingNamesByTab.get(tabId) ?? new Set();
        names.add(params.name);
        bindingNamesByTab.set(tabId, names);
        await installBinding(tabId, params.name, frameId);
        return {};
      }
      case "Runtime.removeBinding": {
        bindingNamesByTab.get(tabId)?.delete(params.name);
        await executeUserScript(
          tabId,
          operationScript(`delete globalThis[${JSON.stringify(params.name)}]; return {};`),
          { frameId },
        );
        return {};
      }
      case "Page.enable":
      case "Page.disable":
      case "Page.setAdBlockingEnabled":
      case "Page.setDownloadBehavior":
      case "Page.setRPHRegistrationMode":
      case "Page.setSPCTransactionMode":
        return {};
      case "Page.setBypassCSP":
        if (params.enabled === true) bypassCspTabs.add(tabId);
        else bypassCspTabs.delete(tabId);
        return {};
      case "Page.setInterceptFileChooserDialog":
        fileChooserInterceptByTab.set(tabId, params.enabled !== false);
        return {};
      case "Page.addScriptToEvaluateOnNewDocument": {
        const identifier = `firefox-init-${nextInitScriptId++}`;
        const scripts = initScriptsByTab.get(tabId) ?? new Map();
        scripts.set(identifier, params.source ?? "");
        initScriptsByTab.set(tabId, scripts);
        await reapplyPageState(tabId);
        return { identifier };
      }
      case "Page.removeScriptToEvaluateOnNewDocument":
        initScriptsByTab.get(tabId)?.delete(params.identifier);
        return {};
      case "Page.addScriptToEvaluateOnLoad": {
        const identifier = `firefox-init-${nextInitScriptId++}`;
        const scripts = initScriptsByTab.get(tabId) ?? new Map();
        scripts.set(identifier, params.scriptSource ?? params.source ?? "");
        initScriptsByTab.set(tabId, scripts);
        await reapplyPageState(tabId);
        return { identifier };
      }
      case "Page.createIsolatedWorld":
        return { executionContextId: executionContextIdForFrame(frameId) };
      case "Page.getFrameTree":
      case "Page.getResourceTree":
        return getFrameTree(tabId);
      case "Page.getLayoutMetrics":
        return getLayoutMetrics(tabId, frameId);
      case "Page.bringToFront":
        await firefox.tabs.update(tabId, { active: true });
        return {};
      case "Page.stopLoading":
        await executeUserScript(tabId, operationScript(`window.stop(); return {};`), { frameId });
        return {};
      case "Page.captureSnapshot": {
        const data = await executeUserScript(tabId, operationScript(`return "<!DOCTYPE html>\n" + document.documentElement.outerHTML;`), { frameId });
        return { data };
      }
      case "Page.getAppManifest": {
        const manifestUrl = await executeUserScript(tabId, operationScript(`return document.querySelector('link[rel="manifest"]')?.href ?? "";`), { frameId });
        if (!manifestUrl) return { url: "", errors: [], data: "" };
        try {
          const response = await fetch(manifestUrl, { credentials: "include" });
          return { url: manifestUrl, errors: response.ok ? [] : [{ message: response.statusText, critical: 0, line: 0, column: 0 }], data: await response.text() };
        } catch (error) {
          return { url: manifestUrl, errors: [{ message: error?.message ?? String(error), critical: 0, line: 0, column: 0 }], data: "" };
        }
      }
      case "Page.getInstallabilityErrors":
        return { installabilityErrors: [] };
      case "Page.navigate": {
        if (frameId === 0) await firefox.tabs.update(tabId, { url: params.url });
        else await executeUserScript(tabId, operationScript(`location.href = ${JSON.stringify(params.url)}; return {};`), { frameId });
        return { frameId: cdpFrameId(tabId, frameId), loaderId: `firefox-loader-${tabId}-${frameId}-${Date.now()}` };
      }
      case "Page.reload":
        if (frameId === 0) await firefox.tabs.reload(tabId, { bypassCache: params.ignoreCache === true });
        else await executeUserScript(tabId, operationScript(`location.reload(); return {};`), { frameId });
        return {};
      case "Page.getNavigationHistory": {
        const tab = await firefox.tabs.get(tabId);
        rememberNavigation(tabId, tab.url ?? tab.pendingUrl ?? "about:blank", tab.title ?? "");
        const state = navigationStateByTab.get(tabId);
        return { currentIndex: state.currentIndex, entries: state.entries };
      }
      case "Page.navigateToHistoryEntry": {
        const state = navigationStateByTab.get(tabId);
        const index = state?.entries.findIndex((entry) => entry.id === params.entryId) ?? -1;
        if (state == null || index < 0) {
          throw new Error("Navigation history entry not found.");
        }
        state.currentIndex = index;
        await firefox.tabs.update(tabId, { url: state.entries[index].url });
        return {};
      }
      case "Page.captureScreenshot":
        return captureScreenshot(tabId, params);
      case "Page.handleJavaScriptDialog": {
        const dialogKey = frameKey(tabId, frameId);
        const pendingDialog = pendingDialogsByFrame.get(dialogKey);
        const response = {
          type: "CHATGPT_FIREFOX_DIALOG_RESPONSE",
          accept: params.accept === true,
          promptText: params.promptText ?? "",
          replay: pendingDialog?.dialogType === "confirm" || pendingDialog?.dialogType === "prompt",
        };
        let delivered = false;
        if (typeof firefox.tabs.sendMessage === "function") {
          try {
            const result = await firefox.tabs.sendMessage(tabId, response, { frameId });
            delivered = result?.ok === true;
          } catch {}
        }
        if (!delivered) {
          await executeUserScript(
            tabId,
            operationScript(`
              globalThis.__chatgptFirefoxNextDialogResponse = ${JSON.stringify({ accept: params.accept === true, promptText: params.promptText ?? "" })};
              const trigger = globalThis.__chatgptFirefoxPendingDialogTrigger;
              delete globalThis.__chatgptFirefoxPendingDialogTrigger;
              if (${JSON.stringify(response.replay)} && trigger?.isConnected && typeof trigger.click === "function") trigger.click();
              return {};
            `),
            { frameId },
          );
        }
        if (pendingDialogsByFrame.delete(dialogKey)) {
          emitDebuggerEvent(tabId, "Page.javascriptDialogClosed", {
            result: params.accept === true,
            userInput: params.promptText ?? "",
          }, debuggee.sessionId ?? null);
        }
        return {};
      }
      case "Page.resetNavigationHistory": {
        const tab = await firefox.tabs.get(tabId);
        navigationStateByTab.set(tabId, {
          currentIndex: 0,
          entries: [{ id: 1, url: tab.url ?? "about:blank", userTypedURL: tab.url ?? "about:blank", title: tab.title ?? "", transitionType: "other" }],
        });
        return {};
      }
      case "Page.getResourceContent": {
        const response = await fetch(params.url, { credentials: "include" });
        const buffer = new Uint8Array(await response.arrayBuffer());
        const type = response.headers.get("content-type") ?? "";
        const textLike = /^(?:text\/|application\/(?:json|javascript|xml|xhtml\+xml))/iu.test(type);
        if (textLike) {
          return { content: new TextDecoder().decode(buffer), base64Encoded: false };
        }
        let binary = "";
        for (let offset = 0; offset < buffer.length; offset += 0x8000) {
          binary += String.fromCharCode(...buffer.subarray(offset, offset + 0x8000));
        }
        return { content: btoa(binary), base64Encoded: true };
      }
      case "DOM.getDocument":
        return getDocument(tabId, params, frameId);
      case "DOM.querySelector":
        return querySelector(tabId, params, frameId);
      case "DOM.querySelectorAll":
        return executeUserScript(tabId, operationScript(`const root=__state.nodes.get(${JSON.stringify(params.nodeId)})??document; return {nodeIds:[...(root.querySelectorAll?.(${JSON.stringify(params.selector)})??[])].map(__nodeId)};`), { frameId });
      case "DOM.getAttributes":
        return executeUserScript(tabId, operationScript(`const node=__state.nodes.get(${JSON.stringify(params.nodeId)}); return {attributes:node instanceof Element?[...node.attributes].flatMap(attribute=>[attribute.name,attribute.value]):[]};`), { frameId });
      case "DOM.setAttributeValue":
        await executeUserScript(tabId, operationScript(`const node=__state.nodes.get(${JSON.stringify(params.nodeId)}); if(!(node instanceof Element)) throw new Error("DOM element not found"); node.setAttribute(${JSON.stringify(params.name)},${JSON.stringify(params.value)}); return {};`), { frameId });
        return {};
      case "DOM.removeAttribute":
        await executeUserScript(tabId, operationScript(`const node=__state.nodes.get(${JSON.stringify(params.nodeId)}); if(!(node instanceof Element)) throw new Error("DOM element not found"); node.removeAttribute(${JSON.stringify(params.name)}); return {};`), { frameId });
        return {};
      case "DOM.getOuterHTML":
        return executeUserScript(tabId, operationScript(`const node=__state.nodes.get(${JSON.stringify(params.nodeId ?? params.backendNodeId ?? 0)})??__state.objects.get(${JSON.stringify(params.objectId ?? null)}); return {outerHTML:node?.outerHTML??new XMLSerializer().serializeToString(node)};`), { frameId });
      case "DOM.setOuterHTML":
        await executeUserScript(tabId, operationScript(`const node=__state.nodes.get(${JSON.stringify(params.nodeId)}); if(!(node instanceof Element)) throw new Error("DOM element not found"); node.outerHTML=${JSON.stringify(params.outerHTML ?? "")}; return {};`), { frameId });
        return {};
      case "DOM.removeNode":
        await executeUserScript(tabId, operationScript(`const node=__state.nodes.get(${JSON.stringify(params.nodeId)}); node?.remove?.(); return {};`), { frameId });
        return {};
      case "DOM.setNodeValue":
        await executeUserScript(tabId, operationScript(`const node=__state.nodes.get(${JSON.stringify(params.nodeId)}); if(node) node.nodeValue=${JSON.stringify(params.value ?? "")}; return {};`), { frameId });
        return {};
      case "DOM.requestChildNodes": {
        const result = await executeUserScript(tabId, operationScript(`
          const parent=__state.nodes.get(${JSON.stringify(params.nodeId)}); if(!parent) throw new Error("DOM node not found");
          const serialize=node=>{const nodeId=__nodeId(node);return{nodeId,backendNodeId:nodeId,nodeType:node.nodeType,nodeName:node.nodeName,localName:node.localName??"",nodeValue:node.nodeValue??"",childNodeCount:node.childNodes?.length??0,attributes:node instanceof Element?[...node.attributes].flatMap(attribute=>[attribute.name,attribute.value]):[]}};
          return {parentId:__nodeId(parent),nodes:[...(parent.childNodes??[])].map(serialize)};
        `), { frameId });
        emitDebuggerEvent(tabId, "DOM.setChildNodes", { parentId: result.parentId, nodes: result.nodes }, debuggee.sessionId ?? null);
        return {};
      }
      case "DOM.performSearch":
        return executeUserScript(tabId, operationScript(`const searchId="firefox-search-"+__state.nextSearchId++;let results=[];try{results=[...document.querySelectorAll(${JSON.stringify(params.query ?? "")})]}catch{const walker=document.createTreeWalker(document,NodeFilter.SHOW_ALL);for(let node=walker.currentNode;node;node=walker.nextNode())if((node.textContent??"").includes(${JSON.stringify(params.query ?? "")}))results.push(node)}__state.searchResults.set(searchId,results);return{searchId,resultCount:results.length};`), { frameId });
      case "DOM.getSearchResults":
        return executeUserScript(tabId, operationScript(`const results=__state.searchResults.get(${JSON.stringify(params.searchId)})??[];return{nodeIds:results.slice(${Number(params.fromIndex) || 0},${Number(params.toIndex) || 0}).map(__nodeId)};`), { frameId });
      case "DOM.discardSearchResults":
        await executeUserScript(tabId, operationScript(`__state.searchResults.delete(${JSON.stringify(params.searchId)});return{};`), { frameId });
        return {};
      case "DOM.describeNode":
        return describeNode(tabId, params, frameId);
      case "DOM.resolveNode":
        return resolveNode(tabId, params, frameId);
      case "DOM.requestNode":
        return requestNode(tabId, params, frameId);
      case "DOM.getFileInfo":
        return { path: "" };
      case "DOM.getFrameOwner":
        return getFrameOwner(tabId, params, frameId);
      case "DOM.getBoxModel":
        return getBoxModel(tabId, params, frameId);
      case "DOM.getContentQuads":
        return getContentQuads(tabId, params, frameId);
      case "DOM.scrollIntoViewIfNeeded":
        return scrollIntoView(tabId, params, frameId);
      case "DOM.getNodeForLocation":
        return nodeForLocation(tabId, params, frameId);
      case "DOM.focus":
        await executeUserScript(
          tabId,
          operationScript(`const node = __state.nodes.get(${JSON.stringify(params.nodeId ?? params.backendNodeId ?? 0)}) ?? __state.objects.get(${JSON.stringify(params.objectId ?? null)}); node?.focus?.(); return {};`),
          { frameId },
        );
        return {};
      case "DOM.setFileInputFiles":
        return setFileInputFiles(tabId, params, frameId);
      case "DOMSnapshot.captureSnapshot":
        return captureDomSnapshot(tabId, params, frameId);
      case "Accessibility.enable":
      case "Accessibility.disable":
        return {};
      case "Accessibility.getFullAXTree":
        return getAccessibilityTree(tabId, frameId);
      case "Accessibility.getRootAXNode": {
        const tree = await getAccessibilityTree(tabId, frameId);
        return { node: tree.nodes[0] };
      }
      case "Accessibility.getPartialAXTree":
        return getAccessibilityTree(tabId, frameId, params.backendNodeId ?? params.nodeId ?? null);
      case "Accessibility.queryAXTree": {
        const tree = await getAccessibilityTree(tabId, frameId, params.backendNodeId ?? params.nodeId ?? null);
        const role = params.role;
        const name = params.accessibleName;
        return { nodes: tree.nodes.filter((node) => (role == null || node.role?.value === role) && (name == null || node.name?.value?.includes(name))) };
      }
      case "Input.dispatchMouseEvent":
        return dispatchMouse(tabId, params, frameId);
      case "Input.dispatchKeyEvent":
        return dispatchKeyboard(tabId, params, frameId);
      case "Input.dispatchTouchEvent":
        return dispatchTouch(tabId, params, frameId);
      case "Input.insertText":
        return insertText(tabId, params.text, frameId);
      case "Input.cancelDragging":
        return dispatchDrag(tabId, { type: "dragCancel", x: 0, y: 0 }, frameId);
      case "Input.synthesizeScrollGesture":
        return synthesizeScroll(tabId, params, frameId);
      case "Input.setInterceptDrags":
        return {};
      case "Input.dispatchDragEvent":
        return dispatchDrag(tabId, params, frameId);
      case "Emulation.setFocusEmulationEnabled":
        mutableEmulationState(tabId).focus = params.enabled === true;
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setDeviceMetricsOverride":
        await setViewportOverride(tabId, params);
        return {};
      case "Emulation.clearDeviceMetricsOverride":
        await clearViewportOverride(tabId);
        return {};
      case "Emulation.setTouchEmulationEnabled":
        mutableEmulationState(tabId).touch = { enabled: params.enabled === true, maxTouchPoints: params.maxTouchPoints };
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setUserAgentOverride":
        mutableEmulationState(tabId).userAgent = { userAgent: params.userAgent, acceptLanguage: params.acceptLanguage, platform: params.platform, userAgentMetadata: params.userAgentMetadata };
        userAgentByTab.set(tabId, mutableEmulationState(tabId).userAgent);
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setGeolocationOverride":
        mutableEmulationState(tabId).geolocation = { ...params };
        await applyEmulationState(tabId);
        return {};
      case "Emulation.clearGeolocationOverride":
        delete mutableEmulationState(tabId).geolocation;
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setLocaleOverride":
        if (params.locale) mutableEmulationState(tabId).locale = params.locale;
        else delete mutableEmulationState(tabId).locale;
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setTimezoneOverride":
        if (params.timezoneId) mutableEmulationState(tabId).timezone = params.timezoneId;
        else delete mutableEmulationState(tabId).timezone;
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setHardwareConcurrencyOverride":
        mutableEmulationState(tabId).hardwareConcurrency = Math.max(1, Number(params.hardwareConcurrency) || 1);
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setEmulatedMedia":
        mutableEmulationState(tabId).media = { media: params.media ?? "", features: [...(params.features ?? [])] };
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setAutomationOverride":
        mutableEmulationState(tabId).automationOverride = params.enabled === true;
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setDataSaverOverride":
        mutableEmulationState(tabId).dataSaver = params.dataSaverEnabled === true;
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setScrollbarsHidden":
        mutableEmulationState(tabId).scrollbarsHidden = params.hidden === true;
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setDefaultBackgroundColorOverride":
        mutableEmulationState(tabId).backgroundColor = params.color ?? null;
        await applyEmulationState(tabId);
        return {};
      case "Emulation.setPageScaleFactor":
        await firefox.tabs.setZoom(tabId, Math.max(0.3, Math.min(5, Number(params.pageScaleFactor) || 1)));
        return {};
      case "Emulation.resetPageScaleFactor":
        await firefox.tabs.setZoom(tabId, 1);
        return {};
      case "Performance.getMetrics":
        return executeUserScript(tabId, operationScript(`
          const all=document.querySelectorAll("*");
          return {metrics:[
            {name:"Timestamp",value:performance.now()/1000},{name:"Documents",value:1+document.querySelectorAll("iframe,frame").length},
            {name:"Frames",value:window.frames.length},{name:"JSEventListeners",value:0},{name:"Nodes",value:all.length},
            {name:"LayoutCount",value:performance.getEntriesByType("layout-shift").length},{name:"RecalcStyleCount",value:0},
            {name:"JSHeapUsedSize",value:performance.memory?.usedJSHeapSize??0},{name:"JSHeapTotalSize",value:performance.memory?.totalJSHeapSize??0}
          ]};
        `), { frameId });
      case "Performance.setTimeDomain":
        return {};
      case "Network.enable":
        networkEnabledTabs.add(tabId);
        void emitNetworkResources(tabId);
        return {};
      case "Network.disable":
        networkEnabledTabs.delete(tabId);
        return {};
      case "Network.continueInterceptedRequest": {
        if (params.errorReason != null) {
          settleInterception(params.interceptionId, { cancel: true });
          return {};
        }
        if (typeof params.rawResponse === "string") {
          const raw = atob(params.rawResponse);
          const separator = raw.indexOf("\r\n\r\n");
          const headerText = separator >= 0 ? raw.slice(0, separator) : "HTTP/1.1 200 OK";
          const body = separator >= 0 ? raw.slice(separator + 4) : raw;
          const headerLines = headerText.split("\r\n").slice(1);
          const responseHeaders = headerLines.map((line) => {
            const colon = line.indexOf(":");
            return colon < 0 ? null : { name: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim() };
          }).filter(Boolean);
          const mimeType = responseHeaders.find((header) => header.name.toLowerCase() === "content-type")?.value ?? "application/octet-stream";
          const bodyBase64 = btoa(body);
          settleInterception(params.interceptionId, { redirectUrl: `data:${mimeType};base64,${bodyBase64}` });
          return {};
        }
        const pending = pendingInterceptions.get(params.interceptionId);
        if (pending?.state != null && params.headers != null) pending.state.continuedRequestHeaders = params.headers;
        settleInterception(params.interceptionId, params.url ? { redirectUrl: params.url } : {});
        return {};
      }
      case "Network.deleteDeviceBoundSession":
      case "Network.configureDurableMessages":
      case "Network.enableDeviceBoundSessions":
      case "Network.setCookieControls":
        return {};
      case "Network.setExtraHTTPHeaders":
        extraHttpHeadersByTab.set(tabId, { ...(params.headers ?? {}) });
        return {};
      case "Network.setRequestInterception":
        if ((params.patterns ?? []).length === 0) networkInterceptionByTab.delete(tabId);
        else networkInterceptionByTab.set(tabId, [...params.patterns]);
        return {};
      case "Network.setBlockedURLs":
        blockedUrlPatternsByTab.set(tabId, [...(params.urls ?? [])]);
        return {};
      case "Network.setCacheDisabled":
        if (params.cacheDisabled === true) cacheDisabledTabs.add(tabId);
        else cacheDisabledTabs.delete(tabId);
        return {};
      case "Network.emulateNetworkConditions":
        networkConditionsByTab.set(tabId, { offline: params.offline === true, latency: Number(params.latency) || 0, downloadThroughput: Number(params.downloadThroughput) || -1, uploadThroughput: Number(params.uploadThroughput) || -1 });
        return {};
      case "Network.clearBrowserCache":
        await firefox.browsingData.removeCache({});
        return {};
      case "Network.getRequestPostData": {
        const state = networkRequests.get(params.requestId);
        if (state?.postData == null) throw new Error("Firefox did not capture request post data.");
        return { postData: state.postData };
      }
      case "Network.getResponseBody":
        return responseBodyResult(params.requestId);
      case "Network.getResponseBodyForInterception": {
        const pending = pendingInterceptions.get(params.interceptionId);
        if (pending == null) throw new Error("Firefox interception is no longer pending.");
        return responseBodyResult(cdpRequestId(pending.details.requestId));
      }
      case "Network.setUserAgentOverride":
        userAgentByTab.set(tabId, { userAgent: params.userAgent, acceptLanguage: params.acceptLanguage, platform: params.platform, userAgentMetadata: params.userAgentMetadata });
        mutableEmulationState(tabId).userAgent = userAgentByTab.get(tabId);
        await applyEmulationState(tabId);
        return {};
      case "Network.getAllCookies":
        return { cookies: (await firefox.cookies.getAll({})).map(cookieToCdp) };
      case "Network.getCookies": {
        const all = await firefox.cookies.getAll({});
        const urls = Array.isArray(params.urls) ? params.urls : [];
        const filtered = urls.length === 0
          ? all
          : all.filter((cookie) => urls.some((url) => new URL(url).hostname.endsWith(cookie.domain.replace(/^\./u, ""))));
        return { cookies: filtered.map(cookieToCdp) };
      }
      case "Network.setCookie":
        return setCookie(params);
      case "Network.setCookies":
        await Promise.all((params.cookies ?? []).map(setCookie));
        return {};
      case "Network.deleteCookies": {
        const cookies = await firefox.cookies.getAll({ name: params.name, domain: params.domain, path: params.path });
        await Promise.allSettled(cookies.map((cookie) => firefox.cookies.remove({ url: cookieUrl(cookie), name: cookie.name, storeId: cookie.storeId })));
        return {};
      }
      case "Network.clearBrowserCookies":
        return clearCookies();
      case "Network.loadNetworkResource":
        return loadNetworkResource(params);
      case "Storage.getCookies":
        return { cookies: (await firefox.cookies.getAll({})).map(cookieToCdp) };
      case "Storage.setCookies":
        await Promise.all((params.cookies ?? []).map(setCookie));
        return {};
      case "Storage.clearCookies":
        return clearCookies();
      case "Storage.clearDataForOrigin": {
        const types = String(params.storageTypes ?? "all").split(",").map((type) => type.trim());
        const all = types.includes("all");
        await firefox.browsingData.remove(
          { origins: [params.origin] },
          { cookies: all || types.includes("cookies"), indexedDB: all || types.includes("indexeddb"), localStorage: all || types.includes("local_storage"), serviceWorkers: all || types.includes("service_workers") },
        );
        return {};
      }
      case "Storage.getUsageAndQuota": {
        const estimate = await executeUserScript(tabId, operationScript(`return navigator.storage?.estimate?.() ?? {usage:0,quota:0};`), { frameId });
        return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, overrideActive: false, usageBreakdown: [] };
      }
      case "Fetch.enable":
        if ((params.patterns?.length ?? 0) === 0 && params.handleAuthRequests !== true) {
          fetchConfigByTab.delete(tabId);
          for (const [requestId, pending] of pendingInterceptions) {
            if (pending.tabId === tabId && pending.kind === "fetch") settleInterception(requestId, {});
          }
        } else {
          fetchConfigByTab.set(tabId, { patterns: [...(params.patterns ?? [])], handleAuthRequests: params.handleAuthRequests === true });
        }
        return {};
      case "Fetch.disable":
        fetchConfigByTab.delete(tabId);
        for (const [requestId, pending] of pendingInterceptions) {
          if (pending.tabId === tabId && pending.kind === "fetch") settleInterception(requestId, {});
        }
        return {};
      case "Fetch.continueRequest": {
        const pending = pendingInterceptions.get(params.requestId);
        if (pending?.state != null && Array.isArray(params.headers)) pending.state.continuedRequestHeaders = headersArrayToObject(params.headers);
        settleInterception(params.requestId, params.url ? { redirectUrl: params.url } : {});
        return {};
      }
      case "Fetch.continueResponse": {
        const responseHeaders = Array.isArray(params.responseHeaders) ? params.responseHeaders.map((header) => ({ name: header.name, value: header.value ?? "" })) : undefined;
        settleInterception(params.requestId, responseHeaders == null ? {} : { responseHeaders });
        return {};
      }
      case "Fetch.fulfillRequest":
        settleInterception(params.requestId, { redirectUrl: responseDataUrl(params) });
        return {};
      case "Fetch.failRequest":
        settleInterception(params.requestId, { cancel: true });
        return {};
      case "Fetch.getResponseBody": {
        const pending = pendingInterceptions.get(params.requestId);
        if (pending == null) throw new Error("Firefox fetch interception is no longer pending.");
        return responseBodyResult(cdpRequestId(pending.details.requestId));
      }
      case "Fetch.takeResponseBodyAsStream": {
        const body = responseBodyResult(cdpRequestId(pendingInterceptions.get(params.requestId)?.details.requestId));
        const stream = `firefox-stream-${nextStreamId++}`;
        ioStreams.set(stream, { data: body.base64Encoded ? body.body : btoa(unescape(encodeURIComponent(body.body))), offset: 0 });
        return { stream };
      }
      case "Fetch.continueWithAuth": {
        const response = params.authChallengeResponse ?? {};
        if (response.response === "CancelAuth") settleInterception(params.requestId, { cancel: true });
        else if (response.response === "ProvideCredentials") settleInterception(params.requestId, { authCredentials: { username: response.username ?? "", password: response.password ?? "" } });
        else settleInterception(params.requestId, {});
        return {};
      }
      case "Debugger.enable":
        return { debuggerId: `firefox-debugger-${tabId}` };
      case "Debugger.resume":
      case "Debugger.setPauseOnExceptions":
      case "Tracing.start":
      case "Tracing.end":
        return {};
      case "Tracing.requestMemoryDump":
        return { dumpGuid: `firefox-memory-${Date.now()}`, success: false };
      case "IO.read": {
        const stream = ioStreams.get(params.handle);
        if (stream == null) throw new Error("Stream not found");
        const start = Number.isInteger(params.offset) ? params.offset : stream.offset;
        const size = Number.isInteger(params.size) ? params.size : 64 * 1024;
        const data = stream.data.slice(start, start + size);
        stream.offset = start + data.length;
        return { base64Encoded: true, data, eof: stream.offset >= stream.data.length };
      }
      case "IO.close":
        ioStreams.delete(params.handle);
        return {};
      default:
        if (/\.(?:enable|disable)$/u.test(method)) {
          return {};
        }
        throw new Error(`Firefox CDP compatibility layer does not implement ${method}.`);
    }
  }

  const debuggerCompat = {
    onEvent: debuggerOnEvent,
    onDetach: debuggerOnDetach,
    async attach(debuggee) {
      const tabId = resolveTabId(debuggee);
      await firefox.tabs.get(tabId);
      await requirePageScriptExecution();
      debuggerAttachedTabs.add(tabId);
      tabTargetId(tabId);
    },
    async detach(debuggee) {
      const tabId = resolveTabId(debuggee);
      const wasAttached = debuggerAttachedTabs.delete(tabId);
      await clearViewportOverride(tabId);
      emulationStateByTab.delete(tabId);
      await applyEmulationState(tabId).catch(() => {});
      fileChooserInterceptByTab.delete(tabId);
      networkEnabledTabs.delete(tabId);
      fetchConfigByTab.delete(tabId);
      networkInterceptionByTab.delete(tabId);
      extraHttpHeadersByTab.delete(tabId);
      blockedUrlPatternsByTab.delete(tabId);
      cacheDisabledTabs.delete(tabId);
      networkConditionsByTab.delete(tabId);
      userAgentByTab.delete(tabId);
      bypassCspTabs.delete(tabId);
      for (const [requestId, pending] of pendingInterceptions) {
        if (pending.tabId === tabId) settleInterception(requestId, {});
      }
      autoAttachByTab.delete(tabId);
      initScriptsByTab.delete(tabId);
      bindingNamesByTab.delete(tabId);
      for (const [sessionId, frame] of sessionFrameById) {
        if (frame.tabId === tabId) sessionFrameById.delete(sessionId);
      }
      for (const [key] of sessionIdByFrame) {
        if (key.startsWith(`${tabId}:`)) sessionIdByFrame.delete(key);
      }
      if (wasAttached) {
        debuggerOnDetach.emit({ tabId }, "canceled_by_user");
      }
    },
    getTargets: getDebuggerTargets,
    sendCommand: sendDebuggerCommand,
  };

  firefox.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0 || !debuggerAttachedTabs.has(details.tabId)) return {};
      const requestId = cdpRequestId(details.requestId);
      const state = networkRequests.get(requestId) ?? {
        requestId,
        firefoxRequestId: details.requestId,
        tabId: details.tabId,
        frameId: Math.max(0, Number(details.frameId) || 0),
        url: details.url,
        method: details.method ?? "GET",
        type: webRequestResourceType(details.type),
        startedAt: details.timeStamp / 1000,
      };
      state.url = details.url;
      state.method = details.method ?? state.method;
      state.postData = requestBodyText(details.requestBody);
      networkRequests.set(requestId, state);
      startResponseBodyCapture(details, state);

      if (networkEnabledTabs.has(details.tabId)) {
        emitDebuggerEvent(details.tabId, "Network.requestWillBeSent", {
          requestId,
          loaderId: `firefox-loader-${details.tabId}-${state.frameId}`,
          documentURL: details.documentUrl ?? details.originUrl ?? details.url,
          request: networkRequestFromDetails(details, state),
          timestamp: details.timeStamp / 1000,
          wallTime: Date.now() / 1000,
          initiator: { type: "other", url: details.originUrl },
          type: state.type,
          frameId: cdpFrameId(details.tabId, state.frameId),
          hasUserGesture: false,
        });
      }

      const blocked = (blockedUrlPatternsByTab.get(details.tabId) ?? []).some((pattern) => wildcardPatternMatches(pattern, details.url));
      const conditions = networkConditionsByTab.get(details.tabId);
      if (blocked || conditions?.offline === true) return { cancel: true };
      const paused = pauseWebRequest(details, "Request");
      const latency = Math.max(0, Number(conditions?.latency) || 0);
      if (paused == null && latency === 0) return {};
      return (async () => {
        if (latency > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(latency, 30_000)));
        return paused == null ? {} : paused;
      })();
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestBody"],
  );

  firefox.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      if (details.tabId < 0 || !debuggerAttachedTabs.has(details.tabId)) return {};
      const state = networkRequests.get(cdpRequestId(details.requestId));
      const headers = [...(details.requestHeaders ?? [])];
      const setHeader = (name, value) => {
        const index = headers.findIndex((header) => header.name.toLowerCase() === name.toLowerCase());
        if (index >= 0) headers[index] = { name, value: String(value) };
        else headers.push({ name, value: String(value) });
      };
      for (const [name, value] of Object.entries(extraHttpHeadersByTab.get(details.tabId) ?? {})) setHeader(name, value);
      for (const [name, value] of Object.entries(state?.continuedRequestHeaders ?? {})) setHeader(name, value);
      if (userAgentByTab.has(details.tabId)) {
        const agent = userAgentByTab.get(details.tabId);
        if (agent.userAgent) setHeader("User-Agent", agent.userAgent);
        if (agent.acceptLanguage) setHeader("Accept-Language", agent.acceptLanguage);
      }
      if (cacheDisabledTabs.has(details.tabId)) {
        setHeader("Cache-Control", "no-cache");
        setHeader("Pragma", "no-cache");
      }
      if (state != null) state.requestHeaders = responseHeadersForCdp(headers);
      if (networkEnabledTabs.has(details.tabId)) {
        emitDebuggerEvent(details.tabId, "Network.requestWillBeSentExtraInfo", {
          requestId: cdpRequestId(details.requestId),
          associatedCookies: [],
          headers: responseHeadersForCdp(headers),
          connectTiming: { requestTime: details.timeStamp / 1000 },
        });
      }
      return { requestHeaders: headers };
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"],
  );

  firefox.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (details.tabId < 0 || !debuggerAttachedTabs.has(details.tabId)) return {};
      const requestId = cdpRequestId(details.requestId);
      const state = networkRequests.get(requestId) ?? { tabId: details.tabId, frameId: Math.max(0, Number(details.frameId) || 0), type: webRequestResourceType(details.type), url: details.url };
      state.statusCode = details.statusCode;
      state.statusLine = details.statusLine;
      state.responseHeaders = responseHeadersForCdp(details.responseHeaders);
      state.mimeType = Object.entries(state.responseHeaders).find(([name]) => name.toLowerCase() === "content-type")?.[1]?.split(";", 1)[0] ?? "";
      networkRequests.set(requestId, state);
      if (networkEnabledTabs.has(details.tabId)) {
        emitDebuggerEvent(details.tabId, "Network.responseReceived", {
          requestId,
          loaderId: `firefox-loader-${details.tabId}-${state.frameId}`,
          timestamp: details.timeStamp / 1000,
          type: state.type,
          frameId: cdpFrameId(details.tabId, state.frameId),
          hasExtraInfo: true,
          response: {
            url: details.url,
            status: details.statusCode,
            statusText: details.statusLine?.split(" ").slice(2).join(" ") ?? "",
            headers: state.responseHeaders,
            mimeType: state.mimeType,
            charset: "",
            connectionReused: false,
            connectionId: 0,
            encodedDataLength: 0,
            securityState: details.url.startsWith("https:") ? "secure" : "neutral",
            protocol: details.statusLine?.split(" ")[0]?.replace("HTTP/", "http/") ?? "",
          },
        });
        emitDebuggerEvent(details.tabId, "Network.responseReceivedExtraInfo", {
          requestId,
          blockedCookies: [],
          headers: state.responseHeaders,
          statusCode: details.statusCode,
          headersText: `${details.statusLine ?? ""}\r\n${(details.responseHeaders ?? []).map((header) => `${header.name}: ${header.value ?? ""}`).join("\r\n")}\r\n`,
        });
      }

      let responseHeaders = [...(details.responseHeaders ?? [])];
      if (bypassCspTabs.has(details.tabId)) {
        responseHeaders = responseHeaders.filter((header) => !["content-security-policy", "content-security-policy-report-only"].includes(header.name.toLowerCase()));
      }
      const paused = pauseWebRequest(details, "Response", details);
      if (paused == null) return responseHeaders === details.responseHeaders ? {} : { responseHeaders };
      return Promise.resolve(paused).then((result) => ({
        ...result,
        ...(result.responseHeaders == null && responseHeaders !== details.responseHeaders ? { responseHeaders } : {}),
      }));
    },
    { urls: ["<all_urls>"] },
    ["blocking", "responseHeaders"],
  );

  firefox.webRequest.onBeforeRedirect.addListener((details) => {
    if (!networkEnabledTabs.has(details.tabId) || !debuggerAttachedTabs.has(details.tabId)) return;
    const state = networkRequests.get(cdpRequestId(details.requestId));
    emitDebuggerEvent(details.tabId, "Network.requestWillBeSent", {
      requestId: cdpRequestId(details.requestId),
      loaderId: `firefox-loader-${details.tabId}-${state?.frameId ?? 0}`,
      documentURL: details.redirectUrl,
      request: { ...networkRequestFromDetails({ ...details, url: details.redirectUrl }, state), url: details.redirectUrl },
      timestamp: details.timeStamp / 1000,
      wallTime: Date.now() / 1000,
      initiator: { type: "other" },
      type: state?.type ?? webRequestResourceType(details.type),
      frameId: cdpFrameId(details.tabId, state?.frameId ?? 0),
      redirectResponse: { url: details.url, status: details.statusCode, statusText: details.statusLine?.split(" ").slice(2).join(" ") ?? "", headers: responseHeadersForCdp(details.responseHeaders) },
    });
  }, { urls: ["<all_urls>"] }, ["responseHeaders"]);

  firefox.webRequest.onAuthRequired.addListener(
    (details) => pauseAuthRequest(details) ?? {},
    { urls: ["<all_urls>"] },
    ["blocking"],
  );

  firefox.webRequest.onCompleted.addListener((details) => {
    if (!networkEnabledTabs.has(details.tabId) || !debuggerAttachedTabs.has(details.tabId)) return;
    const state = networkRequests.get(cdpRequestId(details.requestId));
    const contentLength = Number(Object.entries(state?.responseHeaders ?? {}).find(([name]) => name.toLowerCase() === "content-length")?.[1]) || networkBodies.get(cdpRequestId(details.requestId))?.body.length || 0;
    emitDebuggerEvent(details.tabId, "Network.loadingFinished", {
      requestId: cdpRequestId(details.requestId),
      timestamp: details.timeStamp / 1000,
      encodedDataLength: contentLength,
    });
  }, { urls: ["<all_urls>"] });

  firefox.webRequest.onErrorOccurred.addListener((details) => {
    if (!debuggerAttachedTabs.has(details.tabId)) return;
    if (networkEnabledTabs.has(details.tabId)) {
      emitDebuggerEvent(details.tabId, "Network.loadingFailed", {
        requestId: cdpRequestId(details.requestId),
        timestamp: details.timeStamp / 1000,
        type: networkRequests.get(cdpRequestId(details.requestId))?.type ?? webRequestResourceType(details.type),
        errorText: details.error ?? "Firefox request failed",
        canceled: /cancel/iu.test(details.error ?? ""),
      });
    }
  }, { urls: ["<all_urls>"] });

  firefox.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!debuggerAttachedTabs.has(tabId)) {
      return;
    }

    if (changeInfo.status === "loading") {
      emitDebuggerEvent(tabId, "Runtime.executionContextsCleared", {});
      emitDebuggerEvent(tabId, "Page.frameStartedLoading", { frameId: cdpFrameId(tabId, 0) });
    }

    if (changeInfo.url != null) {
      rememberNavigation(tabId, changeInfo.url, tab.title ?? "");
      emitDebuggerEvent(tabId, "Page.frameNavigated", {
        frame: {
          id: cdpFrameId(tabId, 0),
          loaderId: `firefox-loader-${tabId}-0-${Date.now()}`,
          url: changeInfo.url,
          securityOrigin: (() => {
            try { return new URL(changeInfo.url).origin; } catch { return "null"; }
          })(),
          mimeType: "text/html",
        },
        type: "Navigation",
      });
    }

    if (changeInfo.status === "complete") {
      rememberNavigation(tabId, tab.url ?? "", tab.title ?? "");
      void reapplyPageState(tabId);
      emitDebuggerEvent(tabId, "Page.domContentEventFired", { timestamp: performance.now() / 1000 });
      emitDebuggerEvent(tabId, "Page.loadEventFired", { timestamp: performance.now() / 1000 });
      emitDebuggerEvent(tabId, "Page.frameStoppedLoading", { frameId: cdpFrameId(tabId, 0) });
      void emitNetworkResources(tabId);
    }
  });

  firefox.tabs.onRemoved.addListener((tabId) => {
    navigationStateByTab.delete(tabId);
    initScriptsByTab.delete(tabId);
    bindingNamesByTab.delete(tabId);
    void clearViewportOverride(tabId);
    fileChooserInterceptByTab.delete(tabId);
    networkEnabledTabs.delete(tabId);
    fetchConfigByTab.delete(tabId);
    networkInterceptionByTab.delete(tabId);
    extraHttpHeadersByTab.delete(tabId);
    blockedUrlPatternsByTab.delete(tabId);
    cacheDisabledTabs.delete(tabId);
    networkConditionsByTab.delete(tabId);
    userAgentByTab.delete(tabId);
    bypassCspTabs.delete(tabId);
    emulationStateByTab.delete(tabId);
    for (const [requestId, pending] of pendingInterceptions) {
      if (pending.tabId === tabId) settleInterception(requestId, {});
    }
    for (const [requestId, state] of networkRequests) {
      if (state.tabId === tabId) { networkRequests.delete(requestId); networkBodies.delete(requestId); }
    }
    for (const [key] of pendingDialogsByFrame) {
      if (key.startsWith(`${tabId}:`)) pendingDialogsByFrame.delete(key);
    }
    autoAttachByTab.delete(tabId);
    for (const [sessionId, frame] of sessionFrameById) {
      if (frame.tabId === tabId) sessionFrameById.delete(sessionId);
    }
    for (const [key] of sessionIdByFrame) {
      if (key.startsWith(`${tabId}:`)) sessionIdByFrame.delete(key);
    }
    for (const [nodeId, reference] of externalNodeReferences) {
      if (reference.tabId === tabId) externalNodeReferences.delete(nodeId);
    }
    for (const [key] of externalNodeIdsByReference) {
      if (key.startsWith(`${tabId}:`)) externalNodeIdsByReference.delete(key);
    }
    if (debuggerAttachedTabs.delete(tabId)) {
      debuggerOnDetach.emit({ tabId }, "target_closed");
    }
  });

  firefox.webNavigation.onCommitted.addListener((details) => {
    const { tabId, frameId } = details;
    if (!debuggerAttachedTabs.has(tabId)) return;
    const sessionId = frameId === 0 ? null : (sessionIdByFrame.get(frameKey(tabId, frameId)) ?? null);
    emitDebuggerEvent(tabId, "Runtime.executionContextDestroyed", {
      executionContextId: executionContextIdForFrame(frameId),
      executionContextUniqueId: `firefox-context-${tabId}-${frameId}`,
    }, sessionId);
    if (frameId !== 0) {
      emitDebuggerEvent(tabId, "Page.frameAttached", {
        frameId: cdpFrameId(tabId, frameId),
        parentFrameId: cdpFrameId(tabId, details.parentFrameId),
      });
    }
    emitDebuggerEvent(tabId, "Page.frameNavigated", {
      frame: {
        id: cdpFrameId(tabId, frameId),
        ...(frameId === 0 ? {} : { parentId: cdpFrameId(tabId, details.parentFrameId) }),
        loaderId: `firefox-loader-${tabId}-${frameId}-${Date.now()}`,
        url: details.url,
        securityOrigin: (() => { try { return new URL(details.url).origin; } catch { return "null"; } })(),
        mimeType: "text/html",
      },
      type: "Navigation",
    }, sessionId);
    void (async () => {
      for (const source of initScriptsByTab.get(tabId)?.values() ?? []) await runRawInitScript(tabId, source, frameId).catch(() => {});
      for (const name of bindingNamesByTab.get(tabId) ?? []) await installBinding(tabId, name, frameId).catch(() => {});
      await emitAutoAttachedFrames(tabId);
      emitExecutionContext(tabId, frameId, frameId === 0 ? null : (sessionIdByFrame.get(frameKey(tabId, frameId)) ?? null), details.url);
    })();
  });

  firefox.webNavigation.onCompleted.addListener(({ tabId, frameId }) => {
    if (!debuggerAttachedTabs.has(tabId) || frameId === 0) return;
    const sessionId = sessionIdByFrame.get(frameKey(tabId, frameId)) ?? null;
    emitDebuggerEvent(tabId, "Page.frameStoppedLoading", { frameId: cdpFrameId(tabId, frameId) }, sessionId);
  });

  firefox.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === "CHATGPT_FIREFOX_DIALOG_OPENED" && Number.isInteger(sender.tab?.id)) {
      const tabId = sender.tab.id;
      const frameId = sender.frameId ?? 0;
      pendingDialogsByFrame.set(frameKey(tabId, frameId), { ...message });
      emitDebuggerEvent(tabId, "Page.javascriptDialogOpening", {
        url: sender.url ?? "",
        frameId: cdpFrameId(tabId, frameId),
        type: message.dialogType ?? "alert",
        message: message.message ?? "",
        defaultPrompt: message.defaultPrompt ?? "",
        hasBrowserHandler: true,
      }, frameId === 0 ? null : (sessionIdByFrame.get(frameKey(tabId, frameId)) ?? null));
      return Promise.resolve({ ok: true });
    }
    if (message?.type !== "CHATGPT_FIREFOX_CDP_BINDING" || !Number.isInteger(sender.tab?.id)) {
      return undefined;
    }
    emitDebuggerEvent(sender.tab.id, "Runtime.bindingCalled", {
      name: message.name,
      payload: message.payload,
      executionContextId: executionContextIdForFrame(sender.frameId ?? 0),
    }, (sender.frameId ?? 0) === 0 ? null : (sessionIdByFrame.get(frameKey(sender.tab.id, sender.frameId)) ?? null));
    return Promise.resolve({ ok: true });
  });

  const chromeCompat = new Proxy(firefox, {
    get(target, property) {
      if (property === "runtime") {
        return runtimeCompat;
      }
      if (property === "debugger") {
        return debuggerCompat;
      }
      if (property === "sidePanel") {
        return sidePanelCompat;
      }
      return bindValue(target, property);
    },
  });

  try {
    globalThis.chrome = chromeCompat;
  } catch {
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      enumerable: true,
      value: chromeCompat,
      writable: false,
    });
  }

  globalThis.__chatgptFirefoxCompat = {
    debugger: debuggerCompat,
    sidePanel: sidePanelCompat,
    version: 1,
  };
})();
