# Codex Firefox Bridge

Install the native-messaging companion used by Codex Computer Use for Firefox
and Zen Browser:

```sh
npx --yes codex-firefox-bridge install
```

The command downloads the matching bridge from the GitHub release, verifies its
published SHA-256 checksum, installs it in the current user's application-data
directory, registers it with Firefox and Zen Browser, and runs a diagnostic. The
`doctor` and `uninstall` commands verify and remove the installation.

On Linux the binary is installed under `$XDG_DATA_HOME/Codex Firefox Bridge`
(default `~/.local/share/Codex Firefox Bridge`). The required native-host manifest
is written to `~/.mozilla/native-messaging-hosts/`, which both unconfined Firefox
and Zen Browser read. A second manifest is written to
`~/.zen/native-messaging-hosts/` on a best-effort basis when that path is
writable; current Zen Linux builds read the Mozilla registration, so the `.zen`
copy is optional and never fails installation or diagnostics.

```sh
npx --yes codex-firefox-bridge doctor
npx --yes codex-firefox-bridge uninstall
```

This is an independent compatibility project, not an official OpenAI or Mozilla
package. The official Codex Chrome integration must already be installed because
the bridge delegates to its local OpenAI host.

## Why is this needed?

Firefox extensions cannot start arbitrary local processes or reuse a native
host registered for a Chrome extension. Codex currently exposes its browser
connection through that native-host path, rather than a supported Firefox API
or authenticated local endpoint, so this bridge provides the required
per-user OS registration and delegates to the official host.

If OpenAI opens an official Firefox path or another supported local connection,
we'd love to adopt it and simplify or remove this companion :)
