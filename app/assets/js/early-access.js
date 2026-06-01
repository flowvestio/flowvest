(function () {
  const EARLY_ACCESS_ENABLED = false; // 改为 false 即关闭邀请码限制，全员开放

  const STORAGE_KEY = "fv_early_access";

  const INVITE_CODES = [
    "FLOW2027", "VEST1001", "VEST1002", "VEST1003", "VEST1004"
  ];

  function checkAccess() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "granted";
    } catch (_) {
      return false;
    }
  }

  function validateCode(input) {
    const code = (input || "").trim().toUpperCase();
    if (INVITE_CODES.includes(code)) {
      try { localStorage.setItem(STORAGE_KEY, "granted"); } catch (_) {}
      return true;
    }
    return false;
  }

  function showCreator() {
    const gate = document.getElementById("earlyAccessGate");
    const panel = document.getElementById("creatorPanel");
    if (gate) gate.style.display = "none";
    if (panel) panel.style.display = "";
  }

  function initEarlyAccess() {
    if (!EARLY_ACCESS_ENABLED || checkAccess()) {
      showCreator();
      return;
    }

    const gate = document.getElementById("earlyAccessGate");
    const panel = document.getElementById("creatorPanel");
    if (gate) gate.style.display = "";
    if (panel) panel.style.display = "none";

    const btn = document.getElementById("earlyAccessBtn");
    const input = document.getElementById("earlyAccessInput");
    const errEl = document.getElementById("earlyAccessError");

    function submit() {
      const val = input ? input.value : "";
      if (validateCode(val)) {
        showCreator();
        if (window.I18N) I18N.applyAll();
      } else {
        if (errEl) {
          errEl.textContent = window.I18N ? I18N.t("early.invalid") : "Invalid invite code, please try again";
          errEl.style.display = "";
        }
        if (input) input.focus();
      }
    }

    if (btn) btn.addEventListener("click", submit);
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") submit();
      });
    }
  }

  window.EARLY_ACCESS = { initEarlyAccess, checkAccess };
})();
