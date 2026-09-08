#!/usr/bin/env bash
# Launch Bromine with a local XDG data dir so Wayland/KDE/GNOME pick up the BR icon
# even when running from an extracted tarball (no system install).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE"
# Support running from packaging/linux/bromine-launch.sh against a sibling extract,
# or from inside the packaged tree as ./bromine-launch.sh next to the binary.
if [[ -x "$HERE/bromine" ]]; then
  BIN="$HERE/bromine"
elif [[ -x "$HERE/../bromine/bromine" ]]; then
  BIN="$HERE/../bromine/bromine"
  APP="$(cd "$HERE/../bromine" && pwd)"
else
  echo "bromine binary not found next to launcher" >&2
  exit 1
fi

SHARE="${APP}/share"
export XDG_DATA_DIRS="${SHARE}${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}"
# Help some compositors match the desktop file → icon
export GDK_BACKEND="${GDK_BACKEND:-wayland,x11}"

exec "$BIN" "$@"
