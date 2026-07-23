# Changelog

This project follows semantic versioning. The Firefox add-on and native companion
always share one version and are released from a matching `vMAJOR.MINOR.PATCH`
Git tag.

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
