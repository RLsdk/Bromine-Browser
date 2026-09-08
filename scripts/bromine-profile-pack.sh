#!/usr/bin/env bash
# Export / import Bromine everyday prefs (theme, strip, privacy knobs).
# Does NOT include passwords, cookies, or history unless --full is passed.
set -euo pipefail

PROFILE="${BROMINE_PROFILE:-$HOME/.config/bromine/bromine/0al17vhp.default-default}"
PREFS_ALLOW=(
  bromine.
  layout.css.prefers-color-scheme
  privacy.fingerprintingProtection
  privacy.resistFingerprinting
  network.dns.preferIPv6
  browser.urlbar.
  browser.cache.disk
  media.videocontrols.picture-in-picture
  sidebar.verticalTabs
  browser.tabs.groups
)

usage() {
  echo "usage: $0 export <archive.tar.zst|tar.gz> [--full]"
  echo "       $0 import <archive.tar.zst|tar.gz>"
  exit 1
}

[[ $# -ge 2 ]] || usage
cmd=$1
archive=$2
full=0
[[ "${3:-}" == "--full" ]] && full=1

case "$cmd" in
  export)
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    mkdir -p "$tmp/bromine-pack"
    if [[ "$full" -eq 1 ]]; then
      cp -a "$PROFILE" "$tmp/bromine-pack/profile"
    else
      # Prefs only (filtered)
      if [[ -f "$PROFILE/prefs.js" ]]; then
        : >"$tmp/bromine-pack/prefs-filtered.js"
        while IFS= read -r line; do
          for p in "${PREFS_ALLOW[@]}"; do
            if [[ "$line" == *"$p"* ]]; then
              echo "$line" >>"$tmp/bromine-pack/prefs-filtered.js"
              break
            fi
          done
        done <"$PROFILE/prefs.js"
      fi
      printf '%s\n' "bromine.profile.pack=1" "exported=$(date -Iseconds)" >"$tmp/bromine-pack/manifest.txt"
    fi
    mkdir -p "$(dirname "$archive")"
    if command -v zstd >/dev/null 2>&1 && [[ "$archive" == *.zst ]]; then
      tar -C "$tmp" -cf - bromine-pack | zstd -q -o "$archive"
    else
      tar -C "$tmp" -czf "$archive" bromine-pack
    fi
    echo "exported → $archive"
    ;;
  import)
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    if [[ "$archive" == *.zst ]]; then
      zstd -dc "$archive" | tar -C "$tmp" -xf -
    else
      tar -C "$tmp" -xzf "$archive"
    fi
    if [[ -d "$tmp/bromine-pack/profile" ]]; then
      echo "Full profile import — close Bromine first, then:"
      echo "  rsync -a --delete \"$tmp/bromine-pack/profile/\" \"$PROFILE/\""
      exit 0
    fi
    if [[ -f "$tmp/bromine-pack/prefs-filtered.js" ]]; then
      mkdir -p "$PROFILE"
      cat "$tmp/bromine-pack/prefs-filtered.js" >>"$PROFILE/prefs.js"
      echo "appended filtered prefs → $PROFILE/prefs.js (restart Bromine)"
    else
      echo "nothing to import" >&2
      exit 1
    fi
    ;;
  *) usage ;;
esac
