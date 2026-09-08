# Bromine modular bookmark rail

Discord-style vertical rail: **bookmark folders** become circular icons.

## Setup

1. Create folders on the **Bookmarks Toolbar** (Ctrl+Shift+B to show it temporarily if needed).
2. Put bookmarks inside those folders.
3. Settings → Bromine → **Modular rail** → enable (on by default).

Each toolbar folder appears as a pill. Click to open a flyout of its bookmarks (nested folders drill in).

## Prefs

| Pref | Default | Meaning |
|------|---------|---------|
| `bromine.rail.enabled` | `true` | Show the rail |
| `bromine.rail.position` | `left` | `left` / `right` |
| `bromine.rail.source` | `toolbar` | `toolbar` / `menu` / `both` |
| `bromine.verticalTabs` | `false` | Firefox vertical tabs |
| `bromine.findbarCompact` | `true` | Slimmer find bar |

## Files

- `theme/BromineRail.sys.mjs` — Places → UI
- `theme/modules/rail.css` — Discord-like chrome
- Appearance controls in `patches/pref-pane/librewolf.inc.xhtml`
