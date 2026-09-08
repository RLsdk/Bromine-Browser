#!/usr/bin/env bash
# Inject Linux desktop/icon/launcher/startpage into a mach-produced tarball.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="${1:-}"
if [[ -z "$PKG" || ! -f "$PKG" ]]; then
  echo "usage: $0 bromine-*.en-US.linux-x86_64.tar.xz" >&2
  exit 1
fi
PKG="$(readlink -f "$PKG")"
WORKDIR="$(mktemp -d /tmp/bromine-wrap.XXXX)"
trap 'rm -rf "$WORKDIR"' EXIT

tar -C "$WORKDIR" -xf "$PKG"
APPDIR="$(find "$WORKDIR" -maxdepth 1 -type d -name 'bromine' | head -1)"
[[ -d "$APPDIR" ]] || { echo "no bromine/ dir in archive" >&2; exit 1; }

# share/ for XDG
mkdir -p "$APPDIR/share/applications"
mkdir -p "$APPDIR/share/icons/hicolor"
cp "$ROOT/packaging/linux/bromine.desktop" "$APPDIR/share/applications/"
# Fix Exec to use launch wrapper relative path is hard in desktop files —
# use bromine-launch.sh installed beside binary
cp "$ROOT/packaging/linux/bromine-launch.sh" "$APPDIR/bromine-launch.sh"
chmod +x "$APPDIR/bromine-launch.sh"

# Point desktop Exec at launch script via absolute path placeholder; install-user rewrites.
# For in-tree portable use, desktop uses bromine-launch.sh
sed -i "s|^Exec=bromine %u|Exec=$APPDIR/bromine-launch.sh %u|" "$APPDIR/share/applications/bromine.desktop" || true
# Actually absolute temp paths are wrong for redistribution — keep generic Exec=bromine
cp "$ROOT/packaging/linux/bromine.desktop" "$APPDIR/share/applications/bromine.desktop"
# Portable desktop: Exec relative via env not supported; document install-user.sh
# Also ship a portable desktop that uses bromine-launch.sh with full path replaced at install time.

for size in 16 32 48 64 128; do
  src="$APPDIR/browser/chrome/icons/default/default${size}.png"
  if [[ -f "$src" ]]; then
    mkdir -p "$APPDIR/share/icons/hicolor/${size}x${size}/apps"
    cp "$src" "$APPDIR/share/icons/hicolor/${size}x${size}/apps/bromine.png"
  fi
done

# Start page
mkdir -p "$APPDIR/startpage"
cp -a "$ROOT/startpage/." "$APPDIR/startpage/"

# Offline extensions if present — point policies at file:// so first-run works offline
if [[ -d "$ROOT/settings/distribution/extensions" ]]; then
  mkdir -p "$APPDIR/distribution/extensions"
  cp -n "$ROOT/settings/distribution/extensions/"*.xpi "$APPDIR/distribution/extensions/" 2>/dev/null || true
fi
# Placeholder URLs rewritten by install-user.sh to absolute file:// paths
if [[ -f "$APPDIR/distribution/policies.json" ]]; then
  python3 - "$APPDIR" <<'PY'
import json, sys
from pathlib import Path
app = Path(sys.argv[1])
pol = app / "distribution" / "policies.json"
data = json.loads(pol.read_text())
ext = data.setdefault("policies", {}).setdefault("ExtensionSettings", {})
for aid, name in (
    ("uBlock0@raymondhill.net", "uBlock0@raymondhill.net.xpi"),
    ("sponsorBlocker@ajay.app", "sponsorBlocker@ajay.app.xpi"),
):
    xpi = app / "distribution" / "extensions" / name
    if xpi.is_file() and aid in ext:
        # Relative marker; install-user.sh rewrites to absolute file://
        ext[aid]["install_url"] = f"file://BROMINE_APP/distribution/extensions/{name}"
pol.write_text(json.dumps(data, indent=2) + "\n")
PY
fi

# Copy install helper into package
cp "$ROOT/packaging/linux/install-user.sh" "$APPDIR/install-user.sh"
chmod +x "$APPDIR/install-user.sh"

OUT="${PKG%.tar.xz}-xdg.tar.xz"
# Prefer writing next to original
tar -C "$WORKDIR" -cJf "$OUT" bromine
echo "Wrote $OUT"
ls -lh "$OUT"
