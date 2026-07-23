import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(
  path.join(root, "extension", "codex-sidepanel", "firefox-focus-compat.js"),
  "utf8",
);

class ElementMock {
  constructor({ editable = false, popupTrigger = false } = {}) {
    this.isContentEditable = editable;
    this.popupTrigger = popupTrigger;
  }

  contains(target) {
    return target === this;
  }

  closest(selector) {
    return selector === "[aria-haspopup]" && this.popupTrigger ? this : null;
  }
}

class InputMock extends ElementMock {}
class TextAreaMock extends ElementMock {}
class SelectMock extends ElementMock {}

const listeners = new Map();
const activeElement = new TextAreaMock();
let now = 100;
const context = vm.createContext({
  navigator: { userAgent: "Mozilla/5.0 Firefox/152.0" },
  performance: { now: () => now },
  document: { activeElement },
  HTMLInputElement: InputMock,
  HTMLTextAreaElement: TextAreaMock,
  HTMLSelectElement: SelectMock,
  window: {
    addEventListener(type, listener) {
      const handlers = listeners.get(type) ?? [];
      handlers.push(listener);
      listeners.set(type, handlers);
    },
  },
});

new vm.Script(source, { filename: "firefox-focus-compat.js" }).runInContext(context);

const dispatch = (type, event) => {
  for (const listener of listeners.get(type) ?? []) listener(event);
};

let stopped = false;
dispatch("pointerdown", { target: new ElementMock() });
dispatch("blur", { stopImmediatePropagation: () => { stopped = true; } });
assert.equal(stopped, true, "Transient sidebar blur should be suppressed after leaving the composer.");

stopped = false;
now += 1_000;
dispatch("blur", { stopImmediatePropagation: () => { stopped = true; } });
assert.equal(stopped, false, "A later, genuine window blur should not be suppressed.");

stopped = false;
dispatch("pointerdown", { target: activeElement });
dispatch("blur", { stopImmediatePropagation: () => { stopped = true; } });
assert.equal(stopped, false, "Interacting inside the active editor should not arm blur suppression.");

let prevented = false;
dispatch("mousedown", {
  target: new ElementMock({ popupTrigger: true }),
  preventDefault: () => { prevented = true; },
});
assert.equal(prevented, true, "Firefox must not refocus an open popup trigger during mousedown.");

prevented = false;
dispatch("mousedown", {
  target: new ElementMock(),
  preventDefault: () => { prevented = true; },
});
assert.equal(prevented, false, "Ordinary buttons must keep their default focus behavior.");

console.log(JSON.stringify({
  ok: true,
  transientBlurSuppressed: true,
  genuineBlurPreserved: true,
  popupTriggerRefocusPrevented: true,
}, null, 2));
