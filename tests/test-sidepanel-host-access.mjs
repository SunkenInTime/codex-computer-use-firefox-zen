import assert from "node:assert/strict";
import {
  REQUIRED_HOST_ACCESS,
  ensureFirefoxHostAccess,
} from "../extension/codex-sidepanel/firefox-host-access.js";

class ElementMock {
  constructor(ownerDocument, tagName) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.textContent = "";
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  async click() { await this.listeners.get("click")?.(); }
}

function createDom() {
  const document = { createElement: (tagName) => new ElementMock(document, tagName) };
  const root = new ElementMock(document, "div");
  return { document, root };
}

function descendants(element) {
  return [element, ...element.children.flatMap(descendants)];
}

{
  const { root } = createDom();
  const extension = { permissions: { async contains(details) {
    assert.deepEqual(details, REQUIRED_HOST_ACCESS);
    return true;
  } } };
  assert.equal(await ensureFirefoxHostAccess({ extension, root }), true);
  assert.equal(root.children.length, 0, "Granted access must not replace the sidebar app.");
}

{
  const { root } = createDom();
  let granted = false;
  let reloads = 0;
  const extension = { permissions: {
    async contains() { return granted; },
    async request(details) {
      assert.deepEqual(details, REQUIRED_HOST_ACCESS);
      granted = true;
      return true;
    },
  } };
  assert.equal(await ensureFirefoxHostAccess({ extension, root, reload: () => { reloads += 1; } }), false);
  const nodes = descendants(root);
  const button = nodes.find((node) => node.tagName === "button");
  assert.equal(button?.textContent, "Allow all websites");
  await button.click();
  assert.equal(reloads, 1, "Granting host access must reload the sidebar app.");
}

{
  const { root } = createDom();
  let reloads = 0;
  const extension = { permissions: {
    async contains() { return false; },
    async request() { return false; },
  } };
  assert.equal(await ensureFirefoxHostAccess({ extension, root, reload: () => { reloads += 1; } }), false);
  const nodes = descendants(root);
  const button = nodes.find((node) => node.tagName === "button");
  await button.click();
  const status = nodes.find((node) => node.className === "firefox-host-access__status");
  assert.match(status.textContent, /not granted/u);
  assert.equal(reloads, 0, "Refusing host access must leave the permission screen visible.");
}

console.log(JSON.stringify({ ok: true, grantedBypass: true, userGrant: true, refusalRecovery: true }, null, 2));
