/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Side rail disabled — remove any leftover chrome and keep prefs off.
 */

export var BromineRail = {
  init() {
    try {
      Services.prefs.setBoolPref("bromine.rail.enabled", false);
    } catch (_e) {
      /* ignore */
    }
    this._stripAll();
    Services.obs.addObserver(
      {
        observe: () => BromineRail._stripAll(),
      },
      "browser-delayed-startup-finished"
    );
    Services.obs.addObserver(
      {
        observe: () => BromineRail._stripAll(),
      },
      "domwindowopened"
    );
  },

  _stripAll() {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      try {
        const doc = win.document;
        doc.getElementById("bromine-rail")?.remove();
        doc.getElementById("bromine-rail-flyout")?.remove();
        doc.documentElement.setAttribute("bromine-rail", "false");
        doc.documentElement.removeAttribute("bromine-rail-position");
      } catch (_e) {
        /* ignore */
      }
    }
  },
};

BromineRail.init();
