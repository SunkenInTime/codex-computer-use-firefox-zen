# Codex Firefox Bridge

Install the native-messaging companion used by Codex Computer Use for Firefox
and Zen Browser:

```sh
npx --yes codex-firefox-bridge install
```

The command downloads the matching bridge from the GitHub release, verifies its
published SHA-256 checksum, installs it in the current user's application-data
directory, registers it with Firefox, and runs a diagnostic.

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
