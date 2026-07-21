# Codex Computer Use for Firefox & Zen — port status

Live verification was completed on July 15, 2026 with Zen 1.21.6b, Gecko/Firefox 152.0.5, and the packaged OpenAI extension version `1.2.27203.26575`. All work described here stays in the normal WebExtension tier: no browser flags, patched Zen build, privileged experiment API, or external automation daemon is required.

## End-to-end test evidence

The extension was loaded temporarily from `extension/manifest.json`, its optional Firefox permission was enabled, and the machine-local adapter was registered under its fixed Gecko ID. The publication build uses `codex-computer-use-firefox-zen@sunkenintime`; the adapter allowlist is generated from the matching project registration script.

- The real signed-in ChatGPT sidebar rendered its New task UI while browser automation remained connected and functional.
- Semantic and direct computer-use input produced `clicked:final-firefox-smoke` and `clicked:cua-direct-ok` in the fixture.
- Checkbox state changed to `true`; wheel scrolling reached the fixture's bottom section.
- A controlled upload returned `upload.txt:Firefox upload bridge verified.` from the page.
- HTML5 drag-and-drop returned `firefox-drag-ok`.
- A nested cross-origin frame tree was expanded without recursion. Playwright fill/type/click produced `frame-clicked:playwright-frame-typed`, DOM computer use wrote `dom-cua-frame`, and the grandchild frame exposed `nested-frame-ready`.
- Screenshots were nonempty images, including an 89,653-byte live acceptance capture.
- Tab lifecycle changed from one controlled tab to two and back to one without affecting unrelated user tabs.
- Navigate, back, forward, reload, cookies, title, URL, and browser metadata were exercised.
- An 800 x 600 viewport override measured exactly 800 x 600 with the sidebar both closed and open, then reset to 2048 x 1234.
- A second live emulation pass measured exactly 900 x 700 while also reporting DPR 2, five touch points, `fr-CA`, `America/New_York`, and the overridden user agent; reset restored 2048 x 1234.
- Translated network events included request, response, and load completion. `Network.getResponseBody` returned the complete 232-byte SVG body. Explicit `Fetch` interception and synthetic fulfillment pass the protocol test, and `Fetch.enable({patterns: []})` correctly clears interception before navigation/reload.
- `Page.getFrameTree` returned the main document plus child and grandchild, while `DOMSnapshot.captureSnapshot` returned all three documents.
- Confirm and prompt calls are discoverable through the normal browser dialog API; accepted choices are replayed into the originating control so typical event-driven pages observe the chosen result.
- Static and native integration tests pass. `web-ext lint` reports 0 errors, 0 notices, and 67 warnings inherited from minified application code or intentional compatibility serialization.

The reusable fixture is `tests/fixtures/browser-control.html`; `npm test` covers the protocol-level native-message, upload, and WebSocket relay paths.

## Genuine Firefox limitations

Normal ChatGPT computer-use workflows reached feature parity in testing. The remaining differences concern primitives that Firefox WebExtensions do not expose:

1. Firefox provides no extension API that can keep the JavaScript main thread synchronously blocked while a controller later accepts a native `confirm` or `prompt`. The port reports the dialog immediately and, for event-driven calls, replays the focused originating control once with the selected one-shot result. This gives the expected final result for ordinary button handlers, but page-side effects performed *before* the dialog call can occur twice. DOM-based dialogs have no such caveat.
2. `Fetch.fulfillRequest` is implemented by redirecting the intercepted request to an equivalent `data:` response. Status, headers, body, and normal consumer behavior are covered, but code that requires the synthetic response to retain the original request URL or exact redirect history can observe a difference.
3. DevTools-only tracing and JavaScript debugger pause/resume commands are compatibility no-ops. They are not part of the extension's user-facing computer-use workflow.
4. Firefox does not expose Chrome renderer/debugger targets. The port synthesizes target/session/frame scoping for the CDP methods used by computer use, including tested nested cross-origin interaction, but it is not a general replacement for every third-party CDP debugger client.
5. The tested manifest requires Firefox 152 or newer. Older Firefox releases may work but were not certified.
6. The generated archive is unsigned. Firefox/Zen removes a temporary add-on at restart; permanent distribution requires Mozilla signing. This is an installation constraint, not a runtime feature difference.

Firefox also lacks Chrome's extension debugger API and service-worker/side-panel combination used by the original package. Those are handled by the compatibility layer and do not remain user-visible limitations in the tested build.
