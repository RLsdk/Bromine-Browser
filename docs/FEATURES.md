# Bromine features & prefs

## Features (current)

| Area | What you get |
|------|----------------|
| Privacy | LibreWolf/arkenfox-aligned `bromine.cfg`, ETP strict, HTTPS-Only, GPC, FPP |
| Dark sites | `prefers-color-scheme` forced dark (RFP off; FPP keeps other protections) |
| Chrome | Classic / unified strip, Ctrl-drag rearrange, hug-sized tabs, custom `+` |
| URL bar | Solid results panel; opens only while typing |
| Start page | Clock + search; engine switcher (DDG / DDG HTML / Brave / SearXNG) |
| Themes | midnight / nord / mocha / paper + density / tab style / accent |
| Sidebar | Classic strip or Firefox vertical tabs (`bromine.sidebarMode`) |
| Media | Autoplay blocked; Picture-in-Picture on |
| Extensions | uBlock Origin (forced) + SponsorBlock |
| Perf | Modest disk cache, deferred chrome modules, cheap start page |

## Key prefs

| Pref | Default | Meaning |
|------|---------|---------|
| `bromine.chrome.strip` | `classic` | `classic` \| `unified` |
| `bromine.theme` | `midnight` | Token theme |
| `bromine.sidebarMode` | `classic` | `classic` \| `sidebar` (vertical tabs) |
| `bromine.performance.deferChromeModules` | `true` | Idle-load rail/layout/sidebar |
| `layout.css.prefers-color-scheme.content-override` | `2` | `2` = dark sites |
| `network.dns.preferIPv6` | `false` | Avoid broken IPv6 cold-start hangs |
| `browser.urlbar.suggest.topsites` | `false` | Don’t open panel on click |
| `browser.cache.disk.enable` | `true` | Everyday revisit speed |
| `browser.urlbar.speculativeConnect.enabled` | `true` | Warm TLS for first search |

## Settings UI

**Settings → LibreWolf / Bromine pane → Appearance / Sidebar & layout**

## Profile pack

```bash
./scripts/bromine-profile-pack.sh export ~/bromine-backup.tar.zst
./scripts/bromine-profile-pack.sh import ~/bromine-backup.tar.zst
```

Exports theme + strip + privacy-related user prefs (not passwords/cookies by default).

## Extension policy presets

| File | Use |
|------|-----|
| `settings/distribution/policies.json` | Everyday (uBlock + SponsorBlock) |
| `settings/distribution/presets/policies-locked.json` | Locked: only uBlock force-installed |

Copy a preset over `policies.json` before packaging, or into the install’s `distribution/` folder.

## Optional add-ons (not bundled)

- **Dark Reader** — for sites that ignore `prefers-color-scheme`
- **Multi-Account Containers** — site isolation
- Local AI remains **blocked** via enterprise AI controls (privacy default)

## Tab strip recipe

See `.cursor/rules/tabs-must-stay-visible.mdc` — do not casually “improve” hug/`+` sizing.
