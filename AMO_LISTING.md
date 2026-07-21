# Mozilla Add-ons listing copy

## Name

Codex Computer Use for Zen & Fox

## Summary

Bring Codex computer-use capabilities and its signed-in sidebar to Firefox and Zen Browser.

## Description

Codex Computer Use for Zen & Fox brings the OpenAI browser-extension workflow to Firefox-family browsers through a normal WebExtension.

The compatibility layer translates the browser-control operations used by Codex into Firefox APIs while retaining the signed-in sidebar experience. It supports semantic page inspection, clicks, typing, keyboard and pointer input, screenshots, navigation, downloads and uploads, cookies, nested cross-origin frames, network inspection, request interception, device emulation, and common JavaScript dialogs.

Zen Browser was the primary live-test target. Automated protocol tests and live signed-in computer-use acceptance tests are documented in the public repository.

This is an independent compatibility project and is not an official OpenAI, Mozilla, or Zen Browser release. An existing ChatGPT/Codex installation and account are required.

## Links

- Homepage and source: <https://github.com/SunkenInTime/codex-computer-use-firefox-zen>
- Support: <https://github.com/SunkenInTime/codex-computer-use-firefox-zen/issues>
- Privacy: <https://github.com/SunkenInTime/codex-computer-use-firefox-zen/blob/main/PRIVACY.md>

## Notes for reviewers

The Firefox compatibility layer is readable source in `extension/firefox-compat.js`, `extension/firefox-cdp-bridge.js`, and `native-host/NativeHostProxy.cs`. Run `npm test` for static and protocol verification and `npm run package` to reproduce the extension and review-source archives.

The project retains OpenAI's packaged `extension/background.js` and side-panel bundles. The side-panel HTML loads the readable Firefox-specific `firefox-focus-compat.js` shim before the upstream bundle. Source maps shipped by OpenAI are included, but the project does not possess OpenAI's pre-bundle source or build system. The add-on requires the officially installed OpenAI native extension host and a user-supplied ChatGPT/Codex account. No reviewer credentials are embedded in the add-on or source archive.

The extension requests broad browser permissions because browser control is its primary disclosed function. Website content and activity are transmitted only when the user invokes computer use. The machine-local native-messaging adapter pins its relay origin to the official OpenAI extension ID and rejects unrelated messages.
