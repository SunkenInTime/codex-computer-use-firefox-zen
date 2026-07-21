# Codex Computer Use for Zen & Fox

This is a Firefox-compatible port of OpenAI's official browser extension (`hehggadaopoacecdllhhajmbjkdcmajg`), based on packaged extension version `1.2.27203.26576`. Zen is supported as a Firefox browser and was the primary live-test target.

This is an independent compatibility project. It is not an official OpenAI, Mozilla, or Zen Browser release and is not endorsed by those organizations. You need an existing ChatGPT/Codex installation and account; this repository does not include or bypass account access.

The original OpenAI sidebar and background application are retained. The compatibility layer adds:

- Firefox `sidebar_action` support in place of Chrome `sidePanel`;
- a persistent Firefox background page in place of a Manifest V3 service worker;
- translation of the `chrome.debugger`/CDP operations used by OpenAI's browser-control client into Firefox tab, cookie, screenshot, scripting, DOM, and input APIs;
- a native-messaging adapter that securely relays to the locally installed official OpenAI extension host;
- local-file transfer for controlled file inputs;
- exact device-viewport emulation, restored after each run;
- HTML5 and pointer drag-and-drop, page-resource discovery, and resource-body transfer;
- frame-scoped DOM, input, clipboard, and CDP translation across nested cross-origin iframes;
- translated `Network` lifecycle/body capture, `Fetch` interception, emulation, and JavaScript-dialog handling.

## Verified parity

The port has been exercised against the real signed-in OpenAI sidebar in Zen, not only against mocks.

| Capability | Result |
| --- | --- |
| Open/close the signed-in ChatGPT sidebar and render its New task UI | Pass |
| DOM snapshot and semantic element lookup | Pass |
| Pointer click, text input, keyboard input, and checkbox input | Pass |
| Nested cross-origin iframe snapshot, fill, type, click, and DOM computer use | Pass |
| Wheel scrolling and anchor navigation | Pass |
| HTML5 drag-and-drop | Pass |
| File chooser interception and local-file upload | Pass |
| Visible-tab screenshots | Pass |
| Tab create/list/activate/close | Pass |
| Navigate, back, forward, and reload | Pass |
| Cookies and browser metadata | Pass |
| Exact viewport override and reset | Pass |
| Network lifecycle, response bodies, `Fetch` interception, and synthetic fulfillment | Pass |
| Device, locale, timezone, touch, user-agent, and viewport emulation with reset | Pass |
| Confirm/prompt discovery and accepted-result replay | Pass, with the native-dialog caveat below |
| Sidebar and browser automation at the same time | Pass |

See [PORT_STATUS.md](PORT_STATUS.md) for the test evidence and the remaining low-level Firefox limitations.

## Install for local development

The OpenAI native extension host must already be installed by ChatGPT/Codex tooling on this machine.

1. Register the Firefox native-host adapter:

   ```powershell
   .\scripts\register-native-host.ps1
   ```

2. In Zen or Firefox, open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**, then choose `extension/manifest.json`.
4. Open the Codex computer-use sidebar from the toolbar button or its configured shortcut.
5. Start a Codex computer-use task. Page execution uses Firefox's standard `scripting.executeScript` API; the add-on does not request the user-script-manager-only `userScripts` permission.

Temporary add-ons are removed when the browser exits. Permanent installation requires Mozilla signing while retaining the Gecko ID `codex-computer-use-firefox-zen@sunkenintime`.

To remove only the Firefox native-host registration:

```powershell
.\scripts\unregister-native-host.ps1
```

## Verify and package

```powershell
npm test
npx --yes web-ext lint --source-dir extension --no-input
npm run package
```

`npm test` validates the manifest and compatibility surface, then runs native-protocol, upload, and WebSocket-relay integration tests. Packaging writes the unsigned extension archive, a matching review-source archive generated from the committed tree, and SHA-256 checksums to `dist/`.

`web-ext lint` currently reports zero errors. Its warnings are from the inherited minified OpenAI distribution (for example dynamic code and HTML construction) plus the compatibility layer's intentional page-world function serialization.

## Source and distribution note

`extension/codex-sidepanel` and `extension/background.js` are OpenAI's packaged distribution, not a clean-room source reimplementation. Those upstream assets remain subject to OpenAI's applicable terms. The compatibility code in this repository is provided for review and development; no additional license is granted for the bundled upstream assets.

See [PRIVACY.md](PRIVACY.md) for the extension's data-handling disclosure and [PORT_STATUS.md](PORT_STATUS.md) for detailed compatibility evidence.
