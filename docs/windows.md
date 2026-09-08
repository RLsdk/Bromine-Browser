# Windows packaging (Bromine)

Bromine’s overlay is the same on Linux and Windows. Packaging differs.

## Option A — MozillaBuild (native)

1. Install [MozillaBuild](https://firefox-source-docs.mozilla.org/setup/windows_build.html).
2. On Linux (or WSL), produce the Bromine source tree:

   ```bash
   make fetch && make dir
   # yields bromine-<version>-<release>/
   ```

3. Copy that tree to the Windows build machine (or build under MozillaBuild from a
   Bromine source tarball: `make all`).
4. Inside MozillaBuild shell:

   ```bash
   cd /c/path/to/bromine-<version>-<release>
   ./mach --no-interactive bootstrap --application-choice=browser
   ./mach build
   ./mach package
   ```

5. Installer / zip artifacts appear under `obj-*/dist/`.

## Option B — LibreWolf bsys6-style Docker (recommended for releases)

LibreWolf’s [bsys6](https://librewolf.dev/librewolf/bsys6) produces Windows
`setup.exe`, portable zip, and MSIX from a source tarball.

1. `make all` → `bromine-<version>-<release>.source.tar.gz`
2. Point a forked bsys6 job at that tarball (replace LibreWolf naming with Bromine).
3. Publish `BromineSetup.exe` + `BrominePortable.zip`.

Until a Bromine bsys6 fork exists, use Option A for local Windows binaries.

## Notes

- Updater is disabled (`DisableAppUpdate` / `--disable-updater`). Ship updates manually.
- Profile path: `%USERPROFILE%\.bromine`
- Overrides: `%USERPROFILE%\.bromine\bromine.overrides.cfg`
- Branding assets: `themes/browser/branding/bromine/` (NSIS `branding.nsi` included)
