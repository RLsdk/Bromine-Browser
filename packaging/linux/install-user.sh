#!/usr/bin/env bash
# Install Bromine icons + .desktop into the user XDG dirs (CachyOS / Arch / any Linux).
# Usage: ./install-user.sh [/path/to/extracted/bromine]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="${1:-}"
if [[ -z "$APP" ]]; then
  for cand in \
    "$HOME/.local/share/bromine/bromine" \
    "/tmp/bromine" \
    "$HOME/builds/bromine/bromine"
  do
    if [[ -x "$cand/bromine" ]]; then APP="$cand"; break; fi
  done
fi
if [[ -z "$APP" || ! -x "$APP/bromine" ]]; then
  echo "Usage: $0 /path/to/extracted/bromine" >&2
  echo "Extract the tarball first, then pass that directory." >&2
  exit 1
fi
APP="$(cd "$APP" && pwd)"

ICON_SRC="$APP/browser/chrome/icons/default"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_BASE="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor"
PIXMAPS="${XDG_DATA_HOME:-$HOME/.local/share}/pixmaps"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
SHARE="${XDG_DATA_HOME:-$HOME/.local/share}/bromine"

mkdir -p "$DESKTOP_DIR" "$BIN_DIR" "$PIXMAPS"

# Install every available defaultN.png into hicolor
BEST_ICON=""
for size in 16 22 24 32 48 64 128 256 512; do
  src="$ICON_SRC/default${size}.png"
  if [[ -f "$src" ]]; then
    dest="$ICON_BASE/${size}x${size}/apps"
    mkdir -p "$dest"
    cp -f "$src" "$dest/bromine.png"
    BEST_ICON="$dest/bromine.png"
  fi
done
# Prefer 128/256 for absolute Icon= (Kickoff/Plasma task manager)
for prefer in 256 128 64 48; do
  cand="$ICON_BASE/${prefer}x${prefer}/apps/bromine.png"
  if [[ -f "$cand" ]]; then BEST_ICON="$cand"; break; fi
done
# Also ship branding 256 if chrome icons lack it
BRAND256="$ROOT/themes/browser/branding/bromine/default256.png"
if [[ -f "$BRAND256" ]]; then
  mkdir -p "$ICON_BASE/256x256/apps"
  cp -f "$BRAND256" "$ICON_BASE/256x256/apps/bromine.png"
  BEST_ICON="$ICON_BASE/256x256/apps/bromine.png"
fi

if [[ -z "$BEST_ICON" || ! -f "$BEST_ICON" ]]; then
  echo "No Bromine icons found under $ICON_SRC" >&2
  exit 1
fi

# Pixmaps fallback (some launchers only search here)
cp -f "$BEST_ICON" "$PIXMAPS/bromine.png"

# Copy into active Plasma icon theme(s) — breeze-dark often skips hicolor for apps
install_into_theme() {
  local theme="$1"
  local base="${XDG_DATA_HOME:-$HOME/.local/share}/icons/$theme"
  [[ -n "$theme" && "$theme" != "hicolor" ]] || return 0
  for size in 16 22 24 32 48 64 128 256; do
    src="$ICON_BASE/${size}x${size}/apps/bromine.png"
    [[ -f "$src" ]] || continue
    # Breeze layout: apps/<size>/name.png  AND  <size>x<size>/apps/name.png
    mkdir -p "$base/apps/$size" "$base/${size}x${size}/apps"
    cp -f "$src" "$base/apps/$size/bromine.png"
    # Avoid cp same-file if paths collide
    if [[ "$base/${size}x${size}/apps/bromine.png" != "$src" ]]; then
      cp -f "$src" "$base/${size}x${size}/apps/bromine.png"
    fi
  done
}
ACTIVE_THEME="$(kreadconfig6 --file kdeglobals --group Icons --key Theme 2>/dev/null || true)"
for t in "$ACTIVE_THEME" breeze breeze-dark; do
  install_into_theme "$t"
done

# Minimal hicolor index so user-dir theme is valid
if [[ ! -f "$ICON_BASE/index.theme" ]]; then
  cat > "$ICON_BASE/index.theme" <<'EOF'
[Icon Theme]
Name=Hicolor
Comment=Fallback icon theme
Hidden=true
Directories=16x16/apps,22x22/apps,24x24/apps,32x32/apps,48x48/apps,64x64/apps,128x128/apps,256x256/apps

[16x16/apps]
Size=16
Context=Apps
Type=Threshold

[22x22/apps]
Size=22
Context=Apps
Type=Threshold

[24x24/apps]
Size=24
Context=Apps
Type=Threshold

[32x32/apps]
Size=32
Context=Apps
Type=Threshold

[48x48/apps]
Size=48
Context=Apps
Type=Threshold

[64x64/apps]
Size=64
Context=Apps
Type=Threshold

[128x128/apps]
Size=128
Context=Apps
Type=Threshold

[256x256/apps]
Size=256
Context=Apps
Type=Threshold
EOF
fi

# Desktop entry: absolute Icon= path — reliable on Plasma Wayland Kickoff/task manager
{
  sed -e "s|^Exec=bromine|Exec=${APP}/bromine|" \
      -e "s|^Exec=bromine --|Exec=${APP}/bromine --|" \
      -e "s|^Icon=.*|Icon=${BEST_ICON}|" \
      "$ROOT/packaging/linux/bromine.desktop"
} > "$DESKTOP_DIR/bromine.desktop"
chmod 644 "$DESKTOP_DIR/bromine.desktop"

# Symlink binary
ln -sfn "$APP/bromine" "$BIN_DIR/bromine"

# Point ExtensionSettings at local XPIs when present
POL="$APP/distribution/policies.json"
if [[ -f "$POL" ]]; then
  python3 - "$APP" "$POL" <<'PY'
import json, sys
from pathlib import Path
app, pol = Path(sys.argv[1]), Path(sys.argv[2])
data = json.loads(pol.read_text())
ext = data.get("policies", {}).get("ExtensionSettings", {})
changed = False
for aid, name in (
    ("uBlock0@raymondhill.net", "uBlock0@raymondhill.net.xpi"),
    ("sponsorBlocker@ajay.app", "sponsorBlocker@ajay.app.xpi"),
):
    xpi = app / "distribution" / "extensions" / name
    if xpi.is_file() and aid in ext:
        url = f"file://{xpi}"
        if ext[aid].get("install_url") != url:
            ext[aid]["install_url"] = url
            changed = True
if changed:
    pol.write_text(json.dumps(data, indent=2) + "\n")
    print(f"  policies: local XPI install_url -> {app}/distribution/extensions/")
PY
fi

# Glass start page is packaged in omni as chrome://browser/content/bromine-start/
mkdir -p "$HOME/.bromine"
cat > "$HOME/.bromine/bromine.overrides.cfg" <<'EOF'
// Bromine overrides — glass start (packaged chrome://, not file://)
defaultPref("browser.startup.homepage", "chrome://browser/content/bromine-start/index.html");
defaultPref("browser.startup.page", 1);
defaultPref("browser.newtabpage.enabled", true);
EOF
echo "  homepage: chrome://browser/content/bromine-start/index.html"

# Refresh caches (Plasma + GTK)
command -v update-desktop-database >/dev/null && update-desktop-database "$DESKTOP_DIR" || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -f -t "$ICON_BASE" 2>/dev/null || true
command -v kbuildsycoca6 >/dev/null && kbuildsycoca6 --noincremental >/dev/null 2>&1 || true
command -v kbuildsycoca5 >/dev/null && kbuildsycoca5 --noincremental >/dev/null 2>&1 || true

echo "Installed:"
echo "  desktop: $DESKTOP_DIR/bromine.desktop"
echo "  icon:    $BEST_ICON (absolute Icon= in .desktop)"
echo "  icons:   $ICON_BASE/*/apps/bromine.png"
echo "  binary:  $BIN_DIR/bromine -> $APP/bromine"
echo "If Kickoff/taskbar still shows a placeholder: restart Plasma (logout or: plasmashell --replace &)"
