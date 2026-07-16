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
const browser = {
  runtime: {
    id: "codex-computer-use-firefox-zen@sunkenintime", onMessage: new EventMock(),
    async getBrowserInfo() { return { name: "Firefox", version: "152.0", buildID: "test" }; },
    connectNative() { throw new Error("not used"); },
  },
  permissions: { async request() { return true; } },
  sidebarAction: { async open() {}, async close() {} },
  tabs: {
    onUpdated: new EventMock(), onRemoved: new EventMock(),
    async query() { return [{ id: 1, windowId: 10, url: "https://top.test/", title: "Top", active: true }]; },
    async get() { return { id: 1, windowId: 10, url: "https://top.test/", title: "Top", active: true }; },
    async update() {}, async remove() {}, async reload() {}, async setZoom() {},
    async captureTab() { return "data:image/png;base64,dGVzdA=="; },
  },
  windows: { async get() { return { id: 10, state: "normal", width: 1200, height: 800, left: 0, top: 0 }; }, async update() { return {}; } },
  webNavigation: {
    onCommitted: new EventMock(), onCompleted: new EventMock(),
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
    async executeScript({ target, args }) {
      executedTargets.push(target);
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
  performance: { now: () => 100 }, navigator: { userAgent: "Firefox test" },
});
new vm.Script(source, { filename: "firefox-compat.js" }).runInContext(context);
const compat = context.__chatgptFirefoxCompat;
assert.ok(compat?.debugger, "Compatibility debugger was not installed.");

const events = [];
compat.debugger.onEvent.addListener((sourceInfo, method, params) => events.push({ sourceInfo, method, params }));
await compat.debugger.attach({ tabId: 1 });

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

await compat.debugger.sendCommand({ tabId: 1 }, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Control", code: "ControlLeft", text: "" });
assert.doesNotThrow(() => new Function(`return ${executedSources.at(-1)}`), "Synthesized keyboard script must remain valid when its Enter fallback contains a newline.");

const owner = await compat.debugger.sendCommand({ tabId: 1 }, "DOM.getFrameOwner", { frameId: "firefox-frame-1-7" });
assert.equal(owner.nodeId, 3, "Child-frame owner was not resolved in its parent frame.");
const topOwner = await compat.debugger.sendCommand({ tabId: 1 }, "DOM.getFrameOwner", { frameId: "firefox-frame-1" });
assert.equal(topOwner.nodeId, 0, "Top-level snapshot documents should be treated as ownerless.");
assert.equal(topOwner.backendNodeId, 0, "Top-level snapshot documents should have no backend owner node.");
const describedFrameOwner = await compat.debugger.sendCommand({ tabId: 1 }, "DOM.describeNode", { nodeId: 3 });
assert.equal(describedFrameOwner.node.frameId, "firefox-frame-1-7", "Iframe owner nodes must identify their child frame, not their parent frame.");
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

console.log(JSON.stringify({ ok: true, frameTree: true, childExecution: true, keyboardSyntax: true, liveNetworkEvents: true, responseBody: true, fetchInterception: true, fetchEmptyPatternClear: true }, null, 2));
