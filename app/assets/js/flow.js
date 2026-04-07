(function () {

  let cachedMyVestIds = null;
  let cachedVestCount = 0;
  let cachedScanFrom = null;
  let claimableComputeToken = 0;
  let _nextPaymentCache = { at: 0, value: null, vestIds: '' };

  function flowRead() {
    return STATE.readFlow || STATE.flow;
  }

  function usdcRead() {
    return STATE.readUsdc || STATE.usdc;
  }

  async function getMyVestIds(count, scanFromOverride = null) {
  const scanFrom = scanFromOverride == null ? Math.max(1, count - 24) : scanFromOverride;
  if (
    cachedMyVestIds !== null &&
    cachedVestCount === count &&
    cachedScanFrom === scanFrom
  ) {
    return cachedMyVestIds;
  }

const indices = Array.from({ length: count - scanFrom + 1 }, (_, i) => scanFrom + i);

  const found = [];
  const BATCH = 5;
  for (let b = 0; b < indices.length; b += BATCH) {
    const slice = indices.slice(b, b + BATCH);
    const results = await Promise.allSettled(slice.map(i => flowRead().vests(i)));
    results.forEach((r, j) => {
      if (r.status === "fulfilled" &&
          r.value.beneficiary &&
          r.value.beneficiary.toLowerCase() === STATE.account.toLowerCase()) {
        found.push(slice[j]);
      }
    });
    if (b + BATCH < indices.length) {
      await new Promise(res => setTimeout(res, 150));
    }
  }

  cachedMyVestIds = found;
  cachedVestCount = count;
  cachedScanFrom = scanFrom;

  return cachedMyVestIds;
  }

async function computeNextPaymentAt(vestIds) {
  const key = (vestIds || []).join(',');
  if (_nextPaymentCache.at && Date.now() - _nextPaymentCache.at < 60000 && _nextPaymentCache.vestIds === key) {
    return _nextPaymentCache.value;
  }
  if (!vestIds || !vestIds.length || !STATE.flow) {
    _nextPaymentCache = { at: Date.now(), value: null, vestIds: key };
    return null;
  }
  const period = Number(C.PERIOD || C.PERIOD_SECONDS || 2592000);
  const total = Number(C.TOTAL || 3);
  const now = Math.floor(Date.now() / 1000);
  let earliest = null;
  const vestResults = await Promise.allSettled(
    vestIds.slice(0, 3).map(id => flowRead().vests(id))
  );
  for (const result of vestResults) {
    if (result.status !== "fulfilled") continue;
    try {
      const startAt = Number(result.value.startAt || 0);
      if (!startAt) continue;
      for (let i = 1; i <= total; i++) {
        const releaseAt = startAt + period * i;
        if (releaseAt > now) {
          if (earliest === null || releaseAt < earliest) earliest = releaseAt;
          break;
        }
      }
    } catch (e) {
      console.warn('[FLOW] computeNextPaymentAt vest', e);
    }
  }
  _nextPaymentCache = { at: Date.now(), value: earliest, vestIds: key };
  return earliest;
}

function formatUtcDatetime(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

async function prepareClaimableIds({ vestsHint = 0 } = {}) {
  if (!STATE.account || !STATE.flow) {
    STATE.claimableVestIds = [];
    STATE.claimablePreparedAt = 0;
    STATE.claimablePreparing = false;
    STATE.claimablePreparePromise = null;
    return [];
  }

  // Use cached result briefly to avoid UI flicker on frequent refreshes
  const ttlMs = 5000;
  if (
    Array.isArray(STATE.claimableVestIds) &&
    STATE.claimablePreparedAt &&
    Date.now() - STATE.claimablePreparedAt < ttlMs &&
    (STATE.claimableVestIds.length > 0 || !vestsHint || Number(vestsHint) <= 0)
  ) {
    return STATE.claimableVestIds;
  }

  // Avoid parallel compute storms
  if (STATE.claimablePreparing && STATE.claimablePreparePromise) {
    return STATE.claimablePreparePromise;
  }

  STATE.claimablePreparing = true;
  const myToken = ++claimableComputeToken;

  STATE.claimablePreparePromise = (async () => {
    try {
      const url = `https://scan.flowvest.io/api/beneficiary-vests?addr=${STATE.account}&t=${Date.now()}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`beneficiary-vests ${r.status}`);

      const json = await r.json();
      const ids = (Array.isArray(json.data) ? json.data : []).map(d => d.vest_id);

      STATE.claimableVestIds = ids;
      STATE.claimablePreparedAt = Date.now();

      return ids;
    } catch (err) {
      console.error("[FLOW] prepareClaimableIds failed", err);
      STATE.claimableVestIds = [];
      STATE.claimablePreparedAt = Date.now();
      return [];
    } finally {
      if (myToken === claimableComputeToken) {
        STATE.claimablePreparing = false;
        STATE.claimablePreparePromise = null;
      }
    }
  })();

  return STATE.claimablePreparePromise;
}

async function refreshView() {
  const claimBtn = document.getElementById("btnClaim");

  if (!STATE.account) {
    UI.setDisconnected();
    return;
  }

  UI.setConnected();

  // address summary (Claimable)
  try {

    const r = await fetch(
    `https://scan.flowvest.io/api/address/${STATE.account}/summary?t=${Date.now()}`,
  { cache: "no-store" }
    );

    if (r.ok) {
      const summary = await r.json();
      const claimable = Number(summary?.beneficiary?.claimable || 0);
      const vests = Number(summary?.beneficiary?.claimable_vests || 0);
      const scanStaleAfterClaim = UI.updateClaimableUI(summary);

      if (claimable > 0 && vests > 0 && !scanStaleAfterClaim) {
        // UX: keep the button available as soon as API says claimable > 0.
        // Precompute in the background to keep wallet popup user-gesture friendly.
        if (claimBtn) {
          claimBtn.disabled = false;
        }

        // Fire-and-forget background compute; click() will use cached results.
        if (!STATE.claimablePreparedAt || Date.now() - STATE.claimablePreparedAt > 15000) {
          prepareClaimableIds({ vestsHint: vests }).catch(() => {});
        }
      } else {
        // Claimable summary can briefly fluctuate between 0 and >0 (indexing/aggregation delay).
        // Don't aggressively clear cached vest ids while:
        // - a background prepare is still running
        // - or the cache is still relatively fresh
        const ttlMs = 15000;
        const cacheFresh =
          Array.isArray(STATE.claimableVestIds) &&
          STATE.claimableVestIds.length > 0 &&
          STATE.claimablePreparedAt &&
          Date.now() - STATE.claimablePreparedAt < ttlMs;

        if (!STATE.claimablePreparing && !cacheFresh) {
          STATE.claimableVestIds = [];
          STATE.claimablePreparedAt = 0;
        }

        // Button label / disabled state come from UI.updateClaimableUI (incl. post-claim sync).
      }

      // Update claim status card — use summary fields directly (no extra RPC/fetch needed)
      if (!scanStaleAfterClaim && STATE.account) {
        UI.updateClaimCard({
          activePlans: Number(summary?.beneficiary?.active || 0),
          nextPaymentAt: summary?.beneficiary?.next_payment_at || null,
          claimable
        });
      }
    }

  } catch (err) {
    console.error("[FLOW] summary load failed:", err);
      const claimBtn = document.getElementById("btnClaim");
  const hintEl = document.getElementById("kpiDueHint");
  const claimEl = document.getElementById("kpiDue");

  if (claimEl) claimEl.textContent = "—";
  if (hintEl) {
    hintEl.textContent = "";
    hintEl.style.display = "none";
  }
  if (claimBtn) {
    claimBtn.disabled = true;
    claimBtn.textContent = I18N.t("claim.action");
  }
  }

}
  async function loadStats() {

    const empty = {
      tvl: null,
      vestCount: null,
      usage: null,
      balance: null,
      due: null
    };

    try {

      if (!STATE.flow || !STATE.usdc) return empty;

      const stats = { ...empty };

      const [tvlResult, countResult, balanceResult] = await Promise.allSettled([
        flowRead().totalPrincipal(),
        flowRead().vestCount(),
        STATE.account ? usdcRead().balanceOf(STATE.account) : Promise.resolve(null)
      ]);

      if (tvlResult.status === "fulfilled") stats.tvl = tvlResult.value;
      else console.warn("totalPrincipal() failed", tvlResult.reason);

      let count = 0;
      if (countResult.status === "fulfilled") {
        count = Number(countResult.value);
        stats.vestCount = count;
      } else console.warn("vestCount() failed", countResult.reason);

      if (balanceResult.status === "fulfilled" && balanceResult.value !== null) {
        stats.balance = balanceResult.value;
      } else if (balanceResult.status === "rejected") {
        console.warn("balanceOf failed", balanceResult.reason);
      }

      try {
        const tvlNum = Number(ethers.utils.formatUnits(stats.tvl || 0, C.DECIMALS_USDC));
        const cap = Number(C.TVL_CAP_USDC || 0) || 0;
        stats.usage = cap > 0 ? (tvlNum / cap) * 100 : null;
      } catch (e) {
        console.warn("usage calc failed", e);
      }

      // Note: Claimable + vest-level due amounts are handled in refreshView()
      // via the scan API + prepareClaimableIds. Keep KPI stats lightweight
      // so Protocol TVL updates fast after connect.

      return stats;

    } catch (err) {

      console.error("[FLOW] loadStats error:", err);

      return empty;

    }

  }

//createVest 
    async function createVest(monthlyInput, beneficiaryInput) {
  if (!STATE.account) throw new Error("Wallet not connected");
  if (!STATE.flow) throw new Error("Contract not initialized");

  if (Number(STATE.chainId) !== Number(C.CHAIN_ID)) {
    throw new Error(`Please switch to ${C.CHAIN_NAME}`);
  }

  const monthly = String(monthlyInput || "").trim();
  const beneficiary = String(beneficiaryInput || "").trim();

  if (!monthly) throw new Error("Monthly amount required");
  if (!beneficiary) throw new Error("Beneficiary required");

  if (!ethers.utils.isAddress(beneficiary)) {
    throw new Error("Invalid beneficiary address");
  }

  const monthlyNum = Number(monthly);

  if (!Number.isFinite(monthlyNum) || monthlyNum <= 0) {
    throw new Error("Invalid monthly amount");
  }

  const totalAmount = monthlyNum * 3;

  if (totalAmount < 200) {
    throw new Error("Minimum vest is 200 USDC total (monthly x 3)");
  }

  if (totalAmount > 10000) {
    throw new Error("Maximum vest is 10,000 USDC total (monthly x 3)");
  }

  // TVL Cap check + vestCount in parallel
  const [currentTvl, beforeCount] = await Promise.all([
    flowRead().totalPrincipal(),
    flowRead().vestCount(),
  ]);
  const currentTvlNum = Number(ethers.utils.formatUnits(currentTvl, C.DECIMALS_USDC));

  const tvlCap = Number(C.TVL_CAP_USDC || 0) || 0;
  if (tvlCap > 0 && currentTvlNum + totalAmount > tvlCap) {
    throw new Error(
      `TVL Cap exceeded: current TVL is ${currentTvlNum.toFixed(2)} USDC, cap is ${tvlCap} USDC`
    );
  }

  const monthlyAmount = UTILS.parseAmount(monthly, C.DECIMALS_USDC);
  const startAt = Math.floor(Date.now() / 1000) + 60;
  try {
    await STATE.flow.callStatic.createVest(beneficiary, startAt, monthlyAmount);
  } catch (simErr) {
    const reason = UTILS.safeError(simErr);
    throw new Error(
      reason !== "Unknown error" ? reason : I18N.t("ui.unpredictableGas")
    );
  }

  const receipt = await TX.send(
    () => STATE.flow.createVest(beneficiary, startAt, monthlyAmount),
    {
      pendingText: I18N.t("flow.pendingCreate"),
      successText: I18N.t("flow.successCreate"),
      suppressSuccess: true
    }
  );

    let vestId = null;

  try {
    for (const log of receipt.logs || []) {
      try {
        const parsed = STATE.flow.interface.parseLog(log);

        if (
          parsed.name === "VestCreated" ||
          parsed.name === "Created" ||
          parsed.name === "NewVest"
        ) {
          vestId =
            parsed.args.vestId?.toString?.() ??
            parsed.args.id?.toString?.() ??
            parsed.args[0]?.toString?.() ??
            null;

          if (vestId) break;
        }
      } catch (_) {
        // ignore unrelated logs
      }
    }
  } catch (err) {
    console.warn("Failed to parse vestId", err);
  }

  if (vestId === null) {
    try {
    let afterCount = await flowRead().vestCount();

    for (let i = 0; i < 3 && afterCount.lte(beforeCount); i++) {
      await new Promise(r => setTimeout(r, 800));
      afterCount = await flowRead().vestCount();
    }

    if (afterCount.gt(beforeCount)) {
      vestId = afterCount.toString();
    } else {
      console.warn("[FLOW] vestCount fallback did not advance", {
        before: beforeCount.toString(),
        after: afterCount.toString()
      });
    }
  } catch (err) {
    console.warn("[FLOW] fallback vestCount failed", err);
  }
}

  if (vestId !== null) {
    const line1 = I18N.t("creator.vestCreated", { id: vestId });
    const line2 = I18N.t("creator.vestCreatedHint");
    const scanUrl = `https://scan.flowvest.io/vest.html?id=${vestId}`;
    const line3 = `<a href="${scanUrl}" target="_blank" class="underline text-green-400">${I18N.t("creator.vestCreatedScan")}</a>`;
    if (window.UI?.showStatus) UI.showStatus(`${line1}<br>${line2}<br>${line3}`, "success", { html: true });
  } else {
    if (window.UI?.showSuccess) UI.showSuccess(I18N.t("flow.successCreate"));
  }
}

async function claim() {
  if (!STATE.account) throw new Error("Wallet not connected");
  if (!STATE.flow) throw new Error("Contract not initialized");

  let claimableIds = Array.isArray(STATE.claimableVestIds) ? STATE.claimableVestIds.slice() : [];
  if (!claimableIds.length) {
    // Show "Preparing..." so user knows the click registered
    const _btn = document.getElementById("btnClaim");
    if (_btn) _btn.textContent = I18N.t("claim.preparing");

    // If a background precompute is already running, wait for it.
    if (STATE.claimablePreparePromise) {
      claimableIds = await STATE.claimablePreparePromise;
    } else {
      // Fallback (should rarely happen because refreshView precomputes)
      claimableIds = await prepareClaimableIds({ vestsHint: 1 });
    }
  }

  if (!claimableIds.length) {
    const rl = STATE.claimableRateLimitedUntil && Date.now() < STATE.claimableRateLimitedUntil;
    throw new Error(
      rl ? I18N.t("flow.claimRateLimited") : I18N.t("flow.noClaimable")
    );
  }

  for (let i = 0; i < claimableIds.length; i++) {
    const id = claimableIds[i];

    await TX.send(
      () => STATE.flow.release(id),
      {
        pendingText: I18N.t("flow.claimingVest", {
          id,
          current: i + 1,
          total: claimableIds.length
        }),
        successText: I18N.t("flow.vestClaimed", { id }),
        claimStatus: true
      }
    );
  }

  // cachedMyVestIds intentionally kept — vest ownership doesn't change after claim.
  // Only claimable IDs need resetting so dueAmount is re-checked next time.
  STATE.claimableVestIds = [];
  STATE.claimablePreparedAt = 0;
  STATE.claimablePreparing = false;
  STATE.claimablePreparePromise = null;

  // Scan indexer may still return the pre-claim total for a few seconds — avoid confusing UI.
  STATE.postClaimStaleGuardUntil = Date.now() + 30000;

  // Immediately zero out UI — don't wait for API response.
  if (window.UI?.setClaimedState) UI.setClaimedState();

  await refreshView();

  // Burst-poll every 500ms until the indexer syncs and guard clears (max 15s).
  const _burstStart = Date.now();
  const _burstTimer = setInterval(async () => {
    if (!STATE.postClaimStaleGuardUntil || Date.now() - _burstStart > 15000) {
      clearInterval(_burstTimer);
      return;
    }
    try { await refreshView(); } catch (_) {}
  }, 500);
}

async function canTerminateVest(vestId) {
  if (!STATE.account) return { ok: false, reason: "Wallet not connected" };
  if (!STATE.flow) return { ok: false, reason: "Contract not initialized" };

  const id = String(vestId || "").trim();
  if (!/^\d+$/.test(id)) {
    return { ok: false, reason: "Valid Vest ID required" };
  }

  const vest = await STATE.flow.vests(id);

  const owner = String(vest.owner || "").toLowerCase();
  const account = String(STATE.account || "").toLowerCase();

  if (owner !== account) {
    return { ok: false, reason: "Only vest owner can terminate" };
  }

  if (vest.terminated) {
    return { ok: false, reason: window.I18N ? I18N.t("ui.alreadyTerminated") : "Vest already terminated" };
  }

  const principal = Number(
    ethers.utils.formatUnits(vest.principal, C.DECIMALS_USDC)
  );
  const released = Number(
    ethers.utils.formatUnits(vest.released, C.DECIMALS_USDC)
  );

  if (released >= principal) {
    return { ok: false, reason: "Vest already completed" };
  }

  const startAt = Number(vest.startAt || 0);
  const period = Number(C.PERIOD_SECONDS || C.PERIOD || 2592000);
  const now = Math.floor(Date.now() / 1000);

  const terminateAt = startAt + (period * 2);
  const completeAt = startAt + (period * 3);


  if (now < terminateAt) {
    return { ok: false, reason: "Terminate available after second period" };
  }
  if (now >= completeAt) {
    return { ok: false, reason: window.I18N ? I18N.t("ui.terminateWindowClosed") : "Terminate window closed" };
  }
  return { ok: true, reason: "" };
}

async function getMyOwnerVestIds(count) {
  if (!STATE.flow || !STATE.account) return [];

  const ids = [];

  for (let i = 1; i <= count; i++) {
    try {
      const v = await STATE.flow.vests(i);

      if (
        String(v.owner || "").toLowerCase() ===
        String(STATE.account || "").toLowerCase()
      ) {
        ids.push(i);
      }
    } catch (err) {
      console.warn("[FLOW] getMyOwnerVestIds failed", i, err);
    }
  }

  return ids;
}

async function getTerminateStatus(vestId) {
  if (!STATE.account) {
    return { ok: false, reason: "Wallet not connected" };
  }

  const vest = await STATE.flow.vests(vestId);

  const owner = String(vest.owner || "").toLowerCase();
  const account = String(STATE.account || "").toLowerCase();

  if (owner !== account) {
    return { ok: false, reason: "Not owner" };
  }

  if (vest.terminated) {
    return { ok: false, reason: "Terminated" };
  }

  const principal = Number(
    ethers.utils.formatUnits(vest.principal, C.DECIMALS_USDC)
  );
  const released = Number(
    ethers.utils.formatUnits(vest.released, C.DECIMALS_USDC)
  );

  if (released >= principal) {
    return { ok: false, reason: "Completed" };
  }

  const startAt = Number(vest.startAt || 0);
  const period = Number(C.PERIOD_SECONDS || C.PERIOD || 2592000);
  const now = Math.floor(Date.now() / 1000);
  const terminateAt = startAt + (period * 2);

  if (now < terminateAt) {
    return {
      ok: false,
      reason: "Waiting",
      secondsLeft: terminateAt - now
    };
  }

  return { ok: true, reason: "Ready" };
}

async function terminateVest(vestId) {
  if (!STATE.account) throw new Error("Wallet not connected");
  if (!STATE.flow) throw new Error("Contract not initialized");

  const id = String(vestId || "").trim();
  if (!/^\d+$/.test(id)) {
    throw new Error("Valid Vest ID required");
  }

  const check = await canTerminateVest(id);
  if (!check.ok) {
    throw new Error(check.reason);
  }

  try {
    await STATE.flow.callStatic.terminate(id);
  } catch (simErr) {
    const reason = UTILS.safeError(simErr);
    throw new Error(
      reason !== "Unknown error" ? reason : I18N.t("ui.unpredictableGas")
    );
  }

  const receipt = await TX.send(
    () => STATE.flow.terminate(id),
    {
      pendingText: I18N.t("flow.pendingTerminate"),
      successText: I18N.t("flow.successTerminate", { id })
    }
  );

  cachedMyVestIds = null;
  cachedVestCount = 0;

  await refreshView();

  return receipt;
}

  window.FLOW = {
    refreshView,
    loadStats,
    createVest,
    claim,
    terminateVest,
    canTerminateVest,
    getMyOwnerVestIds,
    getTerminateStatus,
    prepareClaimableIds,
    computeNextPaymentAt,
    formatUtcDatetime
  };

})();
