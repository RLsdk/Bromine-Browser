#!/usr/bin/env bash
# Build a portable Bromine AppImage (x86_64) from a mach package or app dir.
#
# Usage:
#   ./scripts/build-appimage.sh
#   ./scripts/build-appimage.sh /path/to/bromine-*.linux-x86_64.tar.xz
#   ./scripts/build-appimage.sh /path/to/extracted/bromine
#
# Output: dist/Bromine-<version>-x86_64.AppImage
#
# Primary target: Arch / CachyOS / EndeavourOS (glibc). Also runs on most
# modern x86_64 Linux distros (Fedora, Ubuntu LTS, openSUSE, …).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(tr -d '[:space:]' <"$ROOT/version")"
RELEASE="$(tr -d '[:space:]' <"$ROOT/release")"
ARCH="${ARCH:-x86_64}"
OUTDIR="${OUTDIR:-$ROOT/dist}"
WORKDIR="$(mktemp -d /tmp/bromine-appimage.XXXXXX)"
trap 'rm -rf "$WORKDIR"' EXIT

INPUT="${1:-}"
if [[ -z "$INPUT" ]]; then
  # Prefer wrapped xdg package, then plain package, then local install
  for cand in \
    "$ROOT"/bromine-*-xdg.tar.xz \
    "$ROOT"/bromine-*.linux-"$ARCH".tar.xz \
    "$HOME/.local/share/bromine/bromine"
  do
    # shellcheck disable=SC2086
    for f in $cand; do
      if [[ -e "$f" ]]; then
        INPUT="$f"
        break 2
      fi
    done
  done
fi

if [[ -z "$INPUT" ]]; then
  echo "usage: $0 [bromine-*.tar.xz | /path/to/bromine/appdir]" >&2
  echo "No package found. Run: make package && ./scripts/wrap-linux-package.sh <tar.xz>" >&2
  exit 1
fi

INPUT="$(readlink -f "$INPUT")"
echo "==> source: $INPUT"

APPDIR="$WORKDIR/Bromine.AppDir"
mkdir -p "$APPDIR/usr/lib" "$APPDIR/usr/bin" "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps" "$APPDIR/usr/share/metainfo"

# --- stage browser tree -------------------------------------------------------
STAGE="$WORKDIR/stage"
mkdir -p "$STAGE"
if [[ -f "$INPUT" ]]; then
  case "$INPUT" in
    *.tar.xz|*.txz) tar -C "$STAGE" -xf "$INPUT" ;;
    *.tar.gz|*.tgz) tar -C "$STAGE" -xzf "$INPUT" ;;
    *.zip) unzip -q "$INPUT" -d "$STAGE" ;;
    *) echo "unsupported archive: $INPUT" >&2; exit 1 ;;
  esac
  BROWSER="$(find "$STAGE" -maxdepth 2 -type f -name bromine -executable | head -1)"
  [[ -n "$BROWSER" ]] || { echo "no bromine binary in archive" >&2; exit 1; }
  SRC="$(cd "$(dirname "$BROWSER")" && pwd)"
elif [[ -d "$INPUT" && -x "$INPUT/bromine" ]]; then
  SRC="$INPUT"
else
  echo "not a bromine package or app dir: $INPUT" >&2
  exit 1
fi

echo "==> copying app from $SRC"
rsync -a --delete \
  --exclude='crashreporter*' \
  --exclude='minidump-analyzer*' \
  "$SRC/" "$APPDIR/usr/lib/bromine/"

# Ensure launcher + desktop bits exist
if [[ ! -x "$APPDIR/usr/lib/bromine/bromine-launch.sh" ]]; then
  cp "$ROOT/packaging/linux/bromine-launch.sh" "$APPDIR/usr/lib/bromine/bromine-launch.sh"
  chmod +x "$APPDIR/usr/lib/bromine/bromine-launch.sh"
fi
mkdir -p "$APPDIR/usr/lib/bromine/share/applications"
cp "$ROOT/packaging/linux/bromine.desktop" \
  "$APPDIR/usr/lib/bromine/share/applications/bromine.desktop"

# Refresh startpage from overlay (icons + latest UI)
if [[ -d "$ROOT/startpage" ]]; then
  mkdir -p "$APPDIR/usr/lib/bromine/startpage"
  rsync -a "$ROOT/startpage/" "$APPDIR/usr/lib/bromine/startpage/"
fi

# Thin usr/bin shim (some tools look here)
cat >"$APPDIR/usr/bin/bromine" <<'EOF'
#!/usr/bin/env bash
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/../lib/bromine/bromine" "$@"
EOF
chmod +x "$APPDIR/usr/bin/bromine"

# --- desktop / icon / AppStream ----------------------------------------------
cp "$ROOT/packaging/linux/bromine.desktop" "$APPDIR/bromine.desktop"
# AppImage requires Exec without path; Icon basename only
sed -i \
  -e 's|^Exec=.*|Exec=bromine %u|' \
  -e 's|^Icon=.*|Icon=bromine|' \
  "$APPDIR/bromine.desktop"
# Also for actions
sed -i \
  -e 's|^Exec=bromine --new-window|Exec=bromine --new-window|' \
  -e 's|^Exec=bromine --private-window|Exec=bromine --private-window|' \
  "$APPDIR/bromine.desktop"
cp "$APPDIR/bromine.desktop" "$APPDIR/usr/share/applications/bromine.desktop"

pick_icon() {
  local size="$1"
  local cand
  for cand in \
    "$APPDIR/usr/lib/bromine/browser/chrome/icons/default/default${size}.png" \
    "$APPDIR/usr/lib/bromine/share/icons/hicolor/${size}x${size}/apps/bromine.png" \
    "$ROOT/themes/browser/branding/bromine/default${size}.png"
  do
    if [[ -f "$cand" ]]; then
      echo "$cand"
      return 0
    fi
  done
  return 1
}

ICON256="$(pick_icon 128 || pick_icon 64 || true)"
if [[ -n "${ICON256:-}" ]]; then
  cp "$ICON256" "$APPDIR/usr/share/icons/hicolor/256x256/apps/bromine.png"
  cp "$ICON256" "$APPDIR/bromine.png"
  ln -sf bromine.png "$APPDIR/.DirIcon"
fi
for size in 16 32 48 64 128; do
  src="$(pick_icon "$size" || true)"
  if [[ -n "$src" ]]; then
    mkdir -p "$APPDIR/usr/share/icons/hicolor/${size}x${size}/apps"
    cp "$src" "$APPDIR/usr/share/icons/hicolor/${size}x${size}/apps/bromine.png"
  fi
done

cat >"$APPDIR/usr/share/metainfo/io.github.bromine.metainfo.xml" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>io.github.bromine</id>
  <name>Bromine</name>
  <summary>Privacy-first Firefox-based browser</summary>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MPL-2.0</project_license>
  <developer id="io.github.bromine">
    <name>Bromine</name>
  </developer>
  <content_rating type="oars-1.1"/>
  <description>
    <p>
      Bromine is a privacy-first browser based on LibreWolf/Firefox patches:
      telemetry off, HTTPS-Only, ETP strict, uBlock Origin, SponsorBlock, and
      a modular Bromine theme.
    </p>
  </description>
  <launchable type="desktop-id">bromine.desktop</launchable>
  <url type="homepage">https://github.com</url>
  <releases>
    <release version="${VERSION}-${RELEASE}" date="$(date -u +%Y-%m-%d)"/>
  </releases>
  <categories>
    <category>Network</category>
    <category>WebBrowser</category>
  </categories>
</component>
EOF

cp "$ROOT/packaging/linux/AppRun" "$APPDIR/AppRun"
chmod +x "$APPDIR/AppRun"

# --- appimagetool ------------------------------------------------------------
TOOL_DIR="${BROMINE_APPIMAGETOOL_DIR:-$HOME/.cache/bromine/appimagetool}"
mkdir -p "$TOOL_DIR"
TOOL="$TOOL_DIR/appimagetool-${ARCH}.AppImage"
if [[ ! -x "$TOOL" ]]; then
  echo "==> downloading appimagetool"
  URL="https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-${ARCH}.AppImage"
  curl -fL --retry 3 -o "$TOOL" "$URL"
  chmod +x "$TOOL"
fi

mkdir -p "$OUTDIR"
OUT="$OUTDIR/Bromine-${VERSION}-${RELEASE}-${ARCH}.AppImage"
rm -f "$OUT"

echo "==> packing $OUT"
# ARCH for appimagetool; disable fuse sandbox issues with APPIMAGE_EXTRACT_AND_RUN
export ARCH
export APPIMAGE_EXTRACT_AND_RUN=1
# Don't fail the whole build on optional AppStream lint strictness
if ! "$TOOL" "$APPDIR" "$OUT"; then
  echo "==> appimagetool failed with AppStream checks; retrying without validation"
  "$TOOL" --no-appstream "$APPDIR" "$OUT"
fi
chmod +x "$OUT"

# Checksums for redistribution
( cd "$OUTDIR" && sha256sum "$(basename "$OUT")" >"$(basename "$OUT").sha256" )

echo
echo "AppImage ready:"
ls -lh "$OUT" "$OUT.sha256"
echo
echo "Run:  $OUT"
echo "Arch tip: also works from AUR-less portable use; optional local install:"
echo "  install -Dm755 $OUT ~/.local/bin/bromine"
