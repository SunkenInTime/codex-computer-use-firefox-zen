#!/bin/sh
set -eu

root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
version="$(node -p "require('$root/version.json').version")"
uname_s="$(uname -s)"

write_manifest() {
  manifest_dir="$1"
  mkdir -p "$manifest_dir"
  node - "$root/installer/macos/com.openai.codexextension.json" \
    "$manifest_dir/com.openai.codexextension.json" \
    "$install_dir/codex-firefox-bridge" <<'NODE'
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
manifest.path = process.argv[4];
fs.writeFileSync(process.argv[3], JSON.stringify(manifest, null, 2) + "\n");
NODE
}

if [ "$uname_s" = "Darwin" ]; then
  install_dir="$HOME/Library/Application Support/Codex Firefox Bridge"
elif [ "$uname_s" = "Linux" ]; then
  install_dir="${XDG_DATA_HOME:-$HOME/.local/share}/Codex Firefox Bridge"
else
  printf 'Unsupported OS: %s\n' "$uname_s" >&2
  exit 1
fi

cargo build --release --locked --manifest-path "$root/native-host/Cargo.toml"
mkdir -p "$install_dir"
cp "$root/native-host/target/release/codex-firefox-bridge" "$install_dir/codex-firefox-bridge"
if [ "$uname_s" = "Darwin" ]; then
  codesign --force --sign - "$install_dir/codex-firefox-bridge"
fi
chmod 755 "$install_dir/codex-firefox-bridge"

if [ "$uname_s" = "Darwin" ]; then
  write_manifest "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
else
  write_manifest "$HOME/.mozilla/native-messaging-hosts"
  write_manifest "$HOME/.zen/native-messaging-hosts"
fi

printf 'Installed Codex Firefox Bridge %s for %s\n' "$version" "$USER"
