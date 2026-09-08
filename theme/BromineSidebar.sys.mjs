/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Coherent sidebar mode: classic strip vs Firefox vertical tabs.
 *
 * Prefs:
 *   bromine.sidebarMode   "classic" | "sidebar"
 *   bromine.verticalTabs  bool (synced)
 */

function applySidebarMode(mode) {
  const sidebar = mode === "sidebar";
  try {
    Services.prefs.setBoolPref("bromine.verticalTabs", sidebar);
    Services.prefs.setBoolPref("sidebar.verticalTabs", sidebar);
    if (sidebar) {
      Services.prefs.setBoolPref("sidebar.revamp", true);
      // Keep bookmarks bar out of the way when using vertical tabs
      Services.prefs.setStringPref(
        "browser.toolbars.bookmarks.visibility",
        "never"
      );
    }
  } catch (e) {
    console.warn("BromineSidebar: apply failed", e);
  }

  for (const win of Services.wm.getEnumerator("navigator:browser")) {
    try {
      win.document.documentElement.setAttribute(
        "bromine-sidebar-mode",
        sidebar ? "sidebar" : "classic"
      );
    } catch (_e) {
      /* ignore */
    }
  }
}

export var BromineSidebar = {
  init() {
    const apply = () => {
      const mode = Services.prefs.getStringPref(
        "bromine.sidebarMode",
        "classic"
      );
      applySidebarMode(mode);
    };

    apply();

    Services.prefs.addObserver("bromine.sidebarMode", {
      observe: () => apply(),
    });
    Services.prefs.addObserver("bromine.verticalTabs", {
      observe: (_s, _t, _d) => {
        // Keep sidebarMode in sync when toggled from Settings checkbox
        try {
          const on = Services.prefs.getBoolPref("bromine.verticalTabs", false);
          const want = on ? "sidebar" : "classic";
          if (
            Services.prefs.getStringPref("bromine.sidebarMode", "classic") !==
            want
          ) {
            Services.prefs.setStringPref("bromine.sidebarMode", want);
          }
        } catch (_e) {
          /* ignore */
        }
      },
    });

    Services.obs.addObserver(
      {
        observe: () => apply(),
      },
      "browser-delayed-startup-finished"
    );
    Services.obs.addObserver(
      {
        observe: () => apply(),
      },
      "domwindowopened"
    );
  },
};

BromineSidebar.init();
