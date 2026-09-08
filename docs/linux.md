# Linux build notes (CachyOS / Arch)

## Dependencies

Prefer Mozilla’s bootstrap (handles most toolchains):

```bash
make fetch && make dir
make bootstrap
make setup-wasi
```

Or install Arch packages roughly equivalent to Firefox’s `makedepends`
(clang, rust, cbindgen, nodejs, python, nasm, unzip, zip, …).

## Iterate without full rebuild

```bash
export SKIP_FETCHING_LOCALES=1
make dir    # after patch/theme edits
make build
make run
```

## Verify privacy defaults

On a fresh profile:

1. `about:addons` — uBlock Origin force-installed; SponsorBlock installed (disableable)
2. uBlock dashboard → Filter lists — cookie / annoyances lists enabled
3. `about:preferences#privacy` — HTTPS-Only on; ETP strict
4. `about:config` — `privacy.resistFingerprinting` true; telemetry prefs locked
5. Bromine pane — theme radios change `bromine.theme` immediately (Midnight = orange accents)

## Disk

Keep `firefox-*.source.tar.xz` between cleans (`make clean` keeps it;
`make distclean` removes it).

## AppImage

Portable image for Arch and other distros:

```bash
make appimage
# or
./scripts/build-appimage.sh /path/to/bromine-…tar.xz
```

See [docs/appimage.md](docs/appimage.md).
