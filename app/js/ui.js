(function () {
  const $ = (id) => document.getElementById(id);

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function log(msg) {
  const el = $("logBox");
  if (!el) return;

  const time = new Date().toLocaleTimeString();

  el.textContent =
    `[${time}] ${msg}\n`;
}

  function showStatus(msg, type = "info") {
    const el = $("status");
    if (!el) return;
    el.innerHTML = msg;
    el.dataset.type = type;
  }

  function showError(msg) {
    console.error("[UI] Error:", msg);
    showStatus(msg, "error");
  }

  function showSuccess(msg) {
    showStatus(msg, "success");
  }

  function showInfo(msg) {
    showStatus(msg, "info");
  }

  function updateWalletBtn() {
    const btn = $("btnWallet");
    if (!btn) return;

    if (!STATE.account) {
      btn.textContent = "Connect Wallet";
      return;
    }

    btn.textContent = UTILS.shortAddr(STATE.account);
  }

function syncClaimButton(claimable) {
  const claimBtn = document.getElementById("btnClaim");
  if (!claimBtn) return;
  claimBtn.disabled = !(Number(claimable) > 0);
}

function updateClaimableUI(summary) {
  console.log("[UI] updateClaimableUI called", summary);
  const claimableEl = document.getElementById("kpiDue");
  const hintEl = document.getElementById("kpiDueHint");

  if (!claimableEl) return;

  const claimable = Number(summary?.beneficiary?.claimable || 0);
  const vestCount = Number(summary?.beneficiary?.claimable_vests || 0);
  const btnClaim = document.getElementById("btnClaim");
if (btnClaim) {
  btnClaim.disabled = claimable <= 0 || vestCount <= 0;
}

  claimableEl.textContent = claimable > 0 ? claimable.toFixed(1) : "—";

  if (hintEl) {
    if (claimable > 0 && vestCount > 0) {
      if (vestCount === 1) {
        hintEl.textContent = "from 1 vest";
      } else {
        hintEl.innerHTML = from ${vestCount} vests <span class="text-slate-500">schedules</span>;	      
      }
      hintEl.style.display = "block";
    } else {
      hintEl.textContent = "";
      hintEl.style.display = "none";
    }
  }

  syncClaimButton(claimable);
}

  function updateScanBtn() {
    const el = $("scanBtn");
    if (!el) return;

    if (!STATE.account) {
      el.href = "https://scan.flowvest.io";
      return;
    }

    el.href = `https://scan.flowvest.io/address.html?addr=${STATE.account}`;
  }

  function updateAccountInfo() {
    if (!STATE.account) {
      setText("walletLabel", "—");
      setText("networkLabel", "—");
      updateScanBtn();
      return;
    }

    setText("walletLabel", UTILS.shortAddr(STATE.account));

    setText("networkLabel", C.CHAIN_NAME);

    updateScanBtn();
  }


  function setConnected() {
    updateWalletBtn();
    updateAccountInfo();
  }

  function setDisconnected() {
    updateWalletBtn();
    updateAccountInfo();
    closeWalletMenu();
    showInfo("Disconnected");
    const btnClaim = $("btnClaim");
  if (btnClaim) btnClaim.disabled = true;
  }

  function setBusy(flag) {
    ["btnWallet", "btnDeposit", "btnWithdraw", "btnCreate"].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !!flag;
    });
  }

  // read tvl tocal-vest
  function updateStatsUI(stats) {

  if (!stats) return;

  setText(
    "kpiTVL",
    stats.tvl == null ? "—" : UTILS.formatAmount(stats.tvl, C.DECIMALS_USDC)
  );

  setText(
    "kpiVestCount",
    stats.vestCount == null ? "—" : String(stats.vestCount)
  );

  setText(
    "kpiUsage",
    stats.usage == null ? "—" : `${stats.usage.toFixed(2)}%`
  );

  setText(
    "kpiBalance",
    stats.balance == null ? "—" : UTILS.formatAmount(stats.balance, C.DECIMALS_USDC)
  );

}

  function openWalletMenu() {
    const menu = $("walletMenu");
    if (!menu) return;
    menu.classList.remove("hidden");
  }

  function safeError(err) {
  const msg = String(err?.reason || err?.message || err || "");

  if (msg.includes("NOT_OWNER")) {
    return "Only the vest owner can terminate";
  }

  if (msg.includes("LESS_THAN_MIN_PERIODS")) {
    return "Terminate is only available after Month 2";
  }

  if (msg.includes("TERMINATE_WINDOW_CLOSED")) {
    return "Terminate is no longer available after the final period";
  }

  if (msg.includes("TERMINATED")) {
    return "This vest has already been terminated";
  }

  if (msg.includes("TVL_CAP_REACHED")) {
    return "TVL cap reached";
  }

  if (msg.includes("PRINCIPAL_TOO_SMALL")) {
    return "Minimum vest is 200 USDC total";
  }

  if (msg.includes("PRINCIPAL_TOO_HIGH")) {
    return "Maximum vest is 10,000 USDC total";
  }

  if (msg.includes("UNPREDICTABLE_GAS_LIMIT")) {
    return "Transaction would fail. Please check vest status, timing, and wallet permissions.";
  }

  if (msg.includes("Internal JSON-RPC error")) {
    return "Transaction simulation failed. Please check the vest state and try again.";
  }

  return msg || "Transaction failed";
}

  function closeWalletMenu() {
    const menu = $("walletMenu");
    if (!menu) return;
    menu.classList.add("hidden");
  }

  function toggleWalletMenu() {
    const menu = $("walletMenu");
    if (!menu) return;

    if (menu.classList.contains("hidden")) {
      openWalletMenu();
    } else {
      closeWalletMenu();
    }
  }
document.addEventListener("click", async (e) => {

  if (!e.target.classList.contains("terminate-btn")) return;

  const id = e.target.dataset.id;

  try {

    await FLOW.terminateVest(id);

    await renderOwnerVestList();

  } catch (err) {

    UI.showError(err.message);

  }

});

  window.UI = {
    $,
    setText,
    showStatus,
    showError,
    showSuccess,
    showInfo,
    log,
    updateWalletBtn,
    updateScanBtn,
    updateAccountInfo,
    updateStatsUI,
    updateClaimableUI,
    setConnected,
    setDisconnected,
    setBusy,
    openWalletMenu,
    closeWalletMenu,
    safeError,
    toggleWalletMenu
  };
})();
