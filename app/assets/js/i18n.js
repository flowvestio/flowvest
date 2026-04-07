/**
 * Minimal i18n: zh / en. Dictionaries in assets/i18n/{locale}.json
 * Usage: I18N.t("wallet.connect") or I18N.t("meta.line1", { chain, total, period })
 */
(function () {
  const STORAGE_KEY = "fv_locale";
  const SUPPORTED = ["zh", "en"];

  let dict = {};
  let locale = "en";
  let localeButtonsBound = false;

  function getByPath(obj, path) {
    const parts = String(path || "").split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function guessLocale() {
    try {
      const nav = (navigator.language || "en").toLowerCase();
      if (nav.startsWith("zh")) return "zh";
    } catch (_) {}
    return "en";
  }

  function getStoredLocale() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function getLocale() {
    return locale;
  }

  async function setLocale(next, opts = {}) {
    const L = String(next || "").toLowerCase();
    if (!SUPPORTED.includes(L)) return;
    locale = L;
    try {
      localStorage.setItem(STORAGE_KEY, L);
    } catch (_) {}

    document.documentElement.setAttribute("lang", L === "zh" ? "zh-CN" : "en");

    const res = await fetch(`assets/i18n/${L}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`i18n load failed: ${L}`);
    dict = await res.json();

    applyDom();
    refreshLangButtons();
    refreshThemeButton();
    updateDisconnectedWalletLabel();

    if (!opts.skipAppRefresh && window.APP && typeof window.APP.onLocaleChanged === "function") {
      await window.APP.onLocaleChanged();
    }

    if (!opts.silent) {
      document.dispatchEvent(new CustomEvent("fv-locale-changed", { detail: { locale: L } }));
    }
  }

  function t(key, params) {
    let v = getByPath(dict, key);
    if (typeof v !== "string") return String(key);
    if (params && typeof params === "object") {
      v = v.replace(/\{(\w+)\}/g, (_, name) =>
        params[name] != null ? String(params[name]) : `{${name}}`
      );
    }
    return v;
  }

  function applyDom() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key || !("placeholder" in el)) return;
      el.placeholder = t(key);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (!key) return;
      el.setAttribute("aria-label", t(key));
    });
  }

  function refreshLangButtons() {
    const tBtn = document.getElementById("btnLocaleToggle");
    if (!tBtn) return;
    // Show the *other* language as the action.
    tBtn.textContent = locale === "en" ? "中" : "EN";
    tBtn.setAttribute("aria-pressed", "false");
  }

  function refreshThemeButton() {
    const btn = document.getElementById("btnTheme");
    if (!btn) return;
    const dark = document.documentElement.classList.contains("dark");
    const aria = t("theme.aria");
    btn.setAttribute("aria-label", aria);

    const sun = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v2"></path>
        <path d="M12 20v2"></path>
        <path d="M4.93 4.93l1.41 1.41"></path>
        <path d="M17.66 17.66l1.41 1.41"></path>
        <path d="M2 12h2"></path>
        <path d="M20 12h2"></path>
        <path d="M4.93 19.07l1.41-1.41"></path>
        <path d="M17.66 6.34l1.41-1.41"></path>
      </svg>
    `;

    const moon = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.8A8.5 8.5 0 0 1 11.2 3a6.5 6.5 0 1 0 9.8 9.8z"></path>
      </svg>
    `;

    // Button shows the action: when dark, show sun (switch to light); when light, show moon (switch to dark).
    btn.innerHTML = `<span class="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true">${dark ? sun : moon}</span>`;
  }

  function updateDisconnectedWalletLabel() {
    const wBtn = document.getElementById("btnWallet");
    if (wBtn && !window.STATE?.account) {
      wBtn.textContent = t("wallet.connect");
    }
  }

  function bindLocaleButtons() {
    if (localeButtonsBound) return;
    localeButtonsBound = true;
    document.getElementById("btnLocaleToggle")?.addEventListener("click", () => {
      void setLocale(locale === "zh" ? "en" : "zh");
    });
  }

  async function init() {
    const stored = getStoredLocale();
    const initial = SUPPORTED.includes(stored) ? stored : guessLocale();
    await setLocale(initial, { silent: true, skipAppRefresh: true });
    bindLocaleButtons();
  }

  window.I18N = {
    init,
    t,
    getLocale,
    setLocale,
    applyDom,
    refreshThemeButton,
    updateDisconnectedWalletLabel,
    SUPPORTED
  };
})();
