/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Wire Bromine glass start page as New Tab + Home (chrome://, not file://).
 */

const START_URL = "chrome://browser/content/bromine-start/index.html";

export var BromineNewTab = {
  init() {
    try {
      const { AboutNewTab } = ChromeUtils.importESModule(
        "resource:///modules/AboutNewTab.sys.mjs"
      );
      AboutNewTab.newTabURL = START_URL;
    } catch (e) {
      console.error("BromineNewTab: AboutNewTab override failed", e);
    }

    try {
      // Home button / startup homepage
      Services.prefs.setStringPref("browser.startup.homepage", START_URL);
      Services.prefs.setBoolPref("browser.newtabpage.enabled", true);
    } catch (_e) {
      /* ignore */
    }
  },
};

BromineNewTab.init();
