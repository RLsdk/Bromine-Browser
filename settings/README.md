# Bromine settings

`bromine.cfg` is the autoconfig file applied on every launch (via
`defaults/pref/local-settings.js`). It is forked from LibreWolf’s
`librewolf.cfg` and keeps `librewolf.*` prefs that patches still read.

## Policies

`distribution/policies.json`:

- Telemetry / studies / default-browser agent: disabled
- HTTPS-Only: enabled
- uBlock Origin: `force_installed` + cookie-banner / annoyance filter lists via `3rdparty`
- SponsorBlock: `normal_installed` (user can disable; not forced in private browsing)

## Overrides

`~/.bromine/bromine.overrides.cfg` (see Bromine docs). Use `defaultPref()` /
`pref()` / `lockPref()` like LibreWolf overrides.
