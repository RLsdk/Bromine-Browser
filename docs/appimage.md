# Bromine AppImage (Linux)

Portable **x86_64 AppImage** for Arch / CachyOS / EndeavourOS and other modern
glibc distros (Fedora, Ubuntu LTS, openSUSE, …).

## Build

From a finished package (or the live install tree):

```bash
# 1) Firefox/Bromine package (if you do not already have one)
make fetch && make dir && make bootstrap && make setup-wasi
make build && make package
./scripts/wrap-linux-package.sh bromine-*.en-US.linux-x86_64.tar.xz

# 2) AppImage
./scripts/build-appimage.sh
# or
make appimage
```

Output:

```
dist/Bromine-<version>-<release>-x86_64.AppImage
dist/Bromine-<version>-<release>-x86_64.AppImage.sha256
```

`build-appimage.sh` auto-finds:

1. `bromine-*-xdg.tar.xz` in the repo or `~/builds/bromine/`
2. Plain `bromine-*.linux-x86_64.tar.xz`
3. `~/.local/share/bromine/bromine` (installed tree)

Override:

```bash
./scripts/build-appimage.sh /path/to/bromine-…tar.xz
OUTDIR=/tmp/out ./scripts/build-appimage.sh
```

## Run

```bash
chmod +x dist/Bromine-*-x86_64.AppImage
./dist/Bromine-*-x86_64.AppImage
```

Optional user install:

```bash
install -Dm755 dist/Bromine-*-x86_64.AppImage ~/.local/bin/bromine
```

On Arch, if FUSE is missing: `sudo pacman -S fuse2` (or use
`APPIMAGE_EXTRACT_AND_RUN=1` which the launcher already sets for packaging).

## Arch package (optional)

```bash
./scripts/build-appimage.sh
cd packaging/arch
# adjust pkgver/pkgrel to match version/release files
makepkg -si
```

## Notes

- Profiles stay under `~/.config/bromine/` (not inside the AppImage).
- The AppImage embeds the full browser + start page + theme chrome from the
  package you feed it — rebuild after hot-patches if you want those in the image.
- Do not redistribute as “Firefox” or “LibreWolf”; keep MPL notices.
