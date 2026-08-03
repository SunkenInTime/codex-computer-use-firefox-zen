#!/bin/sh
set -eu

manifest="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts/com.openai.codexextension.json"
install_dir="$HOME/Library/Application Support/Codex Firefox Bridge"

rm -f "$manifest"
rm -f "$install_dir/codex-firefox-bridge" "$install_dir/com.openai.codexextension.json"
rmdir "$install_dir" 2>/dev/null || true
printf 'Removed the per-user Codex Firefox Bridge installation.\n'
