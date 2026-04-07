(function () {
  const $ = (id) => document.getElementById(id);

  function T(key, params) {
    return window.I18N ? I18N.t(key, params) : key;
  }

  function escapeHtml(input) {
    const s = String(input ?? "");
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

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

  function showStatus(msg, type = "info", opts = {}) {
    const el = $("status");
    if (!el) return;
    const allowHtml = !!opts.html;
    if (allowHtml) {
      el.innerHTML = String(msg ?? "");
    } else {
      el.textContent = String(msg ?? "");
    }
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
      btn.textContent = T("wallet.connect");
      return;
    }

    btn.textContent = UTILS.shortAddr(STATE.account);
    btn.dataset.addr = String(STATE.account);
  }

function syncClaimButton(claimable) {
  const claimBtn = document.getElementById("btnClaim");
  if (!claimBtn) return;
  claimBtn.disabled = !(Number(claimable) > 0);
}

function setClaimedState() {
  const claimableEl = $("kpiDue");
  const hintEl = $("kpiDueHint");
  const claimBtn = $("btnClaim");
  if (claimableEl) claimableEl.textContent = "0.0";
  if (hintEl) {
    hintEl.textContent = "";
    hintEl.style.display = "none";
  }
  if (claimBtn) {
    claimBtn.disabled = true;
    claimBtn.textContent = T("claim.claimedSyncing");
  }
  // Hide structured details during post-claim sync
  const claimDetails = $('kpiClaimDetails');
  if (claimDetails) claimDetails.style.display = 'none';
  const claimMsg = $('kpiClaimMsg');
  if (claimMsg) claimMsg.style.display = 'none';
  const claimExplorer = $('kpiClaimExplorer');
  if (claimExplorer) claimExplorer.style.display = 'none';
}

function updateClaimableUI(summary) {
  const claimableEl = document.getElementById("kpiDue");
  const hintEl = document.getElementById("kpiDueHint");

  if (!claimableEl) return false;

  const rawClaimable = Number(summary?.beneficiary?.claimable || 0);
  const rawVestCount = Number(summary?.beneficiary?.claimable_vests || 0);
  const S = window.STATE;

  if (S && S.postClaimStaleGuardUntil && Date.now() >= S.postClaimStaleGuardUntil) {
    S.postClaimStaleGuardUntil = 0;
  }

  let guardActive = S && S.postClaimStaleGuardUntil && Date.now() < S.postClaimStaleGuardUntil;
  if (guardActive && (rawClaimable <= 0 || rawVestCount <= 0)) {
    S.postClaimStaleGuardUntil = 0;
    guardActive = false;
  }

  const guardStill = S && S.postClaimStaleGuardUntil && Date.now() < S.postClaimStaleGuardUntil;
  const scanLooksStaleAfterClaim =
    !!(guardStill && rawClaimable > 0 && rawVestCount > 0);

  const claimable = scanLooksStaleAfterClaim ? 0 : rawClaimable;
  const vestCount = scanLooksStaleAfterClaim ? 0 : rawVestCount;

  const btnClaim = document.getElementById("btnClaim");
  if (btnClaim) {
    btnClaim.disabled = claimable <= 0 || vestCount <= 0;
    if (scanLooksStaleAfterClaim) {
      btnClaim.textContent = T("claim.claimedSyncing");
    } else if (claimable <= 0) {
      btnClaim.textContent = T("claim.noFunds");
    } else {
      btnClaim.textContent = T("claim.withAmount", { amount: claimable.toFixed(1) });
    }
  }

  claimableEl.textContent = claimable > 0 ? claimable.toFixed(1) : "0.0";

  const nextHintEl = document.getElementById("claimNextHint");
  if (nextHintEl) {
    const nextTs = summary?.beneficiary?.next_payment_at;
    if (claimable <= 0 && nextTs) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const d = new Date(nextTs * 1000);
      const dateStr = `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
      nextHintEl.textContent = T("claim.nextAvailable", { date: dateStr });
      nextHintEl.classList.remove("hidden");
    } else {
      nextHintEl.textContent = "";
      nextHintEl.classList.add("hidden");
    }
  }

  if (hintEl) {
    if (scanLooksStaleAfterClaim) {
      hintEl.textContent = "";
      hintEl.style.display = "none";
    } else if (claimable > 0 && vestCount > 0) {
      // Don't show "from 1 vest / from N vests": scan summary can be delayed and would make the UI feel inconsistent.
      hintEl.textContent = T("claim.fromEligibleVests");
      hintEl.style.display = "block";
    } else {
      hintEl.textContent = "";
      hintEl.style.display = "none";
    }
  }

  syncClaimButton(claimable);

  return scanLooksStaleAfterClaim;
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
    showInfo(T("status.disconnected"));
    const btnClaim = $("btnClaim");
    if (btnClaim) {
      btnClaim.disabled = true;
      btnClaim.textContent = T("claim.action");
    }
    const claimDetailsEl = $('kpiClaimDetails');
    if (claimDetailsEl) claimDetailsEl.style.display = 'none';
    const claimStatusEl = $('kpiClaimStatus');
    if (claimStatusEl) claimStatusEl.style.display = 'none';
    const claimExplorerEl = $('kpiClaimExplorer');
    if (claimExplorerEl) claimExplorerEl.style.display = 'none';
    const claimMsgEl = $('kpiClaimMsg');
    if (claimMsgEl) {
      claimMsgEl.textContent = T('kpi.claimStatusConnect');
      claimMsgEl.style.display = 'block';
    }
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
    stats.tvl == null ? "—" : Number(UTILS.formatAmount(stats.tvl, C.DECIMALS_USDC)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );

  setText(
    "kpiVestCount",
    stats.vestCount == null ? "—" : String(stats.vestCount)
  );

  setText(
    "kpiUsage",
    stats.usage == null ? "—" : `${stats.usage.toFixed(2)}%`
  );

  if (stats.balance != null) {
    setText(
      "kpiBalance",
      Number(UTILS.formatAmount(stats.balance, C.DECIMALS_USDC)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  }

}

  function openWalletMenu() {
    const menu = $("walletMenu");
    if (!menu) return;
    menu.classList.remove("hidden");
  }

  function safeError(err) {
  // Use UTILS.safeError to extract a clean message (filters "null"/"undefined"/etc.)
  const raw = window.UTILS ? UTILS.safeError(err) : String(err?.message || err || "");
  const msg = raw === "Unknown error" ? "" : raw;

  if (msg.toLowerCase().includes("user reject") || msg.toLowerCase().includes("user denied")) {
    return T("ui.userRejected");
  }

  if (msg.toLowerCase().includes("transaction failed") || msg.toLowerCase().includes("transaction was not created")) {
    return T("ui.txFailed");
  }

  if (msg.includes("NOT_OWNER")) {
    return T("ui.onlyOwnerTerminate");
  }

  if (msg.includes("LESS_THAN_MIN_PERIODS")) {
    return T("ui.terminateAfterM2");
  }

  if (msg.includes("TERMINATE_WINDOW_CLOSED")) {
    return T("ui.terminateWindowClosed");
  }

  if (msg.includes("TERMINATED")) {
    return T("ui.alreadyTerminated");
  }

  if (msg.includes("TVL_CAP_REACHED")) {
    return T("ui.tvlCapReached");
  }

  if (msg.includes("PRINCIPAL_TOO_SMALL")) {
    return T("ui.principalTooSmall");
  }

  if (msg.includes("PRINCIPAL_TOO_HIGH")) {
    return T("ui.principalTooHigh");
  }

  if (msg.includes("NOTHING_DUE")) {
    return T("ui.nothingDue");
  }

  if (msg.includes("UNPREDICTABLE_GAS_LIMIT")) {
    return T("ui.unpredictableGas");
  }

  if (msg.includes("Internal JSON-RPC error")) {
    return T("ui.rpcError");
  }

  return msg || T("ui.txFailed");
}

  function explainDisabledReasons() {
    const reasons = [];

    if (!STATE.account) {
      reasons.push(T("ui.connectToContinue"));
    } else if (Number(STATE.chainId) !== Number(C.CHAIN_ID)) {
      reasons.push(T("ui.switchNetwork", { chain: C.CHAIN_NAME }));
    }

    const ownerMonthly = $("ownerMonthly");
    if (ownerMonthly && ownerMonthly.value && STATE.account) {
      const v = Number(ownerMonthly.value.trim());
      const total = v * 3;
      if (!Number.isFinite(v) || v <= 0) {
        reasons.push(T("ui.enterMonthly"));
      } else if (total < 200 || total > 10000) {
        reasons.push(T("ui.vestRange"));
      }
    }

    if (reasons.length) {
      showInfo(reasons.join(" "));
    }
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

  function updateClaimCard({ activePlans, nextPaymentAt, claimable }) {
    const details = document.getElementById('kpiClaimDetails');
    const msg = document.getElementById('kpiClaimMsg');

    if (!details) return;

    const activePlansEl = document.getElementById('kpiActivePlans');
    const nextPaymentEl = document.getElementById('kpiNextPayment');
    const availableEl = document.getElementById('kpiAvailableDetail');

    if (activePlansEl) {
      activePlansEl.textContent = activePlans != null ? String(activePlans) : '0';
    }

    if (nextPaymentEl) {
      if (!nextPaymentAt) {
        nextPaymentEl.textContent = '—';
      } else {
        const d = new Date(nextPaymentAt * 1000);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        nextPaymentEl.textContent = `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
      }
    }

    if (availableEl) {
      availableEl.textContent = `${Number(claimable || 0).toFixed(1)} USDC`;
    }

    details.style.display = 'block';
    if (msg) msg.style.display = 'none';
    const explorerEl = document.getElementById('kpiClaimExplorer');
    if (explorerEl) explorerEl.style.display = 'none';
  }

  window.UI = {
    $,
    setText,
    escapeHtml,
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
    explainDisabledReasons,
    toggleWalletMenu,
    setClaimedState,
    updateClaimCard
  };
})();
