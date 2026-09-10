import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(path.join(root, "extension", "firefox-compat.js"), "utf8");

class EventMock {
  listeners = [];
  addListener(listener) { this.listeners.push(listener); }
  removeListener(listener) { this.listeners = this.listeners.filter((candidate) => candidate !== listener); }
  hasListener(listener) { return this.listeners.includes(listener); }
  emit(...args) { for (const listener of [...this.listeners]) listener(...args); }
}

const webRequest = {
  onBeforeRequest: new EventMock(), onBeforeSendHeaders: new EventMock(), onHeadersReceived: new EventMock(),
  onBeforeRedirect: new EventMock(), onAuthRequired: new EventMock(), onCompleted: new EventMock(), onErrorOccurred: new EventMock(),
  filters: new Map(),
  filterResponseData(requestId) {
    const filter = { write() {}, close() {}, disconnect() {} };
    this.filters.set(requestId, filter);
    return filter;
  },
};
const executedTargets = [];
const executedSources = [];
const cspSafeOperations = [];
const cspSafeFunctionSources = [];
const executeScriptCalls = [];
const executedFaviconTargets = [];
const createdTabs = [];
const fetchedUrls = [];
const storedValues = {};
const badgeTexts = [];
let allWebsiteAccessGranted = true;
let captureVisibleTabCalls = [];
let targetTabActive = true;
let strictCspEnabled = false;
let strictCspDynamicEvaluationAttempts = 0;
const tabUpdateCalls = [];
const nativePostedMessages = [];
const nativePort = {
  onMessage: new EventMock(),
  onDisconnect: new EventMock(),
  postMessage(message) { nativePostedMessages.push(message); },
  disconnect() {},
};

class StrictCspEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.defaultPrevented = false;
    Object.assign(this, init);
  }
  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
}
class StrictCspElement {}
class StrictCspHtmlElement extends StrictCspElement {
  constructor() {
    super();
    this.attributeValues = new Map();
    this.attributes = [];
    this.childNodes = [];
    this.children = [];
    this.events = [];
    this.eventListeners = new Map();
    this.isConnected = true;
    this.isContentEditable = false;
    this.shadowRoot = null;
  }
  closest(selector) { return selector.includes("input") ? this : null; }
  addEventListener(type, listener) {
    const listeners = this.eventListeners.get(type) ?? [];
    listeners.push(listener);
    this.eventListeners.set(type, listeners);
  }
  dispatchEvent(event) {
    this.events.push(event);
    for (const listener of [...(this.eventListeners.get(event.type) ?? [])]) listener.call(this, event);
    return !event.defaultPrevented;
  }
  focus() {}
  getAttribute(name) { return this.attributeValues.get(name) ?? null; }
  hasAttribute(name) { return this.attributeValues.has(name); }
  getBoundingClientRect() { return { bottom: 50, height: 30, left: 10, right: 40, top: 20, width: 30 }; }
  getClientRects() { return [this.getBoundingClientRect()]; }
  scrollIntoView() {}
}
class StrictCspInputElement extends StrictCspHtmlElement {
  constructor() {
    super();
    this.value = "";
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.disabled = false;
    this.readOnly = false;
    this.type = "text";
    this.localName = "input";
    this.nodeName = "INPUT";
    this.tagName = "INPUT";
    this.attributeValues.set("aria-label", "Strict CSP");
  }
  setRangeText(text, start, end, selectionMode) {
    this.value = this.value.slice(0, start) + text + this.value.slice(end);
    if (selectionMode === "end") this.selectionStart = this.selectionEnd = start + text.length;
  }
}
class StrictCspTextAreaElement extends StrictCspInputElement {}
class StrictCspSelectElement extends StrictCspHtmlElement {
  constructor(values = ["Alpha", "Beta", "Gamma"], { multiple = false } = {}) {
    super();
    this.disabled = false;
    this.localName = "select";
    this.multiple = multiple;
    this.nodeName = "SELECT";
    this.options = values.map((value) => ({ disabled: false, label: value, selected: false, value }));
    this.setSelectedIndices([0]);
    this.tagName = "SELECT";
  }
  get selectedIndex() { return this.options.findIndex((option) => option.selected); }
  set selectedIndex(index) {
    for (const [optionIndex, option] of this.options.entries()) option.selected = optionIndex === index;
  }
  setSelectedIndices(indices) {
    const selected = new Set(indices);
    for (const [optionIndex, option] of this.options.entries()) option.selected = selected.has(optionIndex);
  }
  get value() { return this.options[this.selectedIndex]?.value ?? ""; }
}
class StrictCspScrollElement extends StrictCspHtmlElement {
  constructor({ clientHeight = 144, clientWidth = 722, scrollHeight = 484, scrollWidth = 722 } = {}) {
    super();
    this.clientHeight = clientHeight;
    this.clientWidth = clientWidth;
    this.parentElement = null;
    this.scrollHeight = scrollHeight;
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.scrollWidth = scrollWidth;
    this.tagName = "DIV";
  }
  scrollBy({ left = 0, top = 0 }) {
    this.scrollLeft = Math.max(0, Math.min(this.scrollWidth - this.clientWidth, this.scrollLeft + left));
    this.scrollTop = Math.max(0, Math.min(this.scrollHeight - this.clientHeight, this.scrollTop + top));
  }
}
class StrictCspButtonElement extends StrictCspHtmlElement {
  constructor() {
    super();
    this.clickCount = 0;
    this.tagName = "BUTTON";
  }
  click() { this.clickCount += 1; }
}
class StrictCspFrameElement extends StrictCspHtmlElement {}
const strictCspInput = new StrictCspInputElement();
const controlledUploadInput = new StrictCspInputElement();
controlledUploadInput.type = "file";
controlledUploadInput.attributeValues.set("aria-label", "Controlled upload");
const strictCspSelect = new StrictCspSelectElement();
const strictCspScroll = new StrictCspScrollElement();
const strictCspShadowButton = new StrictCspButtonElement();
const strictCspShadowHost = new StrictCspHtmlElement();
strictCspShadowHost.shadowRoot = { elementFromPoint: () => strictCspShadowButton };
let strictCspHitTarget = strictCspInput;
let strictCspFrameHit = null;
const strictCspChildFrameScrolls = [];
const strictCspPageScrolls = [];
const strictCspControlCandidates = [controlledUploadInput];
const strictCspDocument = {
  activeElement: strictCspInput,
  body: strictCspInput,
  childNodes: [strictCspInput, controlledUploadInput],
  documentElement: strictCspInput,
  elementFromPoint: () => strictCspHitTarget,
  hasFocus: () => true,
  querySelector(selector) {
    return selector === 'input[type="file"]' ? controlledUploadInput : null;
  },
  querySelectorAll(selector) {
    if (selector === 'input[type="file"]' || selector === "input,textarea,select,button,[aria-label]") {
      return selector === 'input[type="file"]' ? [controlledUploadInput] : strictCspControlCandidates;
    }
    return [];
  },
};
const strictCspPage = {
  document: strictCspDocument,
  Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
  Element: StrictCspElement,
  HTMLElement: StrictCspHtmlElement,
  HTMLInputElement: StrictCspInputElement,
  HTMLSelectElement: StrictCspSelectElement,
  HTMLTextAreaElement: StrictCspTextAreaElement,
  HTMLIFrameElement: StrictCspFrameElement,
  HTMLFrameElement: StrictCspFrameElement,
  InputEvent: StrictCspEvent,
  Event: StrictCspEvent,
  KeyboardEvent: StrictCspEvent,
  MouseEvent: StrictCspEvent,
  PointerEvent: StrictCspEvent,
  WheelEvent: StrictCspEvent,
  ClipboardEvent: undefined,
  DataTransfer: undefined,
  getComputedStyle: (element) => ({
    display: "block",
    opacity: "1",
    overflow: element instanceof StrictCspScrollElement ? "auto" : "visible",
    overflowX: element instanceof StrictCspScrollElement ? "auto" : "visible",
    overflowY: element instanceof StrictCspScrollElement ? "auto" : "visible",
    pointerEvents: "auto",
    visibility: "visible",
  }),
  innerHeight: 800,
  innerWidth: 1200,
  Map,
  Set,
  WeakMap,
  dispatchEvent: () => true,
  scrollBy: (details) => strictCspPageScrolls.push(details),
};
strictCspPage.window = strictCspPage;
strictCspDocument.defaultView = strictCspPage;
strictCspInput.ownerDocument = strictCspDocument;
controlledUploadInput.ownerDocument = strictCspDocument;
const strictCspPageContext = vm.createContext(strictCspPage, {
  codeGeneration: { strings: false, wasm: false },
});

function executeInStrictCspPage(func, args) {
  return vm.runInContext(`(${String(func)})(${args.map((argument) => JSON.stringify(argument)).join(",")})`, strictCspPageContext);
}

const browser = {
  runtime: {
    id: "codex-computer-use-firefox-zen@sunkenintime", onMessage: new EventMock(),
    async getBrowserInfo() { return { name: "Firefox", version: "152.0", buildID: "test" }; },
    getManifest() { return { version: "test" }; },
    getURL(pathname) { return `moz-extension://test/${pathname}`; },
    connectNative() { return nativePort; },
  },
  action: {
    async setBadgeBackgroundColor() {},
    async setBadgeText(details) { badgeTexts.push(details.text); },
  },
  permissions: {
    async contains(details) {
      assert.equal(JSON.stringify(details), JSON.stringify({ origins: ["<all_urls>"] }));
      return allWebsiteAccessGranted;
    },
    async request() { return true; },
  },
  sidebarAction: { async open() {}, async close() {} },
  storage: {
    local: {
      async get(key) { return { [key]: storedValues[key] }; },
      async set(values) { Object.assign(storedValues, values); },
    },
    session: {
      async get(key) { return { [key]: storedValues[key] }; },
      async set(values) { Object.assign(storedValues, values); },
    },
  },
  tabs: {
    onUpdated: new EventMock(), onRemoved: new EventMock(),
    async query(queryInfo) {
      if (queryInfo?.active && !targetTabActive) {
        return [{ id: 2, windowId: 10, index: 1, url: "https://other.test/", title: "Other", active: true }];
      }
      return [{ id: 1, windowId: 10, index: 0, url: "https://top.test/", title: "Top", active: targetTabActive, favIconUrl: "https://top.test/favicon.ico" }];
    },
    async get() { return { id: 1, windowId: 10, index: 0, url: "https://top.test/", title: "Top", active: targetTabActive, favIconUrl: "https://top.test/favicon.ico" }; },
    async create(details) { createdTabs.push(details); },
    async update(tabId, details) {
      tabUpdateCalls.push({ tabId, details });
      if (details?.active) targetTabActive = tabId === 1;
    },
    async remove() {}, async reload() {}, async setZoom() {},
    async captureTab() { return "data:image/png;base64,dGVzdA=="; },
    async captureVisibleTab(windowId, options) {
      captureVisibleTabCalls.push({ windowId, options });
      return "data:image/png;base64,ZmFsbGJhY2s=";
    },
  },
  windows: { async get() { return { id: 10, state: "normal", width: 1200, height: 800, left: 0, top: 0 }; }, async update() { return {}; } },
  webNavigation: {
    onCommitted: new EventMock(), onDOMContentLoaded: new EventMock(), onCompleted: new EventMock(),
    async getAllFrames() {
      return [
        { frameId: 0, parentFrameId: -1, url: "https://top.test/" },
        { frameId: 7, parentFrameId: 0, url: "https://child.test/" },
        { frameId: 9, parentFrameId: 7, url: "https://nested.test/" },
      ];
    },
    async getFrame({ frameId }) { return { frameId, url: frameId === 7 ? "https://child.test/" : "https://top.test/" }; },
  },
  scripting: {
    async executeScript({ target, func, args, world, injectImmediately }) {
      executedTargets.push(target);
      executeScriptCalls.push({ target, func, args, world, injectImmediately });
      if (func?.name === "runCspSafePageOperation") {
        cspSafeOperations.push({ operation: args[0], payload: args[1], target });
        cspSafeFunctionSources.push(String(func));
        let value = {};
        if (args[0] === "focusedState") {
          value = target.frameIds?.[0] === 7
            ? { focused: true, meaningful: true, frameOwner: false }
            : { focused: false, meaningful: false, frameOwner: false };
        } else if (args[0] === "hitTestFrame") {
          value = target.frameIds?.[0] === 0 ? strictCspFrameHit : null;
        } else if (target.frameIds?.[0] === 7 && args[0] === "synthesizeScroll") {
          strictCspChildFrameScrolls.push(args[1]);
          value = {};
        } else if ([
          "dispatchKeyboard", "dispatchMouse", "installPlaywrightHelper", "synthesizeScroll", "playwrightDomSnapshot", "visibleDomPoint", "visibleDomSnapshot",
          "virtualClipboard", "virtualClipboardCommitCut",
        ].includes(args[0])) {
          value = executeInStrictCspPage(func, args);
        } else if (args[0] === "describeNode" && args[1].nodeId === 3) {
          value = { node: { nodeId: 3, backendNodeId: 3, nodeType: 1, nodeName: "IFRAME", localName: "iframe", nodeValue: "", childNodeCount: 0, attributes: ["src", "https://child.test/"], __frameOwnerIndex: 0, __sameUrlOwnerIndex: 0, __resolvedFrameUrl: "https://child.test/" } };
        } else if (args[0] === "describeNode" && args[1].nodeId === 4) {
          value = { node: { nodeId: 4, backendNodeId: 4, nodeType: 1, nodeName: "DIV", localName: "div", nodeValue: "", childNodeCount: 0, attributes: [] } };
        } else if (args[0] === "getDocument") {
          value = {
            root: {
              nodeId: 1,
              backendNodeId: 1,
              nodeType: 9,
              nodeName: "#document",
              localName: "",
              nodeValue: "",
              childNodeCount: 1,
              attributes: [],
              children: [{
                nodeId: 2,
                backendNodeId: 2,
                nodeType: 1,
                nodeName: "INPUT",
                localName: "input",
                nodeValue: "",
                childNodeCount: 0,
                attributes: ["type", "file", "aria-label", "Controlled upload"],
              }],
            },
          };
        } else if (args[0] === "querySelector" && args[1].selector === 'input[type="file"]') {
          value = { nodeId: 2 };
        } else if (args[0] === "describeNode" && args[1].nodeId === 2) {
          value = {
            node: {
              nodeId: 2,
              backendNodeId: 2,
              nodeType: 1,
              nodeName: "INPUT",
              localName: "input",
              nodeValue: "",
              childNodeCount: 0,
              attributes: ["type", "file", "aria-label", "Controlled upload"],
            },
          };
        } else if (args[0] === "resolveNode" && args[1].nodeId === 2) {
          value = {
            object: {
              type: "object",
              subtype: "node",
              className: "HTMLInputElement",
              description: "input",
              objectId: "firefox-object-2",
            },
          };
        }
        return [{ frameId: target.frameIds?.[0] ?? 0, result: value }];
      }
      if (args[0] === "https://top.test/favicon.ico" && typeof func === "function") {
        executedFaviconTargets.push(target);
        return [{ frameId: 0, result: {
          bytes: [105, 99, 111, 110],
          contentType: "image/x-icon",
          status: 200,
        } }];
      }
      if (strictCspEnabled) {
        strictCspDynamicEvaluationAttempts += 1;
        return [{ frameId: target.frameIds?.[0] ?? 0, error: { message: "call to eval() blocked by Content Security Policy" } }];
      }
      const sourceText = args[0];
      executedSources.push(sourceText);
      let value = {};
      if (sourceText.includes("document.contentType")) value = { name: "", mimeType: "text/html", title: "", securityOrigin: "https://frame.test" };
      else if (sourceText.includes("meaningful:") && sourceText.includes("frameOwner:")) {
        value = target.frameIds?.[0] === 7
          ? { focused: true, meaningful: true, frameOwner: false }
          : { focused: false, meaningful: false, frameOwner: false };
      }
      else if (sourceText.includes("performance.getEntriesByType(\"resource\")")) value = [];
      else if (sourceText.includes("const __evaluated")) value = { result: { type: "string", value: "child-evaluation" } };
      else if (sourceText.includes("const frameOwners") && sourceText.includes("const id = 3")) value = { node: { nodeId: 3, backendNodeId: 3, nodeType: 1, nodeName: "IFRAME", localName: "iframe", nodeValue: "", childNodeCount: 0, attributes: ["src", "https://child.test/"], __frameOwnerIndex: 0, __sameUrlOwnerIndex: 0, __resolvedFrameUrl: "https://child.test/" } };
      else if (sourceText.includes("const frameOwners") && sourceText.includes("const id = 4")) value = { node: { nodeId: 4, backendNodeId: 4, nodeType: 1, nodeName: "DIV", localName: "div", nodeValue: "", childNodeCount: 0, attributes: [] } };
      else if (sourceText.includes("querySelectorAll(\"iframe,frame\")")) value = { nodeId: 3, backendNodeId: 3 };
      return [{ frameId: target.frameIds?.[0] ?? 0, result: JSON.stringify({ ok: true, value }) }];
    },
  },
  cookies: { async getAll() { return []; }, async set() {}, async remove() {} },
  browsingData: { async removeCache() {}, async remove() {} },
  webRequest,
};

const context = vm.createContext({
  browser, console, URL, URLSearchParams, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer,
  atob, btoa, structuredClone, setTimeout, clearTimeout, queueMicrotask,
  Response,
  fetch: async (input) => {
    fetchedUrls.push(String(input));
    if (String(input) === "https://top.test/favicon.ico") {
      throw new TypeError("Blocked by extension connect-src");
    }
    return new Response("icon", { status: 200, headers: { "content-type": "image/x-icon" } });
  },
  performance: { now: () => 100 }, navigator: { userAgent: "Firefox test" },
});
new vm.Script(source, { filename: "firefox-compat.js" }).runInContext(context);
const compat = context.__chatgptFirefoxCompat;
assert.ok(compat?.debugger, "Compatibility debugger was not installed.");
assert.equal(
  (await context.chrome.action.getUserSettings()).isOnToolbar,
  true,
  "The current OpenAI background requires a Firefox-safe toolbar settings result.",
);
assert.equal(
  typeof context.chrome.action.onUserSettingsChanged.addListener,
  "function",
  "The current OpenAI background requires a Firefox-safe toolbar settings event.",
);

const identityPort = context.chrome.runtime.connectNative("com.openai.codexextension");
identityPort.onMessage.addListener(() => {});
nativePort.onMessage.emit({
  _firefoxBridgeVersion: "test",
  id: "bridge-info",
  method: "getInfo",
});
identityPort.postMessage({
  id: "bridge-info",
  result: {
    name: "Chrome",
    metadata: { extensionInstanceId: "test-instance" },
  },
});
const bridgeIdentity = nativePostedMessages.at(-1).result;
assert.equal(bridgeIdentity.name, "Codex Firefox Bridge (Firefox and Zen Browser)");
assert.equal(bridgeIdentity.metadata.actualBrowserFamily, "firefox");
assert.equal(bridgeIdentity.metadata.bridgeName, "codex-firefox-bridge");
assert.equal(bridgeIdentity.metadata.bridgeVersion, "test");
assert.equal(bridgeIdentity.metadata.compatibilityFamily, "chrome");
assert.equal(bridgeIdentity.metadata.extensionId, "hehggadaopoacecdllhhajmbjkdcmajg");
assert.equal(bridgeIdentity.metadata.geckoExtensionId, "codex-computer-use-firefox-zen@sunkenintime");
assert.equal(bridgeIdentity.metadata.extensionInstanceId, "test-instance");
assert.equal(createdTabs.length, 0, "Matching bridge and extension versions must not show update guidance.");

nativePort.onMessage.emit({
  _firefoxBridgeVersion: "0.9.0",
  id: "mismatched-bridge-info",
  method: "getInfo",
});
identityPort.postMessage({
  id: "mismatched-bridge-info",
  result: { name: "Chrome", metadata: {} },
});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(nativePostedMessages.at(-1).result.metadata.bridgeVersion, "0.9.0");
assert.equal(badgeTexts.at(-1), "SYNC", "A version mismatch must remain visible on the toolbar action.");
assert.match(createdTabs.at(-1).url, /companion-required\.html\?/u);
assert.match(createdTabs.at(-1).url, /reason=version-mismatch/u);
assert.match(createdTabs.at(-1).url, /bridgeVersion=0\.9\.0/u);
assert.match(createdTabs.at(-1).url, /extensionVersion=test/u);
createdTabs.length = 0;

nativePort.onMessage.emit({ id: "legacy-bridge-info", method: "getInfo" });
identityPort.postMessage({
  id: "legacy-bridge-info",
  result: { name: "Chrome", metadata: {} },
});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(nativePostedMessages.at(-1).result.metadata.bridgeVersion, "unknown");
assert.match(createdTabs.at(-1).url, /bridgeVersion=unknown/u, "A pre-version-reporting bridge must be treated as outdated.");
createdTabs.length = 0;

const faviconResponse = await context.fetch("moz-extension://test/_favicon/?pageUrl=https%3A%2F%2Ftop.test%2F&size=32");
assert.equal(faviconResponse.ok, true);
assert.equal(fetchedUrls.at(-1), "https://top.test/favicon.ico", "Chrome's virtual favicon request must resolve through Firefox's tab favicon URL.");
assert.equal(JSON.stringify(executedFaviconTargets), '[{"tabId":1}]', "A CSP-blocked favicon must be read from the matching Firefox tab.");
assert.equal(await faviconResponse.text(), "icon");

const sidePanelOpenEvents = [];
const sidePanelEnsureResponses = [];
const sidePanelReadyResponses = [];
const tabMentionResponses = [];
const packagedMessageSenders = [];
let packagedMessageCalls = 0;
compat.sidePanel.onOpened.addListener((details) => sidePanelOpenEvents.push(details));
context.chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  packagedMessageCalls += 1;
  packagedMessageSenders.push(sender);
  if (message.type === "search_browser_tab_mentions") {
    sendResponse(sender.tab == null
      ? { ok: true, candidates: [{ id: 1, title: "Top", url: "https://top.test/" }] }
      : { ok: false, error: "Chrome tab mentions can only be accessed from the Codex side panel or ChatGPT" });
    return true;
  }
  sendResponse({ ok: true });
  return true;
});
const packagedMessageListener = browser.runtime.onMessage.listeners.at(-1);
const keepsReadyChannelOpen = packagedMessageListener(
  { embedded: true, type: "codex_firefox_sidepanel_ready", windowId: 10 },
  { tab: { id: 1 }, url: "moz-extension://test/codex-sidepanel/index.html" },
  (response) => sidePanelReadyResponses.push(response),
);
assert.equal(keepsReadyChannelOpen, true, "Native Firefox sidebar readiness must keep the async response channel open.");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(packagedMessageCalls, 0, "The Firefox-only readiness handshake must not reach the packaged handler.");
assert.equal(JSON.stringify(sidePanelReadyResponses), '[{"ok":true}]');
assert.equal(JSON.stringify(storedValues.codexSidePanelOpenWindowIds), "[10]", "Sidebar readiness must be persisted before upstream boot.");

const rejectedReadyResponses = [];
const rejectedReadyResult = packagedMessageListener(
  { embedded: false, type: "codex_firefox_sidepanel_ready", windowId: 12 },
  { tab: { id: 2 }, url: "moz-extension://test/codex-sidepanel/index.html" },
  (response) => rejectedReadyResponses.push(response),
);
assert.equal(rejectedReadyResult, false, "A normal extension tab must not be recorded as an open native sidebar.");
assert.equal(JSON.stringify(rejectedReadyResponses), '[{"ok":false}]');
assert.equal(packagedMessageCalls, 0, "Firefox readiness messages must never reach the packaged handler.");

const keepsTabMentionChannelOpen = packagedMessageListener(
  { type: "search_browser_tab_mentions", query: "top", limit: 10 },
  { tab: { id: 1 }, url: "moz-extension://test/codex-sidepanel/index.html" },
  (response) => tabMentionResponses.push(response),
);
assert.equal(keepsTabMentionChannelOpen, true, "Native Firefox sidebar tab searches must reach the packaged async handler.");
assert.equal(packagedMessageCalls, 1);
assert.equal(packagedMessageSenders.at(-1).tab, undefined, "The official handler must receive the Chrome-equivalent side-panel sender shape.");
assert.deepEqual(tabMentionResponses, [{ ok: true, candidates: [{ id: 1, title: "Top", url: "https://top.test/" }] }]);

const keepsChannelOpen = packagedMessageListener(
  { type: "ensure_codex_app_server", windowId: 10 },
  { tab: { id: 1 }, url: "moz-extension://test/codex-sidepanel/index.html" },
  (response) => sidePanelEnsureResponses.push(response),
);
assert.equal(keepsChannelOpen, true, "Authoritative sidebar startup must keep the async response channel open.");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(packagedMessageCalls, 2, "The packaged message handler must run after sidebar state is repaired.");
assert.equal(JSON.stringify(storedValues.codexSidePanelOpenWindowIds), "[10]", "A native Firefox and Zen Browser sidebar open must be persisted.");
assert.equal(sidePanelOpenEvents.length, 1, "Repeated sidebar startup must not re-emit sidePanel.onOpened.");
assert.equal(sidePanelOpenEvents[0].windowId, 10);
assert.deepEqual(sidePanelEnsureResponses, [{ ok: true }]);
assert.equal(packagedMessageSenders.at(-1).tab, undefined, "All trusted native-sidebar requests must use Chrome's tabless sender shape.");

packagedMessageListener(
  { type: "ensure_codex_app_server", windowId: 11 },
  { url: "https://example.test/not-the-extension-sidebar" },
  () => {},
);
assert.equal(packagedMessageCalls, 3, "Non-sidebar messages must still reach the packaged handler.");
assert.equal(JSON.stringify(storedValues.codexSidePanelOpenWindowIds), "[10]", "Untrusted senders must not alter sidebar state.");
assert.equal(sidePanelOpenEvents.length, 1, "Untrusted senders must not synthesize sidebar events.");

context.chrome.runtime.connectNative("com.openai.codexextension");
nativePort.onDisconnect.emit();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(createdTabs.length, 0, "An immediate native disconnect must keep setup inside the sidebar.");

const events = [];
compat.debugger.onEvent.addListener((sourceInfo, method, params) => events.push({ sourceInfo, method, params }));
allWebsiteAccessGranted = false;
await assert.rejects(
  compat.debugger.attach({ tabId: 1 }),
  /Firefox website access is disabled/u,
  "Revoked Firefox host access must fail before the raw scripting error.",
);
allWebsiteAccessGranted = true;
await compat.debugger.attach({ tabId: 1 });

const captureTab = browser.tabs.captureTab;
browser.tabs.captureTab = undefined;
targetTabActive = false;
tabUpdateCalls.length = 0;
const fallbackScreenshot = await compat.debugger.sendCommand({ tabId: 1 }, "Page.captureScreenshot", { format: "png" });
browser.tabs.captureTab = captureTab;
assert.equal(fallbackScreenshot.data, "ZmFsbGJhY2s=");
assert.equal(
  JSON.stringify(captureVisibleTabCalls),
  JSON.stringify([{ windowId: 10, options: { format: "png" } }]),
);
assert.equal(
  JSON.stringify(tabUpdateCalls),
  JSON.stringify([
    { tabId: 1, details: { active: true } },
    { tabId: 2, details: { active: true } },
  ]),
  "Visible-tab fallback must restore the tab that was active before capture.",
);
targetTabActive = true;

const tree = await compat.debugger.sendCommand({ tabId: 1 }, "Page.getFrameTree", {});
assert.equal(tree.frameTree.frame.id, "firefox-frame-1");
assert.equal(tree.frameTree.childFrames[0].frame.id, "firefox-frame-1-7");
assert.equal(tree.frameTree.childFrames[0].childFrames[0].frame.id, "firefox-frame-1-9");

await compat.debugger.sendCommand({ tabId: 1 }, "Target.setAutoAttach", { autoAttach: true, flatten: true });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.ok(events.some((event) => event.method === "Target.attachedToTarget" && event.params.targetInfo.url === "https://child.test/"));

const evaluation = await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", { contextId: 8, expression: "location.href", returnByValue: true });
assert.equal(evaluation.result.value, "child-evaluation");
assert.equal(JSON.stringify(executedTargets.at(-1).frameIds), "[7]");

await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
  expression: "/* Browser Use virtual clipboard */ ({ clipboardItems: [] })",
  returnByValue: true,
});
assert.equal(JSON.stringify(executedTargets.at(-1).frameIds), "[7]", "Focused cross-origin clipboard evaluation was not tunneled into the child frame.");

const unrecognizedPlaywrightHelperExpression = "globalThis.__codexPlaywrightInjected.unrecognizedHelperCall()";
const nonCspUnrecognizedHelperEvaluation = await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
  expression: unrecognizedPlaywrightHelperExpression,
  returnByValue: true,
});
assert.equal(
  nonCspUnrecognizedHelperEvaluation.result.value,
  "child-evaluation",
  "Outside strict CSP, an unrecognized Playwright helper expression must preserve normal dynamic evaluation.",
);

const browserUseBindingName = "__browserUseClipboard_strict_csp_test";
strictCspEnabled = true;
const strictCspOperationStart = cspSafeOperations.length;
await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.addBinding", { name: browserUseBindingName });
const clipboardInit = await compat.debugger.sendCommand({ tabId: 1 }, "Page.addScriptToEvaluateOnNewDocument", {
  runImmediately: true,
  source: `(() => {
    const installPageClipboardBridge = () => { globalThis.__browserUseClipboardBridge = {}; };
    installPageClipboardBridge(${JSON.stringify(browserUseBindingName)});
  })()`,
});
const bridgeCheck = await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
  expression: `globalThis.__browserUseClipboardBridge?.bindingName === ${JSON.stringify(browserUseBindingName)}`,
  returnByValue: true,
});
assert.equal(bridgeCheck.result.value, true, "The Browser Use clipboard handshake must not depend on eval under strict CSP.");

const typedText = 'strict CSP text with ")}", <markup>, and const data = await pageFunction(';
const virtualClipboardExpression = `(
  async () => {
    try {
      const pageFunction = async (args) => {
        if (args.action === "paste" && args.clipboardItems.length === 0)
          throw new Error("Browser Use virtual clipboard has no data to paste");
        return {};
      };
      const data = await pageFunction(${JSON.stringify({
        action: "paste",
        clipboardItems: [{ entries: [{ mime_type: "text/plain", text: typedText }], presentation_style: "unspecified" }],
        replaceInputValue: false,
      })});
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
)()`;
const virtualPaste = await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
  expression: virtualClipboardExpression,
  awaitPromise: true,
  returnByValue: true,
});
assert.equal(virtualPaste.result.value.ok, true);
assert.equal(strictCspInput.value, typedText, "cua.type/dom_cua.type virtual paste did not reach the focused input under strict CSP.");
assert.equal(cspSafeOperations.at(-1).operation, "virtualClipboard");
assert.equal(cspSafeOperations.at(-1).target.frameIds[0], 7, "Strict-CSP typing must preserve focused child-frame routing.");

await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchKeyEvent", { type: "char", key: "!", text: "!" });
assert.equal(strictCspInput.value, `${typedText}!`, "Input.dispatchKeyEvent type=char must insert its text.");
strictCspDocument.activeElement = strictCspSelect;
await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown" });
await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown" });
assert.equal(strictCspSelect.value, "Gamma", "ArrowDown must change the focused Firefox select option.");
assert.deepEqual(
  strictCspSelect.events.filter(({ type }) => type === "input" || type === "change").map(({ type }) => type),
  ["input", "change", "input", "change"],
  "Keyboard selection must notify page code through input and change events.",
);
strictCspDocument.activeElement = strictCspInput;
strictCspHitTarget = strictCspScroll;
await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchMouseEvent", { type: "mouseWheel", x: 20, y: 30, deltaX: 0, deltaY: 420 });
assert.equal(strictCspScroll.scrollTop, 340, "A wheel over a scrollable element must move that element to its scroll boundary.");
assert.equal(strictCspPageScrolls.length, 0, "Nested scrolling must not move the page when the inner element can consume the wheel delta.");
strictCspScroll.scrollTop = 0;
strictCspPageScrolls.length = 0;
await compat.debugger.sendCommand({ tabId: 1 }, "Input.synthesizeScrollGesture", { x: 20, y: 30, xDistance: 0, yDistance: -420 });
assert.equal(strictCspScroll.scrollTop, 340, "A synthesized gesture over a scrollable element must move that element to its scroll boundary.");
assert.equal(strictCspPageScrolls.length, 0, "A nested synthesized gesture must not move the page when the inner element can consume it.");

strictCspScroll.scrollTop = 0;
strictCspScroll.addEventListener("wheel", (event) => event.preventDefault());
await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchMouseEvent", { type: "mouseWheel", x: 20, y: 30, deltaX: 0, deltaY: 120 });
assert.equal(
  strictCspScroll.scrollTop,
  0,
  "Canceling a synthetic wheel event must prevent the bridge from performing its default scroll action.",
);

const diagonalOuterScroll = new StrictCspScrollElement({ clientHeight: 100, clientWidth: 100, scrollHeight: 100, scrollWidth: 400 });
const diagonalInnerScroll = new StrictCspScrollElement({ clientHeight: 100, clientWidth: 100, scrollHeight: 400, scrollWidth: 100 });
diagonalInnerScroll.parentElement = diagonalOuterScroll;
strictCspHitTarget = diagonalInnerScroll;
await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchMouseEvent", { type: "mouseWheel", x: 20, y: 30, deltaX: 120, deltaY: 160 });
assert.equal(diagonalInnerScroll.scrollTop, 160, "The first vertically eligible scroller must consume the vertical axis.");
assert.equal(diagonalOuterScroll.scrollLeft, 120, "An unconsumed horizontal axis must continue to the next eligible ancestor scroller.");

const multiSelect = new StrictCspSelectElement(["Alpha", "Beta", "Gamma"], { multiple: true });
multiSelect.setSelectedIndices([0, 2]);
strictCspDocument.activeElement = multiSelect;
await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown" });
assert.deepEqual(
  multiSelect.options.map((option) => option.selected),
  [true, false, true],
  "An unmodified ArrowDown in a multi-select must not collapse its selected-option set.",
);
assert.deepEqual(
  multiSelect.events.filter(({ type }) => type === "input" || type === "change").map(({ type }) => type),
  [],
  "An unmodified ArrowDown in a multi-select must not emit destructive input or change events.",
);

const optgroupSelect = new StrictCspSelectElement(["Allowed", "Disabled group option", "Allowed after group"]);
optgroupSelect.options[1].parentElement = { disabled: true, tagName: "OPTGROUP" };
strictCspDocument.activeElement = optgroupSelect;
await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown" });
assert.equal(
  optgroupSelect.selectedIndex,
  2,
  "Keyboard select navigation must skip an option disabled through its optgroup.",
);

strictCspChildFrameScrolls.length = 0;
strictCspFrameHit = { left: 10, ownerIndex: 0, resolvedFrameUrl: "https://child.test/", sameUrlOwnerIndex: 0, top: 10 };
const childScrollOperationStart = cspSafeOperations.length;
await compat.debugger.sendCommand({ tabId: 1 }, "Input.synthesizeScrollGesture", { x: 30, y: 40, xDistance: 0, yDistance: -120 });
assert.equal(
  cspSafeOperations.slice(childScrollOperationStart).find(({ operation }) => operation === "synthesizeScroll")?.target.frameIds?.[0],
  7,
  "A synthesized scroll whose hit target is inside a child frame must be routed to that child frame.",
);
assert.equal(strictCspChildFrameScrolls.length, 1, "The child frame must receive the synthesized scroll operation.");
assert.equal(
  strictCspChildFrameScrolls.at(-1).x,
  20,
  "A child-frame synthesized scroll must translate its horizontal coordinate from the parent viewport.",
);
assert.equal(
  strictCspChildFrameScrolls.at(-1).y,
  30,
  "A child-frame synthesized scroll must translate its vertical coordinate from the parent viewport.",
);
strictCspFrameHit = null;
strictCspDocument.activeElement = strictCspInput;
strictCspHitTarget = strictCspScroll;

strictCspHitTarget = strictCspShadowHost;
await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchMouseEvent", { type: "mousePressed", button: "left", x: 20, y: 30 });
await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", x: 20, y: 30 });
assert.equal(strictCspShadowButton.clickCount, 1, "A pointer click must activate the deepest element inside an open shadow root.");
strictCspHitTarget = strictCspInput;
await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchMouseEvent", { type: "mouseMoved", x: 10, y: 20 });
const strictMouseMove = strictCspInput.events.filter(({ type }) => type === "mousemove").at(-1);
assert.equal(strictMouseMove.buttons, 0, "A plain mouse move must not imply that the left button is pressed.");

const untrustedPlaywrightHelper = {
  __codexFirefoxPlaywrightHelperBrand: "codex-firefox-playwright-helper-v1",
  parseSelector() { throw new Error("Page-controlled helper must never be trusted."); },
  querySelectorAll() { return [strictCspInput]; },
};
strictCspPage.__codexPlaywrightInjected = untrustedPlaywrightHelper;
const playwrightInstall = await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
  expression: `(() => {
    if (!window.__codexPlaywrightInjected) {
      window.__codexPlaywrightInjected = new PlaywrightInjected.InjectedScript(window, {});
    }
  })()`,
  awaitPromise: true,
  returnByValue: false,
});
assert.equal(playwrightInstall.result.type, "undefined", "The optional Playwright helper install must not use eval under strict CSP.");
const trustedPlaywrightHelper = strictCspPage.__codexPlaywrightInjected;
assert.notStrictEqual(trustedPlaywrightHelper, untrustedPlaywrightHelper, "The bridge must replace an untrusted truthy page-defined Playwright helper global.");
assert.equal(
  trustedPlaywrightHelper.__codexFirefoxPlaywrightHelperBrand,
  "codex-firefox-playwright-helper-v1",
  "The installed Firefox Playwright helper must expose its stable identifier.",
);
const cssMatches = trustedPlaywrightHelper.querySelectorAll(
  trustedPlaywrightHelper.parseSelector('input[type="file"]'),
  strictCspDocument,
);
assert.equal(cssMatches.length, 1, "The branded helper must support its advertised CSS selector subset.");
assert.strictEqual(cssMatches[0], controlledUploadInput);
const labelMatches = trustedPlaywrightHelper.querySelectorAll(
  trustedPlaywrightHelper.parseSelector('internal:label="Controlled upload"i'),
  strictCspDocument,
);
assert.equal(labelMatches.length, 1, "The branded helper must support its advertised internal:label selector subset.");
assert.strictEqual(labelMatches[0], controlledUploadInput);
await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
  expression: `(() => {
    if (!window.__codexPlaywrightInjected) {
      window.__codexPlaywrightInjected = new PlaywrightInjected.InjectedScript(window, {});
    }
  })()`,
  awaitPromise: true,
  returnByValue: false,
});
const reinstalledPlaywrightHelper = strictCspPage.__codexPlaywrightInjected;
assert.notStrictEqual(
  reinstalledPlaywrightHelper,
  trustedPlaywrightHelper,
  "Each install must replace the page global with a fresh valid helper because the public brand is forgeable in the MAIN world.",
);
const reinstalledCssMatches = reinstalledPlaywrightHelper.querySelectorAll(
  reinstalledPlaywrightHelper.parseSelector('input[type="file"]'),
  strictCspDocument,
);
assert.equal(reinstalledCssMatches.length, 1, "A reinstalled helper must retain the advertised CSS selector subset.");
assert.strictEqual(reinstalledCssMatches[0], controlledUploadInput);
const reinstalledLabelMatches = reinstalledPlaywrightHelper.querySelectorAll(
  reinstalledPlaywrightHelper.parseSelector('internal:label="Controlled upload"i'),
  strictCspDocument,
);
assert.equal(reinstalledLabelMatches.length, 1, "A reinstalled helper must retain the advertised internal:label selector subset.");
assert.strictEqual(reinstalledLabelMatches[0], controlledUploadInput);

const caseSensitiveLabelInput = new StrictCspInputElement();
caseSensitiveLabelInput.attributeValues.set("aria-label", "Case Sensitive Label");
strictCspControlCandidates.push(caseSensitiveLabelInput);
const caseInsensitiveLabelMatches = reinstalledPlaywrightHelper.querySelectorAll(
  reinstalledPlaywrightHelper.parseSelector('internal:label="case sensitive label"i'),
  strictCspDocument,
);
assert.equal(
  caseInsensitiveLabelMatches.length,
  1,
  "internal:label with the i flag must compare labels case-insensitively.",
);
assert.strictEqual(caseInsensitiveLabelMatches[0], caseSensitiveLabelInput);
const caseSensitiveLabelMatches = reinstalledPlaywrightHelper.querySelectorAll(
  reinstalledPlaywrightHelper.parseSelector('internal:label="case sensitive label"s'),
  strictCspDocument,
);
assert.equal(
  caseSensitiveLabelMatches.length,
  0,
  "internal:label with the s flag must preserve the selector's case sensitivity.",
);
strictCspControlCandidates.pop();

const whitespaceLabelInput = new StrictCspInputElement();
whitespaceLabelInput.attributeValues.set("aria-label", "  Primary   Email Address  ");
strictCspControlCandidates.push(whitespaceLabelInput);
const normalizedSubstringMatches = reinstalledPlaywrightHelper.querySelectorAll(
  reinstalledPlaywrightHelper.parseSelector('internal:label="email"i'),
  strictCspDocument,
);
assert.equal(
  normalizedSubstringMatches.length,
  1,
  "internal:label with i must match a normalized-whitespace, case-insensitive substring.",
);
assert.strictEqual(normalizedSubstringMatches[0], whitespaceLabelInput);
const normalizedSensitiveExactMatches = reinstalledPlaywrightHelper.querySelectorAll(
  reinstalledPlaywrightHelper.parseSelector('internal:label="Primary Email Address"s'),
  strictCspDocument,
);
assert.equal(
  normalizedSensitiveExactMatches.length,
  1,
  "internal:label with s must use normalized-whitespace exact matching.",
);
assert.strictEqual(normalizedSensitiveExactMatches[0], whitespaceLabelInput);
const normalizedSensitiveSubstringMatches = reinstalledPlaywrightHelper.querySelectorAll(
  reinstalledPlaywrightHelper.parseSelector('internal:label="email"s'),
  strictCspDocument,
);
assert.equal(
  normalizedSensitiveSubstringMatches.length,
  0,
  "internal:label with s must not change exact matching into substring matching.",
);
const wrongCaseSensitiveExactMatches = reinstalledPlaywrightHelper.querySelectorAll(
  reinstalledPlaywrightHelper.parseSelector('internal:label="primary email address"s'),
  strictCspDocument,
);
assert.equal(
  wrongCaseSensitiveExactMatches.length,
  0,
  "internal:label with s must preserve case sensitivity after normalizing whitespace.",
);
strictCspControlCandidates.pop();

const dynamicEvaluationAttemptsBeforeHelperFallback = strictCspDynamicEvaluationAttempts;
await assert.rejects(
  compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
    expression: unrecognizedPlaywrightHelperExpression,
    returnByValue: true,
  }),
  /strict-CSP/u,
  "The first unsupported Playwright helper evaluation must report the strict-CSP compatibility limit.",
);
assert.equal(
  strictCspDynamicEvaluationAttempts,
  dynamicEvaluationAttemptsBeforeHelperFallback + 1,
  "The first unsupported Playwright helper evaluation may make one authoritative dynamic-evaluation attempt to detect strict CSP.",
);
await assert.rejects(
  compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
    expression: unrecognizedPlaywrightHelperExpression,
    returnByValue: true,
  }),
  /strict-CSP/u,
  "A repeated unsupported Playwright helper evaluation must use the cached strict-CSP result.",
);
assert.equal(
  strictCspDynamicEvaluationAttempts,
  dynamicEvaluationAttemptsBeforeHelperFallback + 1,
  "A cached strict-CSP result must prevent repeated CSP-blocked dynamic evaluations in the same frame.",
);

// This covers direct debugger DOM-domain resolution only. It does not exercise
// the installed client's live Playwright locator pipeline.
const locatorDocument = await compat.debugger.sendCommand({ tabId: 1 }, "DOM.getDocument", { depth: 2 });
assert.equal(locatorDocument.root.nodeId, 1, "Direct DOM.getDocument must expose a top-level document root.");
const locatorMatch = await compat.debugger.sendCommand({ tabId: 1 }, "DOM.querySelector", {
  nodeId: locatorDocument.root.nodeId,
  selector: 'input[type="file"]',
});
assert.notEqual(locatorMatch.nodeId, 0, "Direct DOM.querySelector must resolve the controlled file input.");
const locatorNode = await compat.debugger.sendCommand({ tabId: 1 }, "DOM.describeNode", { nodeId: locatorMatch.nodeId });
assert.deepEqual(locatorNode.node.attributes, ["type", "file", "aria-label", "Controlled upload"]);
const locatorObject = await compat.debugger.sendCommand({ tabId: 1 }, "DOM.resolveNode", { nodeId: locatorMatch.nodeId });
assert.equal(locatorObject.object.subtype, "node", "The directly resolved DOM node must remain usable through the runtime object bridge.");

const playwrightSnapshot = await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
  expression: `(() => {
    const snapshot = injectedScript.incrementalAriaSnapshot(document.body, { mode: "ai" });
    return { ...snapshot, iframeRefs: snapshot.iframeRefs };
  })()`,
  returnByValue: true,
});
assert.match(playwrightSnapshot.result.value.full, /Strict CSP/u);
assert.equal(cspSafeOperations.at(-1).operation, "playwrightDomSnapshot", "playwright.domSnapshot must use a CSP-safe implementation.");

const passwordSentinel = "STRICT_CSP_PASSWORD_MUST_NOT_LEAK";
const originalInputValue = strictCspInput.value;
strictCspInput.type = "password";
strictCspInput.value = passwordSentinel;
strictCspInput.attributeValues.delete("aria-label");
const passwordSnapshot = await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
  expression: `(() => {
    const snapshot = injectedScript.incrementalAriaSnapshot(document.body, { mode: "ai" });
    return { ...snapshot, iframeRefs: snapshot.iframeRefs };
  })()`,
  returnByValue: true,
});
assert.doesNotMatch(passwordSnapshot.result.value.full, new RegExp(passwordSentinel, "u"), "Playwright snapshots must never expose live password values.");
assert.match(passwordSnapshot.result.value.full, /textbox/u, "Password controls should remain discoverable without exposing their values.");
strictCspInput.type = "text";
strictCspInput.value = originalInputValue;
strictCspInput.attributeValues.set("aria-label", "Strict CSP");

const visibleDomOptions = {
  booleanAttributeNames: ["checked", "disabled"],
  codexOverlayRootId: "codex-overlay",
  interactiveRoleNames: ["button", "textbox"],
  interactiveTags: ["button", "input", "textarea"],
  maxChars: 20_000,
  maxElements: 200,
  renderedAttributeNames: ["aria-label", "placeholder", "role", "type", "value"],
  reviewerOnly: false,
  viewportClip: null,
};
const visibleDom = await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
  expression: `(() => {
    const state = globalThis.__browserUseVisibleDomState;
    const interactiveRoleNames = true;
    const renderedAttributeNames = true;
    return captureVisibleDom(${JSON.stringify(visibleDomOptions)});
  })()`,
  returnByValue: true,
});
assert.match(visibleDom.result.value.items[0].line, /Strict CSP/u);
assert.equal(cspSafeOperations.at(-1).operation, "visibleDomSnapshot", "dom_cua.get_visible_dom must use a CSP-safe implementation.");
const visibleDomPoint = await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
  expression: `(() => {
    return (function visibleDomPoint(ref, viewportClip) {
      const element = globalThis.__browserUseVisibleDomState?.refToElement.get(ref);
      element?.scrollIntoView();
      return element?.getClientRects();
    })(${JSON.stringify("1")}, ${JSON.stringify({ bottom: 100, left: 0, right: 100, top: 0 })});
  })()`,
  returnByValue: true,
});
assert.equal(JSON.stringify(visibleDomPoint.result.value), JSON.stringify({ x: 25, y: 35 }));
assert.equal(cspSafeOperations.at(-1).operation, "visibleDomPoint", "DOM CUA node resolution must survive strict CSP.");

for (const call of executeScriptCalls.filter(({ func }) => func?.name === "runCspSafePageOperation")) {
  assert.equal(call.world, "MAIN", "CSP-safe page operations must run in the page's main world.");
  assert.equal(call.injectImmediately, true, "CSP-safe page operations must request immediate injection.");
}
assert.ok(cspSafeOperations.length > strictCspOperationStart);
await assert.rejects(
  compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", { expression: "document.title", returnByValue: true }),
  /Firefox bridge is connected.*strict-CSP/u,
  "Unsupported dynamic evaluation should explain the compatibility limit without claiming the bridge is unavailable.",
);
await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
  expression: `globalThis.__browserUseClipboardBridge?.bindingName === ${JSON.stringify(browserUseBindingName)} && globalThis.__browserUseClipboardBridge.cleanup()`,
  returnByValue: true,
});
await compat.debugger.sendCommand({ tabId: 1 }, "Page.removeScriptToEvaluateOnNewDocument", { identifier: clipboardInit.identifier });
await compat.debugger.sendCommand({ tabId: 1 }, "Runtime.removeBinding", { name: browserUseBindingName });
const childFrameDebuggee = { tabId: 1, sessionId: "firefox-session-1-7" };
const childFrameCspAttemptStart = strictCspDynamicEvaluationAttempts;
await assert.rejects(
  compat.debugger.sendCommand(childFrameDebuggee, "Runtime.evaluate", {
    expression: unrecognizedPlaywrightHelperExpression,
    returnByValue: true,
  }),
  /strict-CSP/u,
  "The child frame must record its own strict-CSP helper evaluation result.",
);
assert.equal(
  strictCspDynamicEvaluationAttempts,
  childFrameCspAttemptStart + 1,
  "The first child-frame helper evaluation must make one strict-CSP detection attempt.",
);
browser.webNavigation.onCommitted.emit({
  tabId: 1,
  frameId: 7,
  parentFrameId: 0,
  url: "https://child-next.test/",
});
await new Promise((resolve) => setTimeout(resolve, 0));
strictCspEnabled = false;
await assert.rejects(
  compat.debugger.sendCommand({ tabId: 1 }, "Runtime.evaluate", {
    expression: unrecognizedPlaywrightHelperExpression,
    returnByValue: true,
  }),
  /strict-CSP/u,
  "A child-frame navigation must not clear the cached strict-CSP result for a different frame.",
);
const childFrameAfterNavigation = await compat.debugger.sendCommand(
  childFrameDebuggee,
  "Runtime.evaluate",
  {
    expression: unrecognizedPlaywrightHelperExpression,
    returnByValue: true,
  },
);
assert.equal(
  childFrameAfterNavigation.result.value,
  "child-evaluation",
  "A committed child-frame navigation must clear that frame's strict-CSP cache for the new document.",
);
assert.equal(
  strictCspDynamicEvaluationAttempts,
  childFrameCspAttemptStart + 1,
  "The child frame's fresh non-CSP document must dynamically evaluate without another CSP detection attempt.",
);

await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Control", code: "ControlLeft", text: "" });
assert.equal(cspSafeOperations.at(-1).operation, "dispatchKeyboard", "Keyboard input must use the CSP-safe page-operation path.");
assert.doesNotMatch(cspSafeFunctionSources.at(-1), /\beval\s*\(/u, "CSP-safe page operations must not dynamically evaluate source text.");
assert.equal(cspSafeOperations.at(-1).target.frameIds[0], 7, "CSP-safe keyboard input must preserve focused child-frame routing.");

await compat.debugger.sendCommand({ tabId: 1 }, "Accessibility.getFullAXTree", {});
assert.equal(cspSafeOperations.at(-1).operation, "accessibilityTree", "Accessibility inspection must survive strict page CSP.");
const snapshotOperationStart = cspSafeOperations.length;
await compat.debugger.sendCommand({ tabId: 1 }, "DOMSnapshot.captureSnapshot", {});
assert.ok(cspSafeOperations.slice(snapshotOperationStart).some(({ operation }) => operation === "captureDomSnapshot"), "DOM snapshots must survive strict page CSP.");
await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchMouseEvent", { type: "mousePressed", x: 20, y: 30, button: "left" });
assert.equal(cspSafeOperations.at(-1).operation, "dispatchMouse", "Pointer input must survive strict page CSP.");
await compat.debugger.sendCommand({ tabId: 1 }, "Input.insertText", { text: "hello" });
assert.equal(cspSafeOperations.at(-1).operation, "insertText", "Text insertion must survive strict page CSP.");

const owner = await compat.debugger.sendCommand({ tabId: 1 }, "DOM.getFrameOwner", { frameId: "firefox-frame-1-7" });
assert.equal(owner.nodeId, 3, "Child-frame owner was not resolved in its parent frame.");
const topOwner = await compat.debugger.sendCommand({ tabId: 1 }, "DOM.getFrameOwner", { frameId: "firefox-frame-1" });
assert.equal(topOwner.nodeId, 0, "Top-level snapshot documents should be treated as ownerless.");
assert.equal(topOwner.backendNodeId, 0, "Top-level snapshot documents should have no backend owner node.");
const describedFrameOwner = await compat.debugger.sendCommand({ tabId: 1 }, "DOM.describeNode", { nodeId: 3 });
assert.equal(describedFrameOwner.node.frameId, "firefox-frame-1-7", "Iframe owner nodes must identify their child frame, not their parent frame.");
assert.equal(cspSafeOperations.at(-1).operation, "describeNode", "DOM.describeNode must survive strict page CSP.");
const describedDiv = await compat.debugger.sendCommand({ tabId: 1 }, "DOM.describeNode", { nodeId: 4 });
assert.equal(describedDiv.node.frameId, undefined, "Ordinary DOM nodes must not be labeled as frame owners.");

await compat.debugger.sendCommand({ tabId: 1 }, "Network.enable", {});
const beforeRequest = webRequest.onBeforeRequest.listeners[0];
beforeRequest({ requestId: "req-1", tabId: 1, frameId: 7, parentFrameId: 0, url: "https://child.test/data.json", method: "GET", type: "xmlhttprequest", timeStamp: 1000 });
assert.ok(events.some((event) => event.method === "Network.requestWillBeSent" && event.params.frameId === "firefox-frame-1-7"));
const filter = webRequest.filters.get("req-1");
filter.ondata({ data: new TextEncoder().encode('{"ok":true}').buffer });
filter.onstop();
const body = await compat.debugger.sendCommand({ tabId: 1 }, "Network.getResponseBody", { requestId: "firefox-request-req-1" });
assert.equal(body.base64Encoded, true);
assert.equal(atob(body.body), '{"ok":true}');

await compat.debugger.sendCommand({ tabId: 1 }, "Fetch.enable", { patterns: [{ urlPattern: "*intercept*", requestStage: "Request" }] });
const pausePromise = beforeRequest({ requestId: "req-2", tabId: 1, frameId: 0, parentFrameId: -1, url: "https://top.test/intercept", method: "GET", type: "xmlhttprequest", timeStamp: 1100 });
await new Promise((resolve) => setTimeout(resolve, 0));
const paused = events.findLast((event) => event.method === "Fetch.requestPaused");
assert.ok(paused?.params.requestId, "Fetch interception did not pause the request.");
await compat.debugger.sendCommand({ tabId: 1 }, "Fetch.fulfillRequest", { requestId: paused.params.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "text/plain" }], body: btoa("synthetic") });
const blockingResponse = await pausePromise;
assert.ok(blockingResponse.redirectUrl.startsWith("data:text/plain;base64,"));

await compat.debugger.sendCommand({ tabId: 1 }, "Fetch.enable", { patterns: [] });
const pauseCount = events.filter((event) => event.method === "Fetch.requestPaused").length;
const unpausedResponse = beforeRequest({ requestId: "req-3", tabId: 1, frameId: 0, parentFrameId: -1, url: "https://top.test/intercept-again", method: "GET", type: "xmlhttprequest", timeStamp: 1200 });
assert.equal(JSON.stringify(unpausedResponse), "{}", "Empty Fetch patterns must clear interception instead of pausing every request.");
assert.equal(events.filter((event) => event.method === "Fetch.requestPaused").length, pauseCount);

// Reproduce Codex attachment without activating the user's background target.
await compat.debugger.detach({ tabId: 1 });
const updatesBeforeAttach = tabUpdateCalls.length;
targetTabActive = false;
await compat.debugger.attach({ tabId: 1 });
await compat.debugger.sendCommand({ tabId: 1 }, "Page.enable", {});
await compat.debugger.sendCommand({ tabId: 1 }, "Page.setLifecycleEventsEnabled", { enabled: true });
const lifecycleStart = events.length;
const navigation = { tabId: 1, frameId: 0, parentFrameId: -1, url: "https://top.test/next" };
browser.webNavigation.onCommitted.emit(navigation);
browser.webNavigation.onDOMContentLoaded.emit(navigation);
browser.webNavigation.onCompleted.emit(navigation);
const lifecycle = events.slice(lifecycleStart).filter(event => event.method === "Page.lifecycleEvent");
assert.deepEqual(lifecycle.map(event => event.params.name), ["init", "DOMContentLoaded", "load"]);
assert.equal(new Set(lifecycle.map(event => event.params.loaderId)).size, 1);
assert.ok(lifecycle.every(event => Number.isFinite(event.params.timestamp) && event.params.frameId === "firefox-frame-1"));
const navigated = events.slice(lifecycleStart).find(event => event.method === "Page.frameNavigated");
assert.equal(navigated.params.frame.loaderId, lifecycle[0].params.loaderId);
const lifecycleTree = await compat.debugger.sendCommand({ tabId: 1 }, "Page.getFrameTree", {});
assert.equal(lifecycleTree.frameTree.frame.loaderId, lifecycle[0].params.loaderId);
assert.equal(tabUpdateCalls.length, updatesBeforeAttach, "Attaching and subscribing must not activate a background tab.");
browser.webNavigation.onCommitted.emit(navigation);
assert.notEqual(events.findLast(event => event.method === "Page.lifecycleEvent").params.loaderId, lifecycle[0].params.loaderId);
await compat.debugger.sendCommand({ tabId: 1 }, "Page.setLifecycleEventsEnabled", { enabled: false });
const disabledCount = events.filter(event => event.method === "Page.lifecycleEvent").length;
browser.webNavigation.onCompleted.emit(navigation);
assert.equal(events.filter(event => event.method === "Page.lifecycleEvent").length, disabledCount);
await compat.debugger.sendCommand({ tabId: 1 }, "Page.setLifecycleEventsEnabled", { enabled: true });
await compat.debugger.detach({ tabId: 1 });
await compat.debugger.attach({ tabId: 1 });
browser.webNavigation.onCompleted.emit(navigation);
assert.equal(events.filter(event => event.method === "Page.lifecycleEvent").length, disabledCount, "Detach must clear lifecycle subscriptions.");

const fragmentNavigation = await compat.debugger.sendCommand({ tabId: 1 }, "Page.navigate", { url: "https://top.test/#section" });
assert.equal(fragmentNavigation.loaderId, undefined, "Fragment-only navigation must not reserve a new document loader.");

// Document requests precede commit; redirects and late responses retain their loader.
await compat.debugger.sendCommand({ tabId: 1 }, "Network.enable", {});
await compat.debugger.sendCommand({ tabId: 1 }, "Page.setLifecycleEventsEnabled", { enabled: true });
for (const frameId of [0, 7]) {
  const navResult = frameId === 0
    ? await compat.debugger.sendCommand({ tabId: 1 }, "Page.navigate", { url: "https://top.test/document" })
    : null;
  const request = { requestId: `document-${frameId}`, tabId: 1, frameId, parentFrameId: frameId ? 0 : -1, url: "https://top.test/document", method: "GET", type: frameId ? "sub_frame" : "main_frame", timeStamp: 2000 };
  // Child navigation uses the frame's own target session in production; reserve
  // only the root navigation here, then exercise child webRequest allocation.
  beforeRequest(request);
  const requestEvent = events.findLast(event => event.method === "Network.requestWillBeSent");
  if (frameId === 0) assert.equal(requestEvent.params.loaderId, navResult.loaderId);
  webRequest.onBeforeRedirect.emit({ ...request, redirectUrl: "https://top.test/redirected", statusCode: 302 });
  assert.equal(events.findLast(event => event.method === "Network.requestWillBeSent").params.loaderId, requestEvent.params.loaderId);
  beforeRequest({ ...request, url: "https://top.test/redirected" });
  browser.webNavigation.onCommitted.emit({ ...request, url: "https://top.test/redirected" });
  const committedLoader = events.findLast(event => event.method === "Page.frameNavigated").params.frame.loaderId;
  assert.equal(committedLoader, requestEvent.params.loaderId);
  assert.equal(events.findLast(event => event.method === "Page.lifecycleEvent").params.loaderId, committedLoader);
  const subresource = { ...request, requestId: `resource-${frameId}`, type: "xmlhttprequest" };
  beforeRequest(subresource);
  assert.equal(events.findLast(event => event.method === "Network.requestWillBeSent").params.loaderId, committedLoader);
  // A response from the old document must keep its original loader after a new navigation.
  browser.webNavigation.onCommitted.emit({ ...request, url: "https://top.test/newer" });
  webRequest.onHeadersReceived.emit({ ...subresource, statusCode: 200, responseHeaders: [] });
  assert.equal(events.findLast(event => event.method === "Network.responseReceived").params.loaderId, committedLoader);
}

console.log(JSON.stringify({ ok: true, bridgeIdentity: true, toolbarSettings: true, nativeSidebarTracking: true, hostAccessPreflight: true, screenshotFallback: true, frameTree: true, childExecution: true, cspSafeInput: true, strictCspBrowserUse: true, liveNetworkEvents: true, responseBody: true, fetchInterception: true, fetchEmptyPatternClear: true }, null, 2));
