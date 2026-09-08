# Bromine Linux packaging

## Why the taskbar showed a Wayland “W”

Running the bare `./bromine` binary from an extracted tarball does **not** register a
`.desktop` file or hicolor icons. Compositors then fall back to a generic Wayland icon.

## Fix (recommended)

```bash
cd /tmp
tar xf /path/to/bromine-155.0.1-1.en-US.linux-x86_64.tar.xz
/path/to/repo/packaging/linux/install-user.sh /tmp/bromine
# or, if using the wrapped package:
# /tmp/bromine/install-user.sh /tmp/bromine
```

This installs:

- `~/.local/share/applications/bromine.desktop` (`StartupWMClass=bromine`, absolute `Icon=` path for Plasma)
- `~/.local/share/icons/hicolor/*/apps/bromine.png` plus copies under `breeze` / `breeze-dark`
- `~/.local/share/pixmaps/bromine.png`
- `~/.local/bin/bromine` → your install

Then **fully quit Bromine** and reopen it (or restart Plasma) so Kickoff/task manager drop the cached placeholder.

## Portable launch (no install)

```bash
./bromine-launch.sh
```

Sets `XDG_DATA_DIRS` to the package `share/` so icons resolve without a system install.

## Appearance customization

Settings → LibreWolf pane → **Appearance**:

| Control | Pref |
|---------|------|
| Theme | `bromine.theme` |
| Density | `bromine.density` |
| Tabs | `bromine.tabs` |
| Chrome weight | `bromine.chrome` |
| Hide single tab | `bromine.hideSingleTab` |
| Custom accent | `bromine.accent` |
