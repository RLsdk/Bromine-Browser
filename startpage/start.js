(() => {
  const clock = document.getElementById("clock");
  const dateEl = document.getElementById("date");
  const form = document.getElementById("search");
  const q = document.getElementById("q");
  const clear = document.getElementById("clear");
  const extra = document.getElementById("engine-extra");
  const engineBtn = document.getElementById("engine-btn");
  const engineIcon = document.getElementById("engine-icon");
  const engineMenu = document.getElementById("engine-menu");
  const root = document.documentElement;
  const metaScheme = document.querySelector('meta[name="color-scheme"]');

  const ICONS = {
    ddg: "icons/duckduckgo.png",
    "ddg-html": "icons/duckduckgo-html.png",
    brave: "icons/brave.png",
    searx: null, // inline fallback below
  };

  const SEARX_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#3050C0"/><circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M18.8 18.8 24 24" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`;

  const ENGINES = {
    ddg: {
      action: "https://duckduckgo.com/",
      extraName: "kae",
      extraValue: "d",
      label: "DuckDuckGo",
    },
    "ddg-html": {
      action: "https://html.duckduckgo.com/html/",
      extraName: "kae",
      extraValue: "d",
      label: "DuckDuckGo HTML",
    },
    brave: {
      action: "https://search.brave.com/search",
      extraName: null,
      label: "Brave",
    },
    searx: {
      action: "https://searx.be/search",
      extraName: "categories",
      extraValue: "general",
      label: "SearXNG",
    },
  };

  const ENGINE_KEY = "bromine.startpage.engine";
  const LWT = {
    bromine: "bromine@bromine",
    midnight: "bromine-midnight@bromine",
  };
  const LIGHT_LWT = new Set([
    "firefox-compact-light@mozilla.org",
    "firefox-alpenglow@mozilla.org",
  ]);
  const DARK_LWT = new Set(["firefox-compact-dark@mozilla.org"]);
  const BACKGROUNDS = {
    bromine: "#161210",
    midnight: "#0a0908",
    dark: "#1c1b22",
    light: "#f9f9fb",
  };

  const pad = n => String(n).padStart(2, "0");

  function services() {
    try {
      if (typeof Services !== "undefined") {
        return Services;
      }
    } catch (_e) {
      /* ignore */
    }
    try {
      return ChromeUtils.importESModule(
        "resource://gre/modules/Services.sys.mjs"
      ).Services;
    } catch (_e2) {
      return null;
    }
  }

  function tick() {
    const now = new Date();
    clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;
    clock.dateTime = now.toISOString();
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  function iconHtml(id) {
    const src = ICONS[id];
    if (src) {
      return `<img src="${src}" alt="" width="20" height="20" draggable="false" />`;
    }
    return SEARX_SVG;
  }

  function setMenuOpen(open) {
    engineMenu.hidden = !open;
    engineBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function readEngine() {
    const svc = services();
    if (svc) {
      try {
        const fromPref = svc.prefs.getStringPref(ENGINE_KEY, "");
        if (ENGINES[fromPref]) {
          return fromPref;
        }
      } catch (_e) {
        /* ignore */
      }
    }
    try {
      const local = localStorage.getItem(ENGINE_KEY);
      if (ENGINES[local]) {
        return local;
      }
    } catch (_e2) {
      /* ignore */
    }
    return "ddg";
  }

  function saveEngine(key) {
    try {
      localStorage.setItem(ENGINE_KEY, key);
    } catch (_e) {
      /* ignore */
    }
    const svc = services();
    if (!svc) {
      return;
    }
    try {
      svc.prefs.setStringPref(ENGINE_KEY, key);
    } catch (_e2) {
      /* ignore */
    }
  }

  function applyEngine(id) {
    const key = ENGINES[id] ? id : "ddg";
    const cfg = ENGINES[key];
    form.action = cfg.action;
    if (cfg.extraName) {
      extra.name = cfg.extraName;
      extra.value = cfg.extraValue;
      extra.disabled = false;
    } else {
      extra.disabled = true;
    }
    engineIcon.innerHTML = iconHtml(key);
    engineBtn.title = cfg.label;
    engineBtn.setAttribute("aria-label", `Search engine: ${cfg.label}`);
    for (const opt of engineMenu.querySelectorAll("[data-engine]")) {
      const selected = opt.dataset.engine === key;
      opt.setAttribute("aria-selected", selected ? "true" : "false");
      opt.innerHTML = iconHtml(opt.dataset.engine);
    }
    saveEngine(key);
    setMenuOpen(false);
  }

  function paintTheme(theme) {
    const id = BACKGROUNDS[theme] ? theme : "bromine";
    const bg = BACKGROUNDS[id];
    const scheme = id === "light" ? "light" : "dark";
    root.dataset.theme = id;
    root.style.background = bg;
    root.style.colorScheme = scheme;
    document.body.style.background = bg;
    document.body.style.colorScheme = scheme;
    if (metaScheme) {
      metaScheme.setAttribute("content", scheme);
    }
  }

  function systemIsDark(svc) {
    try {
      const override = svc.prefs.getIntPref("browser.theme.toolbar-theme", -1);
      if (override === 1) {
        return false;
      }
      if (override === 2) {
        return true;
      }
    } catch (_e) {
      /* ignore */
    }
    try {
      return !!svc.prefs.getBoolPref("browser.theme.dark-theme", true);
    } catch (_e2) {
      return true;
    }
  }

  function readTheme() {
    const svc = services();
    if (!svc) {
      return "bromine";
    }
    let lwt = "";
    try {
      lwt = svc.prefs.getStringPref("extensions.activeThemeID", "");
    } catch (_e) {
      /* ignore */
    }
    if (lwt === LWT.midnight) {
      return "midnight";
    }
    if (lwt === LWT.bromine) {
      return "bromine";
    }
    if (LIGHT_LWT.has(lwt)) {
      return "light";
    }
    if (DARK_LWT.has(lwt)) {
      return "dark";
    }
    return systemIsDark(svc) ? "dark" : "light";
  }

  function syncClear() {
    const on = !!q.value;
    clear.classList.toggle("is-visible", on);
    clear.setAttribute("aria-hidden", on ? "false" : "true");
    clear.tabIndex = on ? 0 : -1;
  }

  function syncExpanded() {
    form.classList.toggle(
      "is-expanded",
      document.activeElement === q ||
        document.activeElement === clear ||
        document.activeElement === engineBtn ||
        !!q.value ||
        !engineMenu.hidden
    );
  }

  clear.addEventListener("click", () => {
    q.value = "";
    syncClear();
    syncExpanded();
    q.focus();
  });

  q.addEventListener("input", () => {
    syncClear();
    syncExpanded();
  });

  engineBtn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(engineMenu.hidden);
    syncExpanded();
  });

  engineMenu.addEventListener("click", e => {
    const opt = e.target.closest("[data-engine]");
    if (!opt) {
      return;
    }
    e.preventDefault();
    applyEngine(opt.dataset.engine);
    syncExpanded();
    q.focus();
  });

  document.addEventListener("click", e => {
    if (!engineMenu.hidden && !e.target.closest("#engine-picker")) {
      setMenuOpen(false);
      syncExpanded();
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !engineMenu.hidden) {
      setMenuOpen(false);
      engineBtn.focus();
      syncExpanded();
    }
  });

  let savedEngine = readEngine();
  applyEngine(savedEngine);
  paintTheme(readTheme());

  q.addEventListener("focus", syncExpanded);
  q.addEventListener("blur", () => setTimeout(syncExpanded, 0));
  clear.addEventListener("focus", syncExpanded);
  clear.addEventListener("blur", () => setTimeout(syncExpanded, 0));
  engineBtn.addEventListener("focus", syncExpanded);
  form.addEventListener("focusin", syncExpanded);
  form.addEventListener("focusout", () => setTimeout(syncExpanded, 0));

  const svc = services();
  if (svc) {
    const obs = {
      observe() {
        paintTheme(readTheme());
      },
    };
    try {
      svc.prefs.addObserver("extensions.activeThemeID", obs);
      window.addEventListener(
        "unload",
        () => {
          try {
            svc.prefs.removeObserver("extensions.activeThemeID", obs);
          } catch (_e) {
            /* ignore */
          }
        },
        { once: true }
      );
    } catch (_e2) {
      /* ignore */
    }
  }

  tick();
  setInterval(tick, 1000);
  syncClear();
})();
