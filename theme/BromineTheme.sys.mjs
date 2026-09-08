/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Bromine chrome theming + lightweight UI toggles.
 *
 * Colour chrome (chrome.css) only applies while a Bromine LWT is active.
 * about:addons is the source of truth for which theme is on; stock / third-party
 * themes get an unstyled Firefox chrome so their colours actually show.
 *
 * Prefs:
 *   bromine.theme              bromine | midnight  (mirrors active Bromine LWT)
 *   bromine.density            compact | normal | touch
 *   bromine.tabs               underline | pill | minimal
 *   bromine.chrome             full | minimal | ultralight
 *   bromine.hideSingleTab      bool
 *   bromine.accent             CSS color string (empty = theme default)
 */

const THEMES = new Set(["bromine", "midnight"]);
const DENSITIES = new Set(["compact", "normal", "touch"]);
const TAB_STYLES = new Set(["underline", "pill", "minimal"]);
const CHROME_MODES = new Set(["full", "minimal", "ultralight"]);

const LWT_IDS = {
  bromine: "bromine@bromine",
  midnight: "bromine-midnight@bromine",
};
const LWT_TO_TOKEN = {
  "bromine@bromine": "bromine",
  "bromine-midnight@bromine": "midnight",
};
const RETIRED_LWT = new Set([
  "bromine-nord@bromine",
  "bromine-mocha@bromine",
  "bromine-paper@bromine",
]);

const PREFS = [
  "bromine.theme",
  "bromine.density",
  "bromine.tabs",
  "bromine.chrome",
  "bromine.hideSingleTab",
  "bromine.accent",
  "extensions.activeThemeID",
];

function prefString(name, fallback) {
  try {
    return Services.prefs.getStringPref(name, fallback);
  } catch (_e) {
    return fallback;
  }
}

function prefBool(name, fallback) {
  try {
    return Services.prefs.getBoolPref(name, fallback);
  } catch (_e) {
    return fallback;
  }
}

function pick(set, value, fallback) {
  return set.has(value) ? value : fallback;
}

export var BromineTheme = {
  _layoutSheetURI: null,
  _colourSheetURI: null,
  _obs: null,
  _applying: false,

  init() {
    this._layoutSheetURI = Services.io.newURI(
      "chrome://browser/skin/bromine/always.css"
    );
    this._colourSheetURI = Services.io.newURI(
      "chrome://browser/skin/bromine/chrome.css"
    );
    this._ensureLayoutSheet();
    this.applyAll();

    this._obs = {
      observe: (subject, topic, data) => {
        if (topic === "nsPref:changed") {
          if (BromineTheme._applying) {
            return;
          }
          // Settings radios → enable matching Bromine LWT (explicit user choice).
          if (data === "bromine.theme") {
            const token = prefString("bromine.theme", "bromine");
            if (THEMES.has(token)) {
              BromineTheme.enableTheme(token).finally(() =>
                BromineTheme.applyAll()
              );
              return;
            }
          }
          BromineTheme.applyAll();
          return;
        }
        if (topic === "browser-delayed-startup-finished") {
          BromineTheme.applyAll();
          return;
        }
        if (topic === "domwindowopened" && subject) {
          subject.addEventListener(
            "load",
            () => {
              try {
                if (
                  subject.document?.documentElement?.getAttribute(
                    "windowtype"
                  ) === "navigator:browser"
                ) {
                  BromineTheme.applyWindow(subject);
                }
              } catch (_e) {
                /* ignore */
              }
            },
            { once: true }
          );
        }
      },
    };
    for (const p of PREFS) {
      Services.prefs.addObserver(p, this._obs);
    }
    Services.obs.addObserver(this._obs, "browser-delayed-startup-finished");
    Services.obs.addObserver(this._obs, "domwindowopened");
  },

  applyAll() {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      this.applyWindow(win);
    }
  },

  /**
   * Enable a Bromine / Midnight lightweight theme via AddonManager.
   * Used by Settings radios; about:addons uses AddonManager directly.
   */
  async enableTheme(token) {
    const id = LWT_IDS[token];
    if (!id) {
      return;
    }
    this._applying = true;
    try {
      try {
        Services.prefs.setStringPref("bromine.theme", token);
      } catch (_e) {
        /* ignore */
      }
      const { AddonManager } = ChromeUtils.importESModule(
        "resource://gre/modules/AddonManager.sys.mjs"
      );
      const addon = await AddonManager.getAddonByID(id);
      if (addon && !addon.isActive) {
        await addon.enable();
      } else if (addon) {
        try {
          Services.prefs.setStringPref("extensions.activeThemeID", id);
        } catch (_e2) {
          /* ignore */
        }
      }
    } catch (e) {
      console.warn("BromineTheme: enableTheme failed", e);
    } finally {
      this._applying = false;
    }
  },

  applyWindow(win) {
    try {
      const root = win.document.documentElement;
      const activeId = prefString("extensions.activeThemeID", "");
      const fromLwt = LWT_TO_TOKEN[activeId];

      const density = pick(
        DENSITIES,
        prefString("bromine.density", "compact"),
        "compact"
      );
      const tabs = pick(
        TAB_STYLES,
        prefString("bromine.tabs", "underline"),
        "underline"
      );
      const chrome = pick(
        CHROME_MODES,
        prefString("bromine.chrome", "minimal"),
        "minimal"
      );
      const hideSingle = prefBool("bromine.hideSingleTab", false);
      const accent = prefString("bromine.accent", "").trim();

      // Always keep layout prefs available; colour sheet is gated separately.
      root.setAttribute("bromine-density", density);
      root.setAttribute("bromine-tabs", tabs);
      root.setAttribute("bromine-chrome", chrome);
      root.setAttribute("bromine-hide-single-tab", hideSingle ? "true" : "false");

      if (fromLwt) {
        // Active theme is Bromine or Midnight — paint our chrome.
        root.setAttribute("bromine-theme", fromLwt);
        this._setColourSheetEnabled(true);
        if (accent) {
          root.setAttribute("bromine-accent-custom", "true");
          root.style.setProperty("--bromine-user-accent", accent);
        } else {
          root.removeAttribute("bromine-accent-custom");
          root.style.removeProperty("--bromine-user-accent");
        }
        if (!this._applying) {
          try {
            if (Services.prefs.getStringPref("bromine.theme", "") !== fromLwt) {
              this._applying = true;
              Services.prefs.setStringPref("bromine.theme", fromLwt);
              this._applying = false;
            }
          } catch (_ePref) {
            this._applying = false;
          }
        }
      } else {
        // Stock / third-party theme — drop colour overrides; keep layout sheet.
        root.setAttribute("bromine-theme", "off");
        root.removeAttribute("bromine-accent-custom");
        root.style.removeProperty("--bromine-user-accent");
        this._setColourSheetEnabled(false);

        // Migrate retired Bromine variants once.
        if (RETIRED_LWT.has(activeId) && !this._applying) {
          this.enableTheme("bromine").finally(() => this.applyAll());
        }
      }
    } catch (_e) {
      /* ignore */
    }
  },

  _ensureLayoutSheet() {
    try {
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(
        Ci.nsIStyleSheetService
      );
      if (!sss.sheetRegistered(this._layoutSheetURI, sss.USER_SHEET)) {
        sss.loadAndRegisterSheet(this._layoutSheetURI, sss.USER_SHEET);
      }
    } catch (e) {
      console.error("BromineTheme: layout sheet failed", e);
    }
  },

  _setColourSheetEnabled(enabled) {
    try {
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(
        Ci.nsIStyleSheetService
      );
      // Layout sheet must stay registered for every theme.
      this._ensureLayoutSheet();
      const registered = sss.sheetRegistered(
        this._colourSheetURI,
        sss.USER_SHEET
      );
      if (enabled && !registered) {
        sss.loadAndRegisterSheet(this._colourSheetURI, sss.USER_SHEET);
      } else if (!enabled && registered) {
        sss.unregisterSheet(this._colourSheetURI, sss.USER_SHEET);
      }
    } catch (e) {
      console.error("BromineTheme: colour sheet toggle failed", e);
    }
  },

  async _retireOldThemes() {
    try {
      const { AddonManager } = ChromeUtils.importESModule(
        "resource://gre/modules/AddonManager.sys.mjs"
      );
      for (const id of RETIRED_LWT) {
        try {
          const addon = await AddonManager.getAddonByID(id);
          if (addon) {
            await addon.uninstall();
          }
        } catch (_eOne) {
          /* ignore */
        }
      }
    } catch (e) {
      console.warn("BromineTheme: retire old themes failed", e);
    }
  },

  async _ensureBuiltinThemes() {
    try {
      const { BuiltInThemes } = ChromeUtils.importESModule(
        "resource:///modules/BuiltInThemes.sys.mjs"
      );
      await BuiltInThemes.ensureBuiltInThemes();
      await this._retireOldThemes();
      // Only auto-enable Bromine when nothing usable is selected yet.
      const active = prefString("extensions.activeThemeID", "");
      if (!active || RETIRED_LWT.has(active)) {
        await this.enableTheme(
          pick(THEMES, prefString("bromine.theme", "bromine"), "bromine")
        );
      }
      this.applyAll();
    } catch (e) {
      console.warn("BromineTheme: ensure builtin themes failed", e);
    }
  },
};

BromineTheme.init();
try {
  BromineTheme._ensureBuiltinThemes();
} catch (_e) {
  /* ignore */
}

function idleImport(path) {
  let done = false;
  const run = () => {
    if (done) {
      return;
    }
    done = true;
    try {
      ChromeUtils.importESModule(path);
    } catch (e) {
      console.error("BromineTheme: failed to load", path, e);
    }
  };
  try {
    const defer = Services.prefs.getBoolPref(
      "bromine.performance.deferChromeModules",
      true
    );
    if (!defer) {
      run();
      return;
    }
    try {
      ChromeUtils.idleDispatch(run);
    } catch (_e1) {
      try {
        Services.tm.dispatchToMainThread(run);
      } catch (_e2) {
        run();
        return;
      }
    }
    Services.tm.dispatchToMainThread(() => {
      try {
        const timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        timer.initWithCallback({ notify: run }, 1500, Ci.nsITimer.TYPE_ONE_SHOT);
      } catch (_e3) {
        run();
      }
    });
  } catch (_e) {
    run();
  }
}

try {
  ChromeUtils.importESModule("resource:///modules/BromineWindow.sys.mjs");
} catch (e) {
  console.error("BromineTheme: BromineWindow failed to load", e);
}

try {
  ChromeUtils.importESModule("resource:///modules/BromineNewTab.sys.mjs");
} catch (e) {
  console.error("BromineTheme: BromineNewTab failed to load", e);
}

idleImport("resource:///modules/BromineRail.sys.mjs");
idleImport("resource:///modules/BromineLayout.sys.mjs");
idleImport("resource:///modules/BromineSidebar.sys.mjs");
