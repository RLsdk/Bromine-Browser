#!/usr/bin/env bash
# Download signed XPIs for offline packaging (optional).
# policies.json still uses AMO install_url for updates.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/settings/distribution/extensions"
mkdir -p "$OUT"

fetch_one() {
  local id="$1" slug="$2"
  local dest="$OUT/${id}.xpi"
  local url="https://addons.mozilla.org/firefox/downloads/latest/${id}/latest.xpi"
  echo "Fetching $slug ($id)"
  curl -fsSL -o "$dest" "$url"
  ls -lh "$dest"
}

fetch_one "uBlock0@raymondhill.net" "uBlock Origin"
fetch_one "sponsorBlocker@ajay.app" "SponsorBlock"

echo "XPIs in $OUT — copy into the packaged distribution/extensions/ for offline first-run."
