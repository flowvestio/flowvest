(function () {

  let cachedMyVestIds = null;
  let cachedVestCount = 0;

  async function getMyVestIds(count) {
  if (cachedMyVestIds !== null && cachedVestCount === count) {
    return cachedMyVestIds;
  }

  const scanFrom = Math.max(1, count - 24);
const indices = Array.from({ length: count - scanFrom + 1 }, (_, i) => scanFrom + i);
  const results = await Promise.allSettled(
    indices.map(i => STATE.flow.vests(i))
  );

  const found = [];

  results.forEach((r, j) => {
    if (r.status === "fulfilled") {
      if (
        r.value.beneficiary &&
        r.value.beneficiary.toLowerCase() === STATE.account.toLowerCase()
      ) {
        found.push(indices[j]);
      }
    }
  });

  cachedMyVestIds = found;
  cachedVestCount = count;

  return cachedMyVestIds;
  }

async function refreshView() {
  const claimBtn = document.getElementById("btnClaim");
  if (claimBtn) claimBtn.disabled = true;

  if (!STATE.account) {
    UI.setDisconnected();
    return;
  }

  UI.setConnected();

  // protocol stats
  const stats = await loadStats();

  // address summary (Claimable)
  try {

    const r = await fetch(
    `https://scan.flowvest.io/api/address/${STATE.account}/summary?t=${Date.now()}`,
  { cache: "no-store" }
    );

    if (r.ok) {
      const summary = await r.json();
   UI.updateClaimableUI(summary);
      const claimable = Number(summary?.beneficiary?.claimable || 0);
      const vests = Number(summary?.beneficiary?.claimable_vests || 0);

      const claimEl = document.getElementById("kpiDue");
      const hintEl = document.getElementById("kpiDueHint");

      if (claimEl) {
        claimEl.textContent = claimable > 0 ? claimable.toFixed(1) : "—";
      }

      if (hintEl) {
       if (claimable > 0 && vests > 0) {
    hintEl.innerHTML = vests > 1
      ? `from ${vests} vests <span class="text-slate-500">schedules</span>`
      : `from 1 vest`;
    hintEl.style.display = "block";
  } else {
    hintEl.innerHTML = "";
    hintEl.style.display = "none";
  }
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
  if (claimBtn) claimBtn.disabled = true;	  
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

      try {
        stats.tvl = await STATE.flow.totalPrincipal();
      } catch (e) {
        console.warn("totalPrincipal() failed", e);
      }

      let count = 0;
      // ---------- TVL Usage ----------
try {

  const tvlNum = Number(
    ethers.utils.formatUnits(stats.tvl || 0, C.DECIMALS_USDC)
  );

  const cap = 200000;
  stats.usage = (tvlNum / cap) * 100;

} catch (e) {

  console.warn("usage calc failed", e);

}

      try {
        count = Number(await STATE.flow.vestCount());
        stats.vestCount = count;
      } catch (e) {
        console.warn("vestCount() failed", e);
      }

      if (STATE.account) {
        try {
          stats.balance = await STATE.usdc.balanceOf(STATE.account);
        } catch (e) {
          console.warn("balanceOf failed", e);
        }
      }

      if (STATE.account && count > 0) {

        let totalDue = ethers.BigNumber.from(0);

        const myIds = await getMyVestIds(count);
	console.log("[FLOW] vestCount =", count);
        console.log("[FLOW] myVestIds =", myIds);

        for (const id of myIds) {

          try {

            const due = await STATE.flow.dueAmount(id);

            totalDue = totalDue.add(due);

          } catch (e) {

            console.warn("dueAmount failed", id, e);

          }

        }

        stats.due = totalDue;

      }
     //  add return stats before 
if (STATE.account) {
  try {
    const r = await fetch(
      `https://scan.flowvest.io/api/address/${STATE.account}/summary?t=${Date.now()}`
    );
    if (r.ok) {
      stats.summary = await r.json();
    }
  } catch (e) {
    console.warn("summary fetch failed", e);
  }
}

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

  // TVL Cap check
  const currentTvl = await STATE.flow.totalPrincipal();
  const currentTvlNum = Number(
    ethers.utils.formatUnits(currentTvl, C.DECIMALS_USDC)
  );

  if (currentTvlNum + totalAmount > 200000) {
    throw new Error(
      `TVL Cap exceeded: current TVL is ${currentTvlNum.toFixed(2)} USDC, cap is 200,000 USDC`
    );
  }

  const monthlyAmount = UTILS.parseAmount(monthly, C.DECIMALS_USDC);
  const startAt = Math.floor(Date.now() / 1000) + 30;
  const beforeCount = await STATE.flow.vestCount();
  await STATE.flow.callStatic.createVest(beneficiary, startAt, monthlyAmount);

  const receipt = await TX.send(
    () => STATE.flow.createVest(beneficiary, startAt, monthlyAmount),
    {
      pendingText: "Creating vest... confirm in wallet",
      successText: "✓ Vest created successfully"
    }
  );

    let vestId = null;

  try {
    for (const log of receipt.logs || []) {
      try {
        const parsed = STATE.flow.interface.parseLog(log);

        console.log("[FLOW] parsed log name =", parsed.name);
        console.log("[FLOW] parsed log args =", parsed.args);

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
    let afterCount = await STATE.flow.vestCount();

    for (let i = 0; i < 3 && afterCount.lte(beforeCount); i++) {
      await new Promise(r => setTimeout(r, 800));
      afterCount = await STATE.flow.vestCount();
    }

    if (afterCount.gt(beforeCount)) {
      vestId = afterCount.toString();
      console.log("[FLOW] fallback vestId =", vestId);
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

  // show "View Your Vest"
if (vestId !== null) {
  const box = document.getElementById("viewVestBox");
  const idEl = document.getElementById("viewVestId");

  if (box && idEl) {
  idEl.textContent = vestId;
  box.classList.remove("hidden");
  setTimeout(() => {
    box.classList.add("hidden");
  }, 10000);
}
}
}

async function claim() {
  if (!STATE.account) throw new Error("Wallet not connected");
  if (!STATE.flow) throw new Error("Contract not initialized");

  const count = Number(await STATE.flow.vestCount());
  if (count <= 0) throw new Error("No vests found");

  const myIds = await getMyVestIds(count);
  if (!myIds.length) throw new Error("No vests found for this wallet");

  // collect  claim vest
  const claimableIds = [];
  for (const id of myIds) {
    try {
      const due = await STATE.flow.dueAmount(id);
      if (due && !due.isZero()) {
        claimableIds.push(id);
      }
    } catch (err) {
      console.warn("[FLOW] dueAmount check failed", id, err);
    }
  }

  if (!claimableIds.length) throw new Error("No claimable vest found");

  for (let i = 0; i < claimableIds.length; i++) {
    const id = claimableIds[i];

    await TX.send(
      () => STATE.flow.release(id),
      {
        pendingText: `Claiming vest #${id}... (${i + 1}/${claimableIds.length})`,
        successText: `Vest #${id} claimed`
      }
    );
  }

  cachedMyVestIds = null;
  cachedVestCount = 0;

  await refreshView();
 const claimBtn = document.getElementById("btnClaim");
if (claimBtn) claimBtn.disabled = true;
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
    return { ok: false, reason: "Vest already terminated" };
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
  const period = Number(C.PERIOD_SECONDS || C.PERIOD || 60);
  const now = Math.floor(Date.now() / 1000);

  const terminateAt = startAt + (period * 2);
  const completeAt = startAt + (period * 3);


  if (now < terminateAt) {
    return { ok: false, reason: "Terminate available after second period" };
  }
  if (now >= completeAt) {
  return { ok: false, reason: "Terminate window closed" };
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
  const period = Number(C.PERIOD_SECONDS || C.PERIOD || 60);
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

  await STATE.flow.callStatic.terminate(id);

  const receipt = await TX.send(
    () => STATE.flow.terminate(id),
    {
      pendingText: "Terminating vest...",
      successText: "Vest terminated"
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
    getTerminateStatus
  };

})();
