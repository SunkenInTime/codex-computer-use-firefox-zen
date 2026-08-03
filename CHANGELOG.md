# Changelog

This project follows semantic versioning. The Firefox add-on and native companion
always share one version and are released from a matching `vMAJOR.MINOR.PATCH`
Git tag.

## 1.4.3 - 2026-08-02

- Published the Firefox/Zen sidebar-open repair together with its matching
  native companion, npm installer, and platform installers.
- Fixed current Codex app-server startup by providing the bundled runtime paths
  and a temporary fallback v2 native-host registration when necessary.
- Rewrote Firefox extension identifiers and WebSocket handshake metadata at the
  native-host boundary so the official Codex host accepts the delegated session.
- Added a post-release clean-install smoke test that verifies the public assets
  and installs the exact released npm companion in an isolated home directory.

## 1.4.2 - 2026-07-25

- Fixed Firefox and Zen sidebar-open tracking when the sidebar is opened from
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
