/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Programmable + draggable chrome layout (Shift-style zones).
 *
 * Prefs:
 *   bromine.layout.bars   JSON map of bar → edge
 *     bars: tabs | nav | bookmarks | rail
 *     edges: top | bottom | left | right | hidden
 *   bromine.layout.editMode   bool — show grips + drop zones
 *
 * Example (about:config → bromine.layout.bars):
 *   {"tabs":"top","nav":"top","bookmarks":"hidden","rail":"left"}
 *
 * Drag: enable Edit layout, then drag a bar grip onto a highlighted edge.
 * Shortcut: Ctrl+Shift+E toggles edit mode.
 */

const EDGES = new Set(["top", "bottom", "left", "right", "hidden"]);
const BARS = ["tabs", "nav", "bookmarks", "rail"];

const DEFAULT_LAYOUT = {
  tabs: "top",
  nav: "top",
  bookmarks: "hidden",
  rail: "hidden",
};

const PREFS = ["bromine.layout.bars", "bromine.layout.editMode"];

function prefBool(name, fallback) {
  try {
    return Services.prefs.getBoolPref(name, fallback);
  } catch (_e) {
    return fallback;
  }
}

function readLayout() {
  let raw = "";
  try {
    raw = Services.prefs.getStringPref("bromine.layout.bars", "");
  } catch (_e) {
    /* ignore */
  }
  let parsed = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (_e) {
      parsed = {};
    }
  }
  const out = { ...DEFAULT_LAYOUT };
  for (const bar of BARS) {
    const v = parsed[bar];
    if (typeof v === "string" && EDGES.has(v)) {
      out[bar] = v;
    }
  }
  // Keep rail prefs in sync if layout omits rail but rail.position is set
  try {
    if (!parsed.rail) {
      const enabled = Services.prefs.getBoolPref("bromine.rail.enabled", true);
      const pos = Services.prefs.getStringPref("bromine.rail.position", "left");
      out.rail = enabled ? (pos === "right" ? "right" : "left") : "hidden";
    }
  } catch (_e) {
    /* ignore */
  }
  return out;
}

function writeLayout(layout) {
  const clean = {};
  for (const bar of BARS) {
    clean[bar] = EDGES.has(layout[bar]) ? layout[bar] : DEFAULT_LAYOUT[bar];
  }
  Services.prefs.setStringPref("bromine.layout.bars", JSON.stringify(clean));
}

function setBarEdge(bar, edge) {
  if (!BARS.includes(bar) || !EDGES.has(edge)) {
    return;
  }
  const layout = readLayout();
  layout[bar] = edge;
  writeLayout(layout);
}

export var BromineLayout = {
  _obs: null,
  _origins: new WeakMap(),
  _drag: null,
  _applying: false,

  init() {
    this.applyAll();
    this._obs = {
      observe: (_s, topic, data) => {
        if (this._applying) {
          return;
        }
        if (topic === "nsPref:changed") {
          // Ignore rail/verticalTabs echoes we write during apply
          if (
            data === "bromine.rail.enabled" ||
            data === "bromine.rail.position" ||
            data === "bromine.verticalTabs" ||
            data === "sidebar.verticalTabs" ||
            data === "sidebar.revamp" ||
            data === "browser.toolbars.bookmarks.visibility"
          ) {
            return;
          }
          this.applyAll();
        } else if (
          topic === "browser-delayed-startup-finished" ||
          topic === "domwindowopened"
        ) {
          this.applyAll();
        }
      },
    };
    for (const p of PREFS) {
      Services.prefs.addObserver(p, this._obs);
    }
    Services.obs.addObserver(this._obs, "browser-delayed-startup-finished");
    Services.obs.addObserver(this._obs, "domwindowopened");
  },

  /** Public API for scripts / about:config helpers */
  getLayout() {
    return readLayout();
  },
  setLayout( partial) {
    const layout = { ...readLayout(), ...partial };
    writeLayout(layout);
  },
  setBar(bar, edge) {
    setBarEdge(bar, edge);
  },
  setEditMode(on) {
    Services.prefs.setBoolPref("bromine.layout.editMode", !!on);
  },
  toggleEditMode() {
    this.setEditMode(!prefBool("bromine.layout.editMode", false));
  },

  applyAll() {
    if (this._applying) {
      return;
    }
    this._applying = true;
    try {
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        this.applyWindow(win);
      }
    } finally {
      this._applying = false;
    }
  },

  applyWindow(win) {
    try {
      if (!win || win.closed || !win.document?.documentElement) {
        return;
      }
      const doc = win.document;
      const root = doc.documentElement;
      const layout = readLayout();
      const edit = prefBool("bromine.layout.editMode", false);

      root.setAttribute("bromine-tabs-edge", layout.tabs);
      root.setAttribute("bromine-nav-edge", layout.nav);
      root.setAttribute("bromine-bookmarks-edge", layout.bookmarks);
      root.setAttribute("bromine-rail-edge", layout.rail);
      root.setAttribute("bromine-layout-edit", edit ? "true" : "false");

      this._syncDependentPrefs(layout);
      this._placeBars(win, layout);
      this._ensureZones(win, edit);
      this._ensureGrips(win, edit);
      this._ensureShortcut(win);
    } catch (e) {
      console.error("BromineLayout.applyWindow", e);
    }
  },

  _syncDependentPrefs(layout) {
    try {
      const railHidden = layout.rail === "hidden";
      Services.prefs.setBoolPref("bromine.rail.enabled", !railHidden);
      if (!railHidden && (layout.rail === "left" || layout.rail === "right")) {
        Services.prefs.setStringPref("bromine.rail.position", layout.rail);
      }
      const sideTabs = layout.tabs === "left" || layout.tabs === "right";
      Services.prefs.setBoolPref("bromine.verticalTabs", sideTabs);
      if (sideTabs) {
        Services.prefs.setBoolPref("sidebar.revamp", true);
        Services.prefs.setBoolPref("sidebar.verticalTabs", true);
      } else {
        Services.prefs.setBoolPref("sidebar.verticalTabs", false);
      }
      // Bookmarks bar visibility
      if (layout.bookmarks === "hidden") {
        Services.prefs.setStringPref(
          "browser.toolbars.bookmarks.visibility",
          "never"
        );
      } else {
        Services.prefs.setStringPref(
          "browser.toolbars.bookmarks.visibility",
          "always"
        );
      }
    } catch (_e) {
      /* ignore */
    }
  },

  _rememberOrigin(win, id, el) {
    if (!el) {
      return;
    }
    let map = this._origins.get(win);
    if (!map) {
      map = new Map();
      this._origins.set(win, map);
    }
    if (!map.has(id)) {
      map.set(id, {
        parent: el.parentNode,
        next: el.nextSibling,
      });
    }
  },

  _restore(win, id, el) {
    const map = this._origins.get(win);
    const origin = map?.get(id);
    if (!el || !origin?.parent) {
      return;
    }
    try {
      if (origin.next && origin.next.parentNode === origin.parent) {
        origin.parent.insertBefore(el, origin.next);
      } else {
        origin.parent.appendChild(el);
      }
    } catch (_e) {
      /* ignore */
    }
  },

  _placeBars(win, layout) {
    const doc = win.document;
    const toolbox = doc.getElementById("navigator-toolbox");
    const browser = doc.getElementById("browser");
    if (!toolbox || !browser) {
      return;
    }

    const tabs = doc.getElementById("TabsToolbar");
    const nav = doc.getElementById("nav-bar");
    const bookmarks = doc.getElementById("PersonalToolbar");
    const mainWin = doc.documentElement;

    this._rememberOrigin(win, "tabs", tabs);
    this._rememberOrigin(win, "nav", nav);
    this._rememberOrigin(win, "bookmarks", bookmarks);

    // Tabs
    if (tabs) {
      if (layout.tabs === "bottom") {
        // Below content area
        if (tabs.parentNode !== mainWin || tabs.previousSibling !== browser) {
          if (browser.nextSibling) {
            mainWin.insertBefore(tabs, browser.nextSibling);
          } else {
            mainWin.appendChild(tabs);
          }
        }
        tabs.setAttribute("bromine-dock", "bottom");
      } else if (layout.tabs === "left" || layout.tabs === "right") {
        // Vertical tabs UI handles this — keep strip restored but visually muted
        this._restore(win, "tabs", tabs);
        tabs.setAttribute("bromine-dock", layout.tabs);
      } else {
        this._restore(win, "tabs", tabs);
        tabs.setAttribute("bromine-dock", "top");
      }
    }

    // Nav
    if (nav) {
      if (layout.nav === "bottom") {
        if (layout.tabs === "bottom" && tabs?.parentNode === mainWin) {
          mainWin.insertBefore(nav, tabs.nextSibling);
        } else if (browser.nextSibling) {
          mainWin.insertBefore(nav, browser.nextSibling);
        } else {
          mainWin.appendChild(nav);
        }
        nav.setAttribute("bromine-dock", "bottom");
      } else if (layout.nav === "hidden") {
        nav.setAttribute("bromine-dock", "hidden");
        this._restore(win, "nav", nav);
      } else {
        this._restore(win, "nav", nav);
        nav.setAttribute("bromine-dock", "top");
      }
    }

    // Bookmarks
    if (bookmarks) {
      if (layout.bookmarks === "bottom") {
        const after =
          layout.nav === "bottom"
            ? nav
            : layout.tabs === "bottom"
              ? tabs
              : browser;
        if (after?.parentNode === mainWin) {
          mainWin.insertBefore(bookmarks, after.nextSibling);
        } else {
          mainWin.appendChild(bookmarks);
        }
        bookmarks.setAttribute("bromine-dock", "bottom");
      } else {
        this._restore(win, "bookmarks", bookmarks);
        bookmarks.setAttribute(
          "bromine-dock",
          layout.bookmarks === "hidden" ? "hidden" : "top"
        );
      }
    }

    // Rail position is handled by BromineRail via prefs we synced
  },

  _ensureZones(win, edit) {
    const doc = win.document;
    let overlay = doc.getElementById("bromine-layout-overlay");
    if (!edit) {
      overlay?.remove();
      return;
    }
    if (!overlay) {
      overlay = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
      overlay.id = "bromine-layout-overlay";
      overlay.className = "bromine-layout-overlay";
      for (const edge of ["top", "bottom", "left", "right", "hidden"]) {
        const z = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
        z.className = `bromine-layout-zone bromine-layout-zone-${edge}`;
        z.dataset.edge = edge;
        z.textContent =
          edge === "hidden" ? "Hide" : edge[0].toUpperCase() + edge.slice(1);
        z.addEventListener("dragover", event => {
          event.preventDefault();
          z.classList.add("bromine-layout-zone-hot");
        });
        z.addEventListener("dragleave", () => {
          z.classList.remove("bromine-layout-zone-hot");
        });
        z.addEventListener("drop", event => {
          event.preventDefault();
          z.classList.remove("bromine-layout-zone-hot");
          const bar =
            event.dataTransfer.getData("text/bromine-bar") ||
            this._drag?.bar;
          if (bar) {
            setBarEdge(bar, edge);
          }
          this._drag = null;
        });
        overlay.appendChild(z);
      }
      const hint = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
      hint.className = "bromine-layout-hint";
      hint.textContent =
        "Layout edit — drag bar grips to an edge · Ctrl+Shift+E to finish";
      overlay.appendChild(hint);
      doc.documentElement.appendChild(overlay);
    }
  },

  _ensureGrips(win, edit) {
    const doc = win.document;
    const targets = [
      ["tabs", doc.getElementById("TabsToolbar")],
      ["nav", doc.getElementById("nav-bar")],
      ["bookmarks", doc.getElementById("PersonalToolbar")],
      ["rail", doc.getElementById("bromine-rail")],
    ];

    for (const [bar, el] of targets) {
      if (!el) {
        continue;
      }
      let grip = el.querySelector?.(".bromine-layout-grip");
      // XUL toolbars: querySelector works on anonymous? usually yes for children we add
      if (!edit) {
        grip?.remove();
        el.removeAttribute("bromine-draggable");
        continue;
      }
      el.setAttribute("bromine-draggable", "true");
      if (!grip) {
        grip = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
        grip.className = "bromine-layout-grip";
        grip.title = `Drag to move ${bar}`;
        grip.draggable = true;
        grip.dataset.bar = bar;
        grip.textContent = "⠿";
        grip.addEventListener("dragstart", event => {
          this._drag = { bar };
          event.dataTransfer.setData("text/bromine-bar", bar);
          event.dataTransfer.effectAllowed = "move";
          el.classList.add("bromine-layout-dragging");
          doc.documentElement.classList.add("bromine-layout-dragging-root");
        });
        grip.addEventListener("dragend", () => {
          el.classList.remove("bromine-layout-dragging");
          doc.documentElement.classList.remove("bromine-layout-dragging-root");
          this._drag = null;
        });
        // Prefer prepend so grip is visible on the leading edge
        if (el.firstChild) {
          el.insertBefore(grip, el.firstChild);
        } else {
          el.appendChild(grip);
        }
      }
    }
  },

  _ensureShortcut(win) {
    if (win.__bromineLayoutKeys) {
      return;
    }
    win.__bromineLayoutKeys = true;
    win.addEventListener(
      "keydown",
      event => {
        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "e") {
          event.preventDefault();
          BromineLayout.toggleEditMode();
        }
      },
      true
    );
  },
};

BromineLayout.init();
