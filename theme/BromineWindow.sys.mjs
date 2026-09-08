/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Window shell helpers:
 * - CSD prefs + resize mode
 * - chrome strip: unified (single row) or classic (tabs + urlbar below)
 * - hold Ctrl and drag the URL bar / toolbars to rearrange
 */

const SETTINGS_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#f3ebe4">
      <path d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
      <path d="M12.9 8.7c.04-.23.06-.47.06-.7s-.02-.47-.06-.7l1.52-1.19a.38.38 0 0 0 .09-.48L12.97 3.1a.38.38 0 0 0-.45-.17l-1.79.72a5.4 5.4 0 0 0-1.22-.7L9.24.99A.38.38 0 0 0 8.87.7H7.13a.38.38 0 0 0-.37.29l-.27 1.96c-.44.18-.85.41-1.22.7l-1.79-.72a.38.38 0 0 0-.45.17L1.49 5.63a.38.38 0 0 0 .09.48L3.1 7.3c-.04.23-.06.47-.06.7s.02.47.06.7L1.58 9.89a.38.38 0 0 0-.09.48l1.54 2.66c.1.18.32.26.51.17l1.79-.72c.37.29.78.52 1.22.7l.27 1.96c.04.18.19.31.37.31h1.74c.18 0 .33-.13.37-.31l.27-1.96c.44-.18.85-.41 1.22-.7l1.79.72c.19.09.41.01.51-.17l1.54-2.66a.38.38 0 0 0-.09-.48L12.9 8.7zM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
    </svg>`
  );

function chromeStripMode() {
  try {
    const v = Services.prefs.getStringPref("bromine.chrome.strip", "classic");
    return v === "unified" ? "unified" : "classic";
  } catch (_e) {
    return "classic";
  }
}

function setChromeStripMode(mode) {
  Services.prefs.setStringPref(
    "bromine.chrome.strip",
    mode === "unified" ? "unified" : "classic"
  );
}

export var BromineWindow = {
  _wired: new WeakSet(),
  _unified: false,

  init() {
    try {
      Services.prefs.setIntPref("browser.tabs.inTitlebar", 1);
    } catch (_e) {
      try {
        Services.prefs.setBoolPref("browser.tabs.drawInTitlebar", true);
      } catch (_e2) {
        /* ignore */
      }
    }
    try {
      Services.prefs.setBoolPref("widget.gtk.rounded-bottom-corners.enabled", true);
    } catch (_e) {
      /* ignore */
    }
    try {
      Services.prefs.setStringPref("browser.toolbars.bookmarks.visibility", "never");
    } catch (_e) {
      /* ignore */
    }

    this._unifyChrome();
    this._hookAll();
    Services.obs.addObserver(
      {
        observe: () => {
          BromineWindow._unifyChrome();
          BromineWindow._hookAll();
        },
      },
      "browser-delayed-startup-finished"
    );
    Services.obs.addObserver(
      {
        observe: () => {
          BromineWindow._unifyChrome();
          BromineWindow._hookAll();
        },
      },
      "domwindowopened"
    );
    Services.prefs.addObserver("bromine.chrome.strip", {
      observe: () => BromineWindow._unifyChrome(),
    });
  },

  _unifyChrome() {
    const mode = chromeStripMode();
    try {
      const { CustomizableUI } = ChromeUtils.importESModule(
        "resource:///modules/CustomizableUI.sys.mjs"
      );
      for (const id of ["back-button", "forward-button", "reload-button", "home-button", "sidebar-button"]) {
        try {
          const place = CustomizableUI.getPlacementOfWidget(id);
          if (place?.area === CustomizableUI.AREA_TABSTRIP) {
            CustomizableUI.addWidgetToArea(id, CustomizableUI.AREA_NAVBAR, 0);
          }
        } catch (_e) {
          /* ignore */
        }
      }
      try {
        const place = CustomizableUI.getPlacementOfWidget("urlbar-container");
        if (mode === "classic") {
          if (!place || place.area !== CustomizableUI.AREA_NAVBAR) {
            CustomizableUI.addWidgetToArea(
              "urlbar-container",
              CustomizableUI.AREA_NAVBAR,
              0
            );
          }
        } else if (!place || place.area !== CustomizableUI.AREA_TABSTRIP) {
          CustomizableUI.addWidgetToArea(
            "urlbar-container",
            CustomizableUI.AREA_TABSTRIP,
            0
          );
        }
      } catch (_e) {
        /* locked on some builds */
      }
      this._unified = mode === "unified";
    } catch (e) {
      console.warn("BromineWindow: unify skipped", e);
      this._unified = mode === "unified";
    }

    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      this._layoutStrip(win);
      try {
        const root = win.document.documentElement;
        root.setAttribute("bromine-chrome-strip", mode);
        root.setAttribute(
          "bromine-unified-chrome",
          mode === "unified" ? "true" : "false"
        );
        const bookmarks = win.document.getElementById("PersonalToolbar");
        if (bookmarks) {
          bookmarks.collapsed = true;
        }
      } catch (_e) {
        /* ignore */
      }
    }
  },

  _layoutStrip(win) {
    try {
      const doc = win.document;
      const toolbar = doc.getElementById("TabsToolbar");
      if (!toolbar) {
        return;
      }
      const mode = chromeStripMode();

      for (const id of ["bromine-back-button", "bromine-forward-button", "bromine-appmenu-button"]) {
        doc.getElementById(id)?.remove();
      }

      let cluster = doc.getElementById("bromine-leading");
      if (!cluster) {
        cluster = doc.createXULElement("toolbaritem");
        cluster.id = "bromine-leading";
        cluster.setAttribute("removable", "false");
        cluster.setAttribute("skipintoolbarset", "true");
      }

      for (const child of [...cluster.children]) {
        const id = child.id;
        if (id !== "bromine-settings-button" && id !== "PanelUI-button" && id !== "PanelUI-menu-button") {
          if (["back-button", "forward-button", "reload-button", "home-button", "sidebar-button"].includes(id)) {
            const nav = doc.getElementById("nav-bar-customization-target") || doc.getElementById("nav-bar");
            nav?.appendChild(child);
          } else {
            child.remove();
          }
        }
      }

      let settings = doc.getElementById("bromine-settings-button");
      if (!settings) {
        settings = this._makeButton(doc, {
          id: "bromine-settings-button",
          label: "Settings",
          icon: SETTINGS_ICON,
          onCommand: () => this._openSettings(win),
        });
        cluster.insertBefore(settings, cluster.firstChild);
      } else {
        settings.style.listStyleImage = `url("${SETTINGS_ICON}")`;
        settings.setAttribute("image", SETTINGS_ICON);
      }

      const panelWrap =
        doc.getElementById("PanelUI-button") ||
        doc.getElementById("PanelUI-menu-button");
      if (panelWrap && panelWrap.parentElement !== cluster) {
        cluster.appendChild(panelWrap);
      }

      const tabs = doc.getElementById("tabbrowser-tabs");
      if (cluster.parentElement !== toolbar) {
        if (tabs?.parentElement === toolbar) {
          toolbar.insertBefore(cluster, tabs);
        } else {
          toolbar.insertBefore(cluster, toolbar.firstChild);
        }
      }

      const urlbar = doc.getElementById("urlbar-container");
      const nav = doc.getElementById("nav-bar");
      const navTarget =
        doc.getElementById("nav-bar-customization-target") || nav;

      if (mode === "classic") {
        // Regular Firefox: tabs on top, URL bar on the nav row below
        if (urlbar && navTarget && urlbar.parentElement !== navTarget) {
          navTarget.insertBefore(urlbar, navTarget.firstChild);
        }
      } else if (urlbar) {
        if (urlbar.previousSibling !== cluster) {
          toolbar.insertBefore(urlbar, cluster.nextSibling);
        }
        if (tabs && urlbar.nextSibling !== tabs) {
          toolbar.insertBefore(tabs, urlbar.nextSibling);
        }
      }

      this._ensureTrailingCluster(win);
      this._ensureNewTabButton(win);
      this._patchUrlbarTypeOnly(win);
      this._ensureCtrlArrange(win);
      // One settle pass after first layout
      win.requestAnimationFrame(() => this._placeNewTabButton(win));
    } catch (e) {
      console.warn("BromineWindow: strip layout failed", e);
    }
  },

  /**
   * Right-side action cluster: + · extensions · downloads · library · all-tabs
   * Pinned before window controls (far right), not after the last tab.
   */
  _ensureTrailingCluster(win) {
    try {
      const doc = win.document;
      const toolbar = doc.getElementById("TabsToolbar");
      if (!toolbar) {
        return;
      }

      let trail = doc.getElementById("bromine-trailing");
      if (!trail) {
        trail = doc.createXULElement("toolbaritem");
        trail.id = "bromine-trailing";
        trail.setAttribute("removable", "false");
        trail.setAttribute("skipintoolbarset", "true");
      }

      const ids = [
        "unified-extensions-button",
        "downloads-button",
        "library-button",
        "history-panelmenu",
        "alltabs-button",
      ];
      for (const id of ids) {
        const el = doc.getElementById(id);
        if (!el) {
          continue;
        }
        el.hidden = false;
        el.removeAttribute("hidden");
        el.style.removeProperty("display");
        el.style.removeProperty("visibility");
        el.style.removeProperty("width");
        el.style.removeProperty("min-width");
        el.style.removeProperty("max-width");
        el.style.removeProperty("flex");
        el.style.removeProperty("opacity");
        if (el.parentElement !== trail) {
          trail.appendChild(el);
        }
      }

      // Keep + out of the trailing cluster — it hugs the last tab.
      const plus = doc.getElementById("bromine-newtab-button");
      const tabs = doc.getElementById("tabbrowser-tabs");
      if (plus && plus.parentElement === trail && tabs) {
        tabs.after(plus);
      }

      const controls = toolbar.querySelector(".titlebar-buttonbox-container");
      if (trail.parentElement !== toolbar) {
        if (controls) {
          toolbar.insertBefore(trail, controls);
        } else {
          toolbar.appendChild(trail);
        }
      } else if (controls && trail.nextSibling !== controls) {
        toolbar.insertBefore(trail, controls);
      }
    } catch (e) {
      console.warn("BromineWindow: trailing cluster failed", e);
    }
  },

  /**
   * Only show urlbar results while typing — block click/focus autoOpen
   * (Firefox opens history for a valid page URL on mousedown).
   */
  _patchUrlbarTypeOnly(win) {
    try {
      if (win.__bromineUrlbarTypeOnly) {
        return;
      }
      const input = win.gURLBar;
      if (!input?.view?.autoOpen) {
        win.setTimeout(() => this._patchUrlbarTypeOnly(win), 200);
        return;
      }
      win.__bromineUrlbarTypeOnly = true;
      const view = input.view;
      const orig = view.autoOpen.bind(view);
      view.autoOpen = options => {
        const type = options?.event?.type;
        if (type === "mousedown" || type === "command") {
          return false;
        }
        return orig(options);
      };
    } catch (e) {
      console.warn("BromineWindow: urlbar type-only patch failed", e);
    }
  },

  /**
   * Hold Ctrl and drag chrome like a window — no menu.
   * Drop the URL bar on the tab row → unified; drop below tabs → classic.
   */
  _ensureCtrlArrange(win) {
    if (win.__bromineCtrlArrange) {
      return;
    }
    win.__bromineCtrlArrange = true;
    const doc = win.document;
    const root = doc.documentElement;
    let drag = null;

    const applyMode = mode => {
      if (mode !== "classic" && mode !== "unified") {
        return;
      }
      if (chromeStripMode() === mode) {
        return;
      }
      setChromeStripMode(mode);
      BromineWindow._unifyChrome();
    };

    const endDrag = () => {
      if (!drag) {
        return;
      }
      drag.ghost?.remove();
      drag.el.classList.remove("bromine-arrange-dragging");
      root.classList.remove("bromine-arrange-active");
      doc.getElementById("TabsToolbar")?.classList.remove("bromine-drop-hot");
      doc.getElementById("nav-bar")?.classList.remove("bromine-drop-hot");
      drag = null;
    };

    const syncCtrl = event => {
      const on = !!(event.ctrlKey && !event.metaKey && !event.altKey);
      root.classList.toggle("bromine-ctrl-arrange", on);
      if (!on) {
        endDrag();
      }
    };

    const movable = el => {
      if (!el?.closest) {
        return null;
      }
      // Prefer URL bar; otherwise allow leading cluster
      return el.closest("#urlbar-container") || el.closest("#bromine-leading");
    };

    const pickMode = (x, y) => {
      const tabsBar = doc.getElementById("TabsToolbar");
      const nav = doc.getElementById("nav-bar");
      const tabsRect = tabsBar?.getBoundingClientRect();
      if (tabsRect && y <= tabsRect.bottom + 8) {
        return "unified";
      }
      if (nav) {
        const nr = nav.getBoundingClientRect();
        if (y >= nr.top - 8) {
          return "classic";
        }
      }
      // Below tabs row → classic (Firefox-like URL under tabs)
      return tabsRect && y > tabsRect.bottom ? "classic" : "unified";
    };

    const highlightDrop = (x, y) => {
      const mode = pickMode(x, y);
      const tabsBar = doc.getElementById("TabsToolbar");
      const nav = doc.getElementById("nav-bar");
      tabsBar?.classList.toggle("bromine-drop-hot", mode === "unified");
      nav?.classList.toggle("bromine-drop-hot", mode === "classic");
      return mode;
    };

    win.addEventListener("keydown", syncCtrl, true);
    win.addEventListener("keyup", syncCtrl, true);
    win.addEventListener(
      "blur",
      () => {
        root.classList.remove("bromine-ctrl-arrange");
        endDrag();
      },
      true
    );

    win.addEventListener(
      "pointerdown",
      e => {
        if (!e.ctrlKey || e.button !== 0 || e.metaKey || e.altKey) {
          return;
        }
        // Don't steal focus from typing in the address field unless dragging
        if (e.target?.closest?.("#urlbar-input, .urlbar-input-box")) {
          // still allow drag from the chrome chrome around the input
        }
        const el = movable(e.target);
        if (!el) {
          return;
        }
        const rect = el.getBoundingClientRect();
        drag = {
          el,
          ox: e.clientX - rect.left,
          oy: e.clientY - rect.top,
          x0: e.clientX,
          y0: e.clientY,
          armed: false,
          ghost: null,
        };
      },
      true
    );

    win.addEventListener(
      "pointermove",
      e => {
        if (!drag) {
          return;
        }
        const dx = e.clientX - drag.x0;
        const dy = e.clientY - drag.y0;
        if (!drag.armed) {
          if (Math.abs(dx) + Math.abs(dy) < 5) {
            return;
          }
          drag.armed = true;
          e.preventDefault();
          root.classList.add("bromine-arrange-active");
          drag.el.classList.add("bromine-arrange-dragging");

          const rect = drag.el.getBoundingClientRect();
          const ghost = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
          ghost.id = "bromine-arrange-ghost";
          ghost.className = "bromine-arrange-ghost";
          ghost.textContent =
            drag.el.id === "urlbar-container" ? "Address bar" : "Controls";
          ghost.style.width = `${Math.max(120, rect.width)}px`;
          ghost.style.height = `${Math.max(28, rect.height)}px`;
          root.appendChild(ghost);
          drag.ghost = ghost;
          try {
            drag.el.setPointerCapture?.(e.pointerId);
          } catch (_err) {
            /* ignore */
          }
        }

        const left = e.clientX - drag.ox;
        const top = e.clientY - drag.oy;
        if (drag.ghost) {
          drag.ghost.style.transform = `translate(${left}px, ${top}px)`;
        }
        highlightDrop(e.clientX, e.clientY);
      },
      true
    );

    win.addEventListener(
      "pointerup",
      e => {
        if (!drag) {
          return;
        }
        const armed = drag.armed;
        const x = e.clientX;
        const y = e.clientY;
        endDrag();
        if (armed) {
          applyMode(pickMode(x, y));
        }
        if (!(e.ctrlKey && !e.metaKey && !e.altKey)) {
          root.classList.remove("bromine-ctrl-arrange");
        }
      },
      true
    );
  },

  _openSettings(win) {
    try {
      if (typeof win.openPreferences === "function") {
        win.openPreferences();
        return;
      }
    } catch (_e) {
      /* fall through */
    }
    try {
      win.openTrustedLinkIn("about:preferences", "tab");
    } catch (_e2) {
      win.gBrowser?.addTab("about:preferences", {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
    }
  },

  _ensureNewTabButton(win) {
    try {
      const doc = win.document;
      const toolbar = doc.getElementById("TabsToolbar");
      const tabs = doc.getElementById("tabbrowser-tabs");
      if (!toolbar || !tabs) {
        return;
      }

      this._ensureTrailingCluster(win);

      const native = doc.getElementById("tabs-newtab-button");
      if (native) {
        native.hidden = true;
        native.style.setProperty("display", "none", "important");
      }

      let btn = doc.getElementById("bromine-newtab-button");
      if (!btn) {
        btn = doc.createXULElement("toolbarbutton");
        btn.id = "bromine-newtab-button";
        btn.className = "toolbarbutton-1 chromeclass-toolbar-additional";
        btn.setAttribute("tooltiptext", "Open a new tab (Ctrl+T)");
        btn.setAttribute("aria-label", "Open a new tab");
        btn.setAttribute("removable", "false");
        btn.setAttribute("skipintoolbarset", "true");

        let lastOpen = 0;
        const openOne = event => {
          event?.stopPropagation?.();
          event?.preventDefault?.();
          const now = Date.now();
          if (now - lastOpen < 350) {
            return;
          }
          lastOpen = now;
          this._placeNewTabButton(win, { anticipateOpen: true });
          if (typeof win.BrowserCommands?.openTab === "function") {
            win.BrowserCommands.openTab();
            return;
          }
          win.openTrustedLinkIn?.(
            "chrome://browser/content/bromine-start/index.html",
            "tab"
          );
        };

        btn.addEventListener("click", openOne, true);
        btn.addEventListener(
          "mousedown",
          e => {
            e.stopPropagation();
          },
          true
        );
      }

      delete tabs.dataset.bromineHugWidth;
      delete tabs.dataset.bromineHugKey;

      // + hugs the last tab; utility buttons stay in #bromine-trailing (far right).
      if (btn.previousSibling !== tabs || btn.parentElement !== tabs.parentElement) {
        tabs.after(btn);
      }

      this._placeNewTabButton(win);
      this._watchTabStrip(win);
    } catch (e) {
      console.warn("BromineWindow: new tab button failed", e);
    }
  },

  /**
   * Tab strip width budget. + hugs last tab; utilities sit in #bromine-trailing.
   *
   * opts.anticipateOpen — pre-size for count+1 before the tab exists (kills flash)
   * opts.remeasure — refresh cached toolbar budget (resize)
   */
  _placeNewTabButton(win, opts = {}) {
    try {
      const doc = win.document;
      const tabs = doc.getElementById("tabbrowser-tabs");
      const btn = doc.getElementById("bromine-newtab-button");
      if (!tabs || !btn) {
        return;
      }
      if (btn.previousSibling !== tabs) {
        tabs.after(btn);
      }

      let maxW = win.__bromineTabMaxW || 0;
      if (!maxW || opts.remeasure) {
        const toolbar = doc.getElementById("TabsToolbar");
        if (!toolbar) {
          return;
        }
        const toolbarW = toolbar.getBoundingClientRect().width || 0;
        let reserved = 40; // + button after tabs
        const leading = doc.getElementById("bromine-leading");
        if (leading?.closest("#TabsToolbar")) {
          reserved += leading.getBoundingClientRect().width || 0;
        }
        const urlbar = doc.getElementById("urlbar-container");
        if (urlbar?.closest("#TabsToolbar")) {
          reserved += urlbar.getBoundingClientRect().width || 0;
        }
        const trail = doc.getElementById("bromine-trailing");
        if (trail) {
          reserved += trail.getBoundingClientRect().width || 120;
        }
        const controls = toolbar.querySelector(".titlebar-buttonbox-container");
        if (controls) {
          reserved += (controls.getBoundingClientRect().width || 0) + 12;
        }
        maxW = Math.max(160, (toolbarW || 1200) - reserved - 24);
        win.__bromineTabMaxW = maxW;
      }

      let count = 0;
      let pinned = 0;
      try {
        for (const tab of win.gBrowser?.tabs || []) {
          if (!tab.hidden && !tab.closing) {
            count += 1;
            if (tab.pinned) {
              pinned += 1;
            }
          }
        }
      } catch (_e) {
        /* ignore */
      }
      if (!count) {
        count = tabs.querySelectorAll(
          "tab.tabbrowser-tab:not([hidden]), .tabbrowser-tab:not([hidden])"
        ).length;
      }
      count = Math.max(1, count);
      if (opts.anticipateOpen) {
        count += 1;
      }
      const unpinned = Math.max(0, count - pinned);

      const TAB_MAX = 150;
      const TAB_MIN = 76;
      const GAP = 6;
      const pinnedW = pinned * 36;
      let tabW = TAB_MAX;
      if (unpinned > 0) {
        tabW = Math.floor((maxW - pinnedW) / unpinned) - GAP;
        tabW = Math.max(TAB_MIN, Math.min(TAB_MAX, tabW));
      }
      const width = Math.max(
        140,
        Math.min(maxW, pinnedW + unpinned * (tabW + GAP))
      );

      const key = `${count}:${tabW}:${width}:${maxW}`;
      if (tabs.dataset.bromineKey === key) {
        // Still pin — Firefox may have scrolled after a prior place()
        this._pinTabStripStart(win, tabs, { force: true });
        return;
      }
      tabs.dataset.bromineKey = key;

      const tabWCss = `${tabW}px`;
      const widthCss = `${width}px`;
      const maxWCss = `${maxW}px`;
      if (tabs.style.getPropertyValue("--bromine-tab-width") !== tabWCss) {
        tabs.style.setProperty("--bromine-tab-width", tabWCss);
      }
      if (tabs.style.getPropertyValue("--bromine-tab-min") !== `${TAB_MIN}px`) {
        tabs.style.setProperty("--bromine-tab-min", `${TAB_MIN}px`);
      }
      if (tabs.style.width !== widthCss) {
        tabs.style.setProperty("width", widthCss, "important");
      }
      if (tabs.style.maxWidth !== maxWCss) {
        tabs.style.setProperty("max-width", maxWCss, "important");
      }
      if (tabs.style.minWidth !== "140px") {
        tabs.style.setProperty("min-width", "140px", "important");
      }

      this._pinTabStripStart(win, tabs, { force: true });
    } catch (e) {
      console.warn("BromineWindow: place new tab failed", e);
    }
  },

  _pinTabStripStart(win, tabsEl, opts = {}) {
    try {
      const tabs = tabsEl || win.document.getElementById("tabbrowser-tabs");
      if (!tabs) {
        return;
      }
      const box =
        win.document.getElementById("tabbrowser-arrowscrollbox") ||
        tabs.querySelector("arrowscrollbox");

      // Always drop overflow chrome — it inserts left scroll affordances
      // that shove tabs right during the new-tab grey flash.
      if (tabs.hasAttribute("overflow")) {
        tabs.removeAttribute("overflow");
      }
      if (box?.hasAttribute?.("overflowing")) {
        box.removeAttribute("overflowing");
      }

      if (!box) {
        return;
      }

      let scrolled = false;
      try {
        scrolled =
          (box.scrollPosition | 0) > 0 ||
          ("scrollLeft" in box && (box.scrollLeft | 0) > 0);
      } catch (_e) {
        /* ignore */
      }
      let clip = null;
      try {
        clip =
          box.shadowRoot?.querySelector?.("scrollbox") ||
          box.querySelector?.("scrollbox");
        if (!scrolled && clip && (clip.scrollLeft | 0) > 0) {
          scrolled = true;
        }
      } catch (_e2) {
        /* ignore */
      }
      if (
        !opts.force &&
        opts.onlyIfScrolled &&
        !scrolled &&
        !tabs.hasAttribute("overflow")
      ) {
        return;
      }
      if (
        !opts.force &&
        !scrolled &&
        box.hasAttribute("scrolledtostart") &&
        !box.hasAttribute("overflowing")
      ) {
        return;
      }

      try {
        box.scrollPosition = 0;
      } catch (_e3) {
        /* ignore */
      }
      try {
        if ("scrollLeft" in box) {
          box.scrollLeft = 0;
        }
      } catch (_e4) {
        /* ignore */
      }
      try {
        if (typeof box.scrollTo === "function") {
          box.scrollTo(0);
        }
      } catch (_e5) {
        /* ignore */
      }
      try {
        if (!box.hasAttribute("scrolledtostart")) {
          box.setAttribute("scrolledtostart", "true");
        }
      } catch (_e6) {
        /* ignore */
      }
      try {
        if (clip) {
          clip.scrollLeft = 0;
        }
      } catch (_e7) {
        /* ignore */
      }
    } catch (e) {
      console.warn("BromineWindow: pin tab strip failed", e);
    }
  },

  _cacheTabAvail(win) {
    this._placeNewTabButton(win, { remeasure: true });
  },

  _watchTabStrip(win) {
    if (win.__bromineTabHugWatch8) {
      return;
    }
    win.__bromineTabHugWatch8 = true;

    const scrub = () => this._pinTabStripStart(win, null, { force: true });
    const onTabChange = () => {
      scrub();
      this._placeNewTabButton(win);
      scrub();
      // arrowscrollbox toggles overflowing in a rAF after resize — scrub after
      win.requestAnimationFrame(() => {
        this._placeNewTabButton(win);
        scrub();
      });
    };

    win.addEventListener("TabOpen", onTabChange, true);
    win.addEventListener("TabClose", onTabChange, true);
    win.addEventListener("TabPinned", onTabChange, true);
    win.addEventListener("TabUnpinned", onTabChange, true);
    win.addEventListener("TabSelect", scrub, true);

    const tabs = win.document.getElementById("tabbrowser-tabs");
    if (tabs && !win.__bromineOverflowGuard2) {
      win.__bromineOverflowGuard2 = true;
      const box =
        win.document.getElementById("tabbrowser-arrowscrollbox") ||
        tabs.querySelector("arrowscrollbox");
      const onOverflow = () => {
        this._placeNewTabButton(win);
        scrub();
      };
      const mo = new win.MutationObserver(() => {
        if (tabs.hasAttribute("overflow") || box?.hasAttribute?.("overflowing")) {
          onOverflow();
        }
      });
      mo.observe(tabs, { attributes: true, attributeFilter: ["overflow"] });
      if (box) {
        mo.observe(box, {
          attributes: true,
          attributeFilter: ["overflowing"],
        });
        box.addEventListener("overflow", onOverflow, true);
        // Only reset when actually scrolled away from start
        const onScroll = () => {
          try {
            if ((box.scrollPosition | 0) > 0) {
              scrub();
            }
          } catch (_e) {
            scrub();
          }
        };
        box.addEventListener("scroll", onScroll, true);
        try {
          const clip = box.shadowRoot?.querySelector?.("scrollbox");
          clip?.addEventListener?.(
            "scroll",
            () => {
              if ((clip.scrollLeft | 0) > 0) {
                scrub();
              }
            },
            true
          );
        } catch (_e) {
          /* ignore */
        }
      }
    }

    let resizeTimer = null;
    win.addEventListener(
      "resize",
      () => {
        if (resizeTimer) {
          win.clearTimeout(resizeTimer);
        }
        resizeTimer = win.setTimeout(() => {
          resizeTimer = null;
          win.__bromineTabMaxW = 0;
          const el = win.document.getElementById("tabbrowser-tabs");
          if (el) {
            delete el.dataset.bromineKey;
          }
          this._placeNewTabButton(win, { remeasure: true });
        }, 100);
      },
      { passive: true }
    );
  },

  _hugTabStrip(win, _fast = false) {
    this._placeNewTabButton(win);
  },

  _makeButton(doc, { id, label, icon, onCommand }) {
    const btn = doc.createXULElement("toolbarbutton");
    btn.id = id;
    btn.className = "toolbarbutton-1 chromeclass-toolbar-additional";
    btn.setAttribute("tooltiptext", label);
    btn.setAttribute("aria-label", label);
    btn.setAttribute("removable", "false");
    btn.setAttribute("image", icon);
    btn.style.listStyleImage = `url("${icon}")`;
    btn.addEventListener("command", onCommand);
    btn.addEventListener("click", e => {
      e.preventDefault();
      onCommand(e);
    });
    return btn;
  },

  _hookAll() {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      this._hookWindow(win);
    }
  },

  _hookWindow(win) {
    if (!win || win.closed || this._wired.has(win)) {
      return;
    }
    this._wired.add(win);
    this._layoutStrip(win);
    let timer = null;
    const root = win.document.documentElement;
    const mode = chromeStripMode();
    root.setAttribute("bromine-chrome-strip", mode);
    root.setAttribute(
      "bromine-unified-chrome",
      mode === "unified" ? "true" : "false"
    );
    const onResize = () => {
      root.setAttribute("bromine-resizing", "true");
      if (timer) {
        win.clearTimeout(timer);
      }
      timer = win.setTimeout(() => {
        root.removeAttribute("bromine-resizing");
        timer = null;
      }, 140);
    };
    win.addEventListener("resize", onResize, { passive: true });
  },
};

BromineWindow.init();
