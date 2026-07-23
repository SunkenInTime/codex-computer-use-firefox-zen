#!/bin/sh
set -eu

root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
version="$(node -p "require('$root/version.json').version")"
install_dir="$HOME/Library/Application Support/Codex Firefox Bridge"
manifest_dir="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"

cargo build --release --locked --manifest-path "$root/native-host/Cargo.toml"
mkdir -p "$install_dir" "$manifest_dir"
cp "$root/native-host/target/release/codex-firefox-bridge" "$install_dir/codex-firefox-bridge"
node - "$root/installer/macos/com.openai.codexextension.json" \
  "$manifest_dir/com.openai.codexextension.json" \
  "$install_dir/codex-firefox-bridge" <<'NODE'
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
manifest.path = process.argv[4];
fs.writeFileSync(process.argv[3], JSON.stringify(manifest, null, 2) + "\n");
NODE
chmod 755 "$install_dir/codex-firefox-bridge"

printf 'Installed Codex Firefox Bridge %s for %s\n' "$version" "$USER"
