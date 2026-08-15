#!/bin/sh
set -eu

uname_s="$(uname -s)"

if [ "$uname_s" = "Darwin" ]; then
  install_dir="$HOME/Library/Application Support/Codex Firefox Bridge"
  rm -f "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts/com.openai.codexextension.json"
elif [ "$uname_s" = "Linux" ]; then
  install_dir="${XDG_DATA_HOME:-$HOME/.local/share}/Codex Firefox Bridge"
  rm -f "$HOME/.mozilla/native-messaging-hosts/com.openai.codexextension.json"
  rm -f "$HOME/.zen/native-messaging-hosts/com.openai.codexextension.json"
else
  printf 'Unsupported OS: %s\n' "$uname_s" >&2
  exit 1
fi

rm -f "$install_dir/codex-firefox-bridge" "$install_dir/com.openai.codexextension.json"
rmdir "$install_dir" 2>/dev/null || true
printf 'Removed the per-user Codex Firefox Bridge installation.\n'
