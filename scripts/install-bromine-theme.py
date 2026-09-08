#!/usr/bin/env python3
"""Install Bromine theme CSS, LWT addons, and loader into a Firefox/Bromine source tree."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME = ROOT / "theme"

JAR_ENTRIES = """
# Bromine modular chrome themes
  skin/classic/browser/bromine/always.css                    (../shared/bromine/always.css)
  skin/classic/browser/bromine/chrome.css                    (../shared/bromine/chrome.css)
  skin/classic/browser/bromine/tokens/bromine.css            (../shared/bromine/tokens/bromine.css)
  skin/classic/browser/bromine/modules/base.css              (../shared/bromine/modules/base.css)
  skin/classic/browser/bromine/modules/shell.css             (../shared/bromine/modules/shell.css)
  skin/classic/browser/bromine/modules/compact.css           (../shared/bromine/modules/compact.css)
  skin/classic/browser/bromine/modules/tabs.css              (../shared/bromine/modules/tabs.css)
  skin/classic/browser/bromine/modules/hide-clutter.css      (../shared/bromine/modules/hide-clutter.css)
  skin/classic/browser/bromine/modules/ultralight.css        (../shared/bromine/modules/ultralight.css)
  skin/classic/browser/bromine/modules/rail.css              (../shared/bromine/modules/rail.css)
  skin/classic/browser/bromine/modules/layout.css            (../shared/bromine/modules/layout.css)
"""


def install(srcdir: Path) -> None:
    skin = srcdir / "browser" / "themes" / "shared" / "bromine"
    if skin.exists():
        shutil.rmtree(skin)
    skin.mkdir(parents=True, exist_ok=True)
    shutil.copy2(THEME / "chrome.css", skin / "chrome.css")
    shutil.copy2(THEME / "always.css", skin / "always.css")
    shutil.copytree(THEME / "tokens", skin / "tokens")
    shutil.copytree(THEME / "modules", skin / "modules")

    modules = srcdir / "browser" / "modules"
    shutil.copy2(THEME / "BromineTheme.sys.mjs", modules / "BromineTheme.sys.mjs")
    shutil.copy2(THEME / "BromineRail.sys.mjs", modules / "BromineRail.sys.mjs")
    shutil.copy2(THEME / "BromineLayout.sys.mjs", modules / "BromineLayout.sys.mjs")
    shutil.copy2(THEME / "BromineNewTab.sys.mjs", modules / "BromineNewTab.sys.mjs")
    shutil.copy2(THEME / "BromineWindow.sys.mjs", modules / "BromineWindow.sys.mjs")
    shutil.copy2(THEME / "BromineSidebar.sys.mjs", modules / "BromineSidebar.sys.mjs")

    # Packaged glass start page (chrome://browser/content/bromine-start/)
    start_src = ROOT / "startpage"
    start_dst = srcdir / "browser" / "base" / "content" / "bromine-start"
    if start_dst.exists():
        shutil.rmtree(start_dst)
    start_dst.mkdir(parents=True, exist_ok=True)
    for name in ("index.html", "start.css", "start.js"):
        shutil.copy2(start_src / name, start_dst / name)
    icons_src = start_src / "icons"
    icons_dst = start_dst / "icons"
    if icons_dst.exists():
        shutil.rmtree(icons_dst)
    if icons_src.exists():
        shutil.copytree(icons_src, icons_dst)

    content_jar = srcdir / "browser" / "base" / "content" / "jar.mn"
    if not content_jar.exists():
        # Firefox 128+ may use different layout
        for cand in (srcdir / "browser" / "base" / "jar.mn", srcdir / "browser" / "base" / "content" / "content.jar.mn"):
            if cand.exists():
                content_jar = cand
                break
    if content_jar.exists():
        jt = content_jar.read_text()
        marker = "# Bromine glass start page"
        block = (
            f"{marker}\n"
            "  content/browser/bromine-start/index.html                     (bromine-start/index.html)\n"
            "  content/browser/bromine-start/start.css                      (bromine-start/start.css)\n"
            "  content/browser/bromine-start/start.js                       (bromine-start/start.js)\n"
            "  content/browser/bromine-start/icons/duckduckgo.png           (bromine-start/icons/duckduckgo.png)\n"
            "  content/browser/bromine-start/icons/duckduckgo-html.png      (bromine-start/icons/duckduckgo-html.png)\n"
            "  content/browser/bromine-start/icons/brave.png                (bromine-start/icons/brave.png)\n"
        )
        if marker in jt:
            # leave existing; installer re-run replaces whole tree for start files
            pass
        else:
            content_jar.write_text(jt.rstrip() + "\n" + block)

    addons_dst = srcdir / "browser" / "themes" / "addons"
    for name in ("bromine", "bromine-midnight"):
        src = THEME / "addons" / name
        dst = addons_dst / name
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
    # Drop retired palette themes from older trees
    for retired in ("bromine-nord", "bromine-mocha", "bromine-paper"):
        old = addons_dst / retired
        if old.exists():
            shutil.rmtree(old)

    # Register as built-in Firefox themes (Themes picker + default)
    addons_jar = srcdir / "browser" / "themes" / "addons" / "jar.mn"
    if addons_jar.exists():
        jt = addons_jar.read_text()
        marker = "# Bromine built-in color themes"
        block = (
            f"{marker}\n"
            "  content/builtin-themes/bromine/manifest.json           (bromine/manifest.json)\n"
            "  content/builtin-themes/bromine/icon.svg                (bromine/icon.svg)\n"
            "  content/builtin-themes/bromine/preview.svg             (bromine/preview.svg)\n"
            "  content/builtin-themes/bromine-midnight/manifest.json  (bromine-midnight/manifest.json)\n"
            "  content/builtin-themes/bromine-midnight/icon.svg       (bromine-midnight/icon.svg)\n"
            "  content/builtin-themes/bromine-midnight/preview.svg    (bromine-midnight/preview.svg)\n"
        )
        if marker in jt:
            before, _, rest = jt.partition(marker)
            lines = rest.splitlines(True)
            kept = []
            skipping = True
            for line in lines:
                if skipping and (
                    line.startswith("  content/builtin-themes/bromine")
                    or line.strip() == ""
                    or line.startswith("# Bromine")
                ):
                    continue
                skipping = False
                kept.append(line)
            jt = before.rstrip() + "\n" + block + "".join(kept)
        else:
            jt = jt.rstrip() + "\n" + block
        addons_jar.write_text(jt)

    config = srcdir / "browser" / "themes" / "BuiltInThemeConfig.sys.mjs"
    if config.exists():
        ct = config.read_text()
        # Strip any prior bromine* map entries then insert the two we keep
        import re as _re

        ct = _re.sub(
            r'\s*\[\s*"bromine[^"]*@bromine"\s*,\s*\{[^}]*\}\s*,\s*\]\s*,',
            "",
            ct,
        )
        insert = """  [
    "bromine@bromine",
    {
      version: "1.1.0",
      path: "resource://builtin-themes/bromine/",
    },
  ],
  [
    "bromine-midnight@bromine",
    {
      version: "1.1.0",
      path: "resource://builtin-themes/bromine-midnight/",
    },
  ],
"""
        if "bromine@bromine" not in ct:
            ct = ct.replace(
                "export const BuiltInThemeConfig = new Map([\n",
                "export const BuiltInThemeConfig = new Map([\n" + insert,
                1,
            )
            config.write_text(ct)
        else:
            config.write_text(ct)

    jar = srcdir / "browser" / "themes" / "shared" / "jar.inc.mn"
    if jar.exists():
        text = jar.read_text()
        # Replace prior bromine block if present
        marker = "# Bromine modular chrome themes"
        if marker in text:
            before, _, rest = text.partition(marker)
            # drop old block lines starting with spaces / comments until blank-ish next section
            lines = rest.splitlines(True)
            # skip title line already partitioned into rest starting after marker
            # rest begins with "\n  skin/..." or "\n# ..."
            kept = []
            started = False
            for i, line in enumerate(lines):
                if i == 0 and line.strip() == "":
                    continue
                if line.startswith("  skin/classic/browser/bromine/") or (
                    started and line.startswith("  ")
                ):
                    started = True
                    continue
                if line.startswith("# Bromine"):
                    continue
                kept.append(line)
                if started and line.strip() and not line.startswith("  skin/classic/browser/bromine"):
                    # first non-bromine content — keep from here
                    kept = lines[i:]
                    break
            text = before.rstrip() + "\n" + JAR_ENTRIES + "".join(kept)
        else:
            text = text.rstrip() + "\n" + JAR_ENTRIES
        jar.write_text(text)

    modules_jar = srcdir / "browser" / "modules" / "moz.build"
    if modules_jar.exists():
        text = modules_jar.read_text()
        for mod in (
            "BromineTheme.sys.mjs",
            "BromineRail.sys.mjs",
            "BromineLayout.sys.mjs",
            "BromineNewTab.sys.mjs",
            "BromineWindow.sys.mjs",
            "BromineSidebar.sys.mjs",
        ):
            if mod not in text:
                insert_after = '    "AboutNewTab.sys.mjs",\n'
                entry = f'    "{mod}",\n'
                if insert_after in text:
                    text = text.replace(insert_after, insert_after + entry, 1)
        modules_jar.write_text(text)

    glue = srcdir / "browser" / "components" / "BrowserGlue.sys.mjs"
    if glue.exists():
        g = glue.read_text()
        if "BromineTheme" not in g:
            g += (
                "\n\n// Bromine theme loader\n"
                "ChromeUtils.importESModule(\n"
                '  "resource:///modules/BromineTheme.sys.mjs"\n'
                ");\n"
            )
            glue.write_text(g)

    print(f"Bromine theme installed into {srcdir}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <firefox-source-dir>", file=sys.stderr)
        sys.exit(1)
    install(Path(sys.argv[1]))
