<p align="center">
  <img src="extension/images/firefox-zen-logo.png" alt="Codex Computer Use for Firefox and Zen Browser" width="180">
</p>

<h1 align="center">Codex Computer Use for Firefox & Zen</h1>

<p align="center">
  <strong>Bring the signed-in Codex sidebar and browser control to Firefox-family browsers.</strong>
</p>

<p align="center">
  <a href="https://addons.mozilla.org/firefox/addon/codex-computer-use-for-zen/"><img alt="Firefox Add-on" src="https://img.shields.io/amo/v/codex-computer-use-for-zen?logo=firefoxbrowser&amp;label=Firefox%20Add-on"></a>
  <a href="https://www.npmjs.com/package/codex-firefox-bridge"><img alt="npm bridge" src="https://img.shields.io/npm/v/codex-firefox-bridge?logo=npm&amp;label=native%20bridge"></a>
  <a href="https://github.com/SunkenInTime/codex-computer-use-firefox-zen/releases/latest"><img alt="Latest GitHub release" src="https://img.shields.io/github/v/release/SunkenInTime/codex-computer-use-firefox-zen?logo=github"></a>
</p>

<p align="center">
  <a href="https://addons.mozilla.org/firefox/addon/codex-computer-use-for-zen/"><strong>Install from Firefox Add-ons →</strong></a>
</p>

Codex Computer Use for Firefox translates the browser-control operations used by OpenAI's extension into Firefox APIs while preserving the familiar signed-in sidebar. Zen Browser is the primary live-test target, and Firefox is supported from the same signed add-on.

This is an independent compatibility project—not an official OpenAI, Mozilla, or Zen Browser release. It requires an existing ChatGPT/Codex account and installation; it does not provide or bypass account access.

## Why use it?

- **Work where you already browse.** Keep Codex beside your tabs in Firefox or Zen Browser.
- **Use real browser control.** Codex can inspect pages, click, type, scroll, navigate, upload files, take screenshots, and work across frames.
- **Keep the original experience.** The packaged OpenAI sidebar and background application remain intact; this project changes the compatibility and transport layers.
- **Recover clearly.** Missing companions, revoked site access, and bridge/extension version mismatches surface as actionable setup UI instead of silent connection failures.

## Install in three steps

### 1. Install the signed extension

[Install Codex Computer Use for Firefox from Mozilla Add-ons](https://addons.mozilla.org/firefox/addon/codex-computer-use-for-zen/), then pin or open **Codex for Firefox and Zen Browser** from the browser toolbar.

### 2. Install the matching native bridge

The add-on opens a one-time setup page with Windows, macOS, and Linux packages. You can also install the same per-user bridge from npm:

```sh
npx --yes codex-firefox-bridge@latest install
```

The bridge remains installed after `npx` exits. Check it at any time with:

```sh
npx --yes codex-firefox-bridge@latest doctor
```

Windows, universal Apple Silicon/Intel macOS, and Linux x64 packages are also attached to every [GitHub release](https://github.com/SunkenInTime/codex-computer-use-firefox-zen/releases/latest).

### 3. Open the sidebar

Keep the official Codex/ChatGPT Chrome integration installed, then open the Codex sidebar from the toolbar or press `Ctrl+Shift+.` (`Command+Shift+.` on macOS). If Firefox asks for website access, choose **Allow all websites** so browser control continues after navigation and in new tabs.

The add-on and bridge are released together. If their versions drift, the toolbar shows a red **SYNC** badge and opens a recovery screen with both installed versions and the correct update path.

## What works

The port has been exercised against the real signed-in OpenAI sidebar in Zen Browser, not only against mocks.

| Experience | Support |
| --- | --- |
| Signed-in Codex sidebar and New task UI | ✅ Verified |
| Semantic page inspection and element lookup | ✅ Verified |
| Click, type, keyboard, pointer, checkbox, and scroll input | ✅ Verified |
| Navigation, tab management, history, cookies, and downloads | ✅ Verified |
| Screenshots and exact viewport emulation | ✅ Verified |
| File chooser interception and local-file uploads | ✅ Verified |
| Nested and cross-origin iframe control | ✅ Verified |
| HTML5 and pointer drag-and-drop | ✅ Verified |
| Network lifecycle, response bodies, and request interception | ✅ Verified |
| Locale, timezone, touch, user-agent, and device emulation | ✅ Verified |
| JavaScript confirm/prompt discovery and replay | ✅ Verified, with a native-dialog caveat |

The inherited ChatGPT browser features are retained too:

| ChatGPT browser feature | Firefox and Zen Browser support |
| --- | --- |
| Mention any open tab as chat context | ✅ Firefox tab provider retained |
| Send highlighted page text to ChatGPT | ✅ Selection forwarding retained |
| Right-click a page and choose **Ask ChatGPT** | ✅ Retained alongside Editing Assets actions |
| Ask about YouTube videos with timestamped captions | ✅ Caption retrieval and timestamp seeking retained |
| Find relevant pages from browser history | ✅ Firefox history search wired through the inherited approval UI |
| Continue chats between browser and desktop app | ✅ Shared thread routes and `codex://threads/` handoff retained |

See [PORT_STATUS.md](PORT_STATUS.md) for detailed evidence and the remaining low-level Firefox limitations. `tests/test-chatgpt-feature-parity.mjs` guards the inherited ChatGPT surfaces against future upstream refreshes.

## How the connection works

```text
Firefox / Zen add-on
        ↕ native messaging
Codex Firefox Bridge
        ↕ local relay
Official OpenAI extension host
        ↕
Codex / ChatGPT
```

Firefox WebExtensions cannot launch arbitrary local programs or reuse a native-messaging host registered only for a Chrome extension ID. The small companion performs that OS-level handoff: it registers for this Firefox add-on, discovers the existing official OpenAI host, and securely relays the local connection.

The bridge does not replace Codex, store credentials, or operate a remote service. If OpenAI provides an official Firefox route or another supported local connection, we'd be happy to adopt it and simplify or remove the companion.

## Under the hood

The compatibility layer adds:

- Firefox `sidebar_action` support in place of Chrome `sidePanel`;
- a persistent Firefox background page in place of a Manifest V3 service worker;
- Firefox identity metadata while preserving the official host's Chrome-compatible transport family;
- translation of the `chrome.debugger`/CDP operations used by Codex into Firefox tab, cookie, screenshot, scripting, DOM, input, and network APIs;
- local-file transfer for controlled file inputs;
- frame-scoped DOM, input, clipboard, and CDP translation across nested cross-origin iframes;
- translated network capture, `Fetch` interception, emulation, dialogs, and viewport restoration;
- native bridge version reporting so the add-on can detect and explain an out-of-sync installation.

The port currently tracks OpenAI packaged extension version `1.2.27236.6274` (build `ad34341c30168f421705cd15f1633ebe6cea7849`). The inherited application code is byte-for-byte identical for the documented paths; the port changes only browser compatibility and packaging layers.

## Local development

The OpenAI native extension host must already be installed by ChatGPT/Codex tooling on the development machine.

1. Build and register the Firefox companion.

   Windows:

   ```powershell
   .\scripts\register-native-host.ps1
   ```

   macOS and Linux:

   ```sh
   ./scripts/register-native-host.sh
   ```

2. Open `about:debugging#/runtime/this-firefox` in Zen Browser or Firefox.
3. Select **Load Temporary Add-on**, then choose `extension/manifest.json`.
4. Open the Codex sidebar and grant all-sites access if prompted.
5. Start a Codex computer-use task.

Temporary add-ons disappear when the browser exits. Permanent installation requires Mozilla signing while retaining the Gecko ID `codex-computer-use-firefox-zen@sunkenintime`.

Remove only the development registration with:

```powershell
.\scripts\unregister-native-host.ps1
```

```sh
./scripts/unregister-native-host.sh
```

## Verify and package

```powershell
npm test
npx --yes web-ext lint --source-dir extension --no-input
npm run package
```

`npm test` checks synchronized release versions, the manifest and compatibility surface, bridge/extension version reporting, and the native protocol, upload, and WebSocket-relay integrations. Packaging writes the unsigned extension archive, a matching review-source archive, and SHA-256 checksums to `dist/`.

Pushing a semantic-version tag such as `v1.4.7` runs the release workflow. It builds and tests the extension, Windows installer, universal macOS package, and Linux x64 binary; verifies all release versions; publishes npm with provenance; attaches release artifacts; and smoke-tests a clean install of the exact public npm version on macOS and Linux. Submit the matching signed Firefox add-on to AMO only after that smoke test passes.

Prepare a release with:

```sh
npm run version:set -- MAJOR.MINOR.PATCH
```

`web-ext lint` currently reports zero errors. Its expected warnings come from the inherited minified OpenAI distribution and intentional page-world function serialization in the compatibility layer.

## Privacy, independence, and source

Read [PRIVACY.md](PRIVACY.md) for the data-handling disclosure. The native adapter pins its relay origin to the official OpenAI extension ID and rejects unrelated messages.

`extension/codex-sidepanel` and `extension/background.js` are OpenAI's packaged distribution, not a clean-room source reimplementation. Those upstream assets remain subject to OpenAI's applicable terms. The compatibility code in this repository is provided for review and development; no additional license is granted for the bundled upstream assets.
