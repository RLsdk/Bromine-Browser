# Bromine

Privacy-first Firefox fork based on [LibreWolf](https://librewolf.net/) patches:
telemetry off, Resist Fingerprinting, HTTPS-Only, ETP strict, **uBlock Origin**
(with cookie-banner filter lists), **SponsorBlock**, and a modular CSS theme
switcher. Default look: dark chrome with bromine orange/red accents.

This repository is an **overlay** — it does not vendor Mozilla’s full source.
It fetches the Firefox release tarball, applies LibreWolf + Bromine patches,
brands the app as Bromine, and builds.

## Features

- Privacy defaults locked via `settings/bromine.cfg` (LibreWolf/arkenfox-aligned)
- Bundled extensions: uBlock Origin (`force_installed`) + SponsorBlock (`normal_installed`)
- Cookie banners via uBlock lists — no separate cookie extension
- Modular themes under `theme/` (CSS tokens + chrome layout)
- Classic / unified chrome strip, hug tabs, dark start page with engine switcher
- Everyday perf: disk cache, deferred chrome modules, IPv4-first DNS
- See [docs/FEATURES.md](docs/FEATURES.md) for the full list + prefs
- Linux first; Windows packaging documented as a second milestone
- App id: `bromine` — profile dirs under `~/.config/bromine/`

## Build (Linux)

Requirements: ~30GB disk, 16GB+ RAM, several hours for a full build.
On CachyOS/Arch, install Firefox build deps (or use `./mach bootstrap`).

```bash
# Optional: skip locale clone during iterate
# export SKIP_FETCHING_LOCALES=1

make fetch          # download + verify Firefox source
make dir            # extract, patch, brand as Bromine
make bootstrap      # one-time toolchain (mach bootstrap)
make setup-wasi     # Linux WASM sandbox libs
make build          # ./mach build
make package        # bromine-*.tar.xz
make appimage       # portable dist/Bromine-*-x86_64.AppImage
# or
make run
```

Artifacts land as `bromine-<version>-<release>.en-US.*.tar.xz`.
AppImage: see [docs/appimage.md](docs/appimage.md) (`make appimage`).

## Themes

| Pref `bromine.theme` | Look |
|--------------------|------|
| `bromine` (default) | Warm dark + orange accents |
| `midnight` | Near-black + muted ember accents |

Also: `bromine.density` (compact/normal/touch), `bromine.tabs` (underline/pill/minimal),
`bromine.chrome` (full/minimal/ultralight), `bromine.hideSingleTab`, `bromine.accent`.

**Firefox themes:** built-in **Bromine** and **Bromine Midnight** (`about:addons`).
Chrome colour CSS applies when one of those is active; other Firefox themes show stock
colours. The new-tab search UI follows the active theme.

## Linux taskbar icon

Extract the tarball and run:

```bash
./packaging/linux/install-user.sh /path/to/extracted/bromine
```

See [docs/linux-icons.md](docs/linux-icons.md).

## Layout

| Path | Role |
|------|------|
| `patches/` | LibreWolf + Bromine patches |
| `settings/bromine.cfg` | Autoconfig privacy prefs |
| `settings/distribution/policies.json` | uBlock + SponsorBlock + telemetry policies |
| `themes/browser/branding/bromine/` | Icons, brand.ftl, configure.sh |
| `theme/` | Modular CSS + BromineTheme.sys.mjs |
| `startpage/` | Local lightweight start page |
| `packaging/linux/` | `.desktop`, launcher, user install |
| `scripts/` | Fetch/patch/theme/package helpers |
| `assets/mozconfig` | `--with-app-name=bromine` |

## Overrides

Create `~/.bromine/bromine.overrides.cfg` (or XDG config path) for personal prefs.
Same autoconfig syntax as LibreWolf overrides.

## Windows

See [docs/windows.md](docs/windows.md). Same overlay; MozillaBuild or LibreWolf-style
`bsys6` Docker packaging.

## Legal

- MPL-2.0 (Mozilla + LibreWolf patch lineage)
- Do not use Firefox or LibreWolf trademarks in marketing assets
- Keep Mozilla notices in redistributed binaries
- SponsorBlock queries its API for video segment data (privacy tradeoff; disableable)

## Upstream

Privacy patches and much of the build scaffolding come from LibreWolf.
Bromine adds branding, theme CSS, Bromine profile paths, uBlock cookie lists, and SponsorBlock.
