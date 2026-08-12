# Changelog

This project follows semantic versioning. The Firefox add-on and native companion
always share one version and are released from a matching `vMAJOR.MINOR.PATCH`
Git tag.

## Unreleased

## 1.4.6 - 2026-08-12

- Fixed `@` open-tab mentions in Firefox and Zen by recognizing the port's
  native tab provider instead of discarding its results behind a Chrome-only
  plugin-discovery flag.
- Fixed Windows companion removal when Firefox or Zen left an installed bridge
  process running after the browser exited.
- Retried transient network and GitHub server failures while downloading npm
  installer assets.
- Refreshed the Firefox and Zen Browser product name and icon set across the
  extension, npm installer, documentation, and Mozilla listing metadata.

## 1.4.5 - 2026-08-11

- Advertised an explicit `Codex Firefox Bridge (Firefox and Zen Browser)` browser name and
  structured Firefox-versus-Chrome-compatibility metadata to browser-control
  clients, so diagnostics can identify the real browser without changing the
  Chrome-compatible transport contract.
- Added a Firefox sidebar preflight that explains and requests all-websites host
  access before Codex starts, preventing automation from failing only after a
  navigation or new-tab transition.
- Replaced Firefox's raw missing-host-permission failure with actionable recovery
  guidance when website access is revoked while Codex is running.
- Added a `tabs.captureVisibleTab` fallback for Zen Browser builds that do not expose
  Firefox's nominal `tabs.captureTab` API.

## 1.4.4 - 2026-08-03

- Resynced the complete inherited OpenAI extension distribution from packaged
  version `1.2.27236.6274` instead of carrying only a targeted sidebar patch.
- Retained the new upstream ChatGPT website integration alongside the Firefox
  CDP compatibility content script.
- Verified and regression-tested open-tab mentions, highlighted-text handoff,
  Ask ChatGPT context menus, timestamped YouTube captions, browser-history
  search, and browser/desktop thread handoff against the matching Helium build.
- Preserved the upstream Ask ChatGPT item when refreshing the port's custom
  Editing Assets context menus.
- Included the upstream auth-state fix that prevents a null auth notification
  from recursively re-reading the account and blanking the sidebar.

## 1.4.3 - 2026-08-02

- Published the Firefox and Zen Browser sidebar-open repair together with its matching
  native companion, npm installer, and platform installers.
- Fixed current Codex app-server startup by providing the bundled runtime paths
  and a temporary fallback v2 native-host registration when necessary.
- Rewrote Firefox extension identifiers and WebSocket handshake metadata at the
  native-host boundary so the official Codex host accepts the delegated session.
- Added a post-release clean-install smoke test that verifies the public assets
  and installs the exact released npm companion in an isolated home directory.

## 1.4.2 - 2026-07-25

- Fixed Firefox and Zen Browser sidebar-open tracking when the sidebar is opened from
  the browser's native **View > Sidebar** UI.
- Made a verified extension-sidepanel startup request authoritative for its
  current window, so the local app server starts without requiring a synthetic
  Chrome side-panel event.
- Added Editing Assets context-menu actions for saving supported media into the
  configured asset-library folders.

## 1.4.0 - 2026-07-23

- Added `codex-firefox-bridge` as a terminal-friendly npm installer with
  `install`, `doctor`, and `uninstall` commands.
- Kept the Windows `.exe` and macOS universal `.pkg` as first-class install
  choices.
- Added verified raw companion binaries and an npm tarball to GitHub releases.
- Added npm provenance publishing support to the release workflow.
- Added an in-extension npm install option and an explanation of why the local
  bridge is currently required.

## 1.3.0 - 2026-07-23

- Replaced the Windows-only development adapter with a cross-platform Rust
  companion.
- Added runtime discovery of the official OpenAI native host without
  machine-specific paths.
- Added a per-user Windows installer.
- Added a universal macOS package for Apple Silicon and Intel Macs.
- Added synchronized version checks, SHA-256 release checksums, optional Windows
  signing, and optional macOS signing/notarization.
- Added Windows native-protocol integration tests and macOS cross-target build
  checks.
