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

## Install

The Firefox add-on and its companion bridge are versioned together. Release
`1.3.0` adds companion installers for Windows and macOS:

- Windows: run `codex-firefox-bridge-<version>-windows-x64-setup.exe`. It installs
  per-user and does not require administrator access.
- macOS: open `codex-firefox-bridge-<version>-macos-universal.pkg`. The universal
  package supports both Apple Silicon and Intel Macs.

Install the companion once, then install the matching signed Firefox add-on.
The bridge discovers the official OpenAI extension host at runtime, so it does
not retain a repository path or a machine-specific Codex cache path. An existing
Codex/ChatGPT installation and the official Chrome integration are still
required.

### Local development

The OpenAI native extension host must already be installed by ChatGPT/Codex tooling on this machine.

1. Build and register the Firefox companion:

   Windows:
   ```powershell
   .\scripts\register-native-host.ps1
   ```

   macOS:
   ```sh
   ./scripts/register-native-host.sh
   ```

2. In Zen or Firefox, open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**, then choose `extension/manifest.json`.
4. Open the Codex computer-use sidebar from the toolbar button or its configured shortcut.
5. Start a Codex computer-use task. Page execution uses Firefox's standard `scripting.executeScript` API; the add-on does not request the user-script-manager-only `userScripts` permission.

Temporary add-ons are removed when the browser exits. Permanent installation requires Mozilla signing while retaining the Gecko ID `codex-computer-use-firefox-zen@sunkenintime`.

To remove only the development registration:

Windows:
```powershell
.\scripts\unregister-native-host.ps1
```

macOS:
```sh
./scripts/unregister-native-host.sh
```

## Verify and package

```powershell
npm test
npx --yes web-ext lint --source-dir extension --no-input
npm run package
```

`npm test` validates synchronized release versions, the manifest and compatibility
surface, then runs native-protocol, upload, and WebSocket-relay integration
tests. Packaging writes the unsigned extension archive, a matching review-source
archive generated from the committed tree, and SHA-256 checksums to `dist/`.

Pushing a semantic-version tag such as `v1.3.0` runs the release workflow. It
builds and tests the extension, a Windows x64 installer, and a universal macOS
package; verifies that the tag, extension, package, and companion versions
match; generates checksums; and attaches all artifacts to the GitHub release.
Prepare the next version with `npm run version:set -- MAJOR.MINOR.PATCH`; this
updates every version-bearing file together. Production releases should configure
the signing secrets described in `.github/workflows/release.yml`.

`web-ext lint` currently reports zero errors. Its warnings are from the inherited minified OpenAI distribution (for example dynamic code and HTML construction) plus the compatibility layer's intentional page-world function serialization.

## Source and distribution note

`extension/codex-sidepanel` and `extension/background.js` are OpenAI's packaged distribution, not a clean-room source reimplementation. Those upstream assets remain subject to OpenAI's applicable terms. The compatibility code in this repository is provided for review and development; no additional license is granted for the bundled upstream assets.

See [PRIVACY.md](PRIVACY.md) for the extension's data-handling disclosure and [PORT_STATUS.md](PORT_STATUS.md) for detailed compatibility evidence.
