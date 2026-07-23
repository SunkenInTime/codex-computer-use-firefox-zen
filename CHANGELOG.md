# Changelog

This project follows semantic versioning. The Firefox add-on and native companion
always share one version and are released from a matching `vMAJOR.MINOR.PATCH`
Git tag.

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
