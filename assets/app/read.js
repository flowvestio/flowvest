// assets/app/read.js
(function(){
  let claimableVestIds = [];

  function getClaimableVestIds(){ return claimableVestIds.slice(); }

  async function scan(flow, addr){
    claimableVestIds = [];
    const addrLc = String(addr || "").toLowerCase();

    const vcBN = await flow.vestCount();
    const count = vcBN.toNumber ? vcBN.toNumber() : Number(vcBN);
    if (!count || count <= 0){
      return { totalDue: ethers.constants.Zero, pickedStartAt: null };
    }

    const N = 25;
    const start = Math.max(1, count - N + 1);

    let totalDue = ethers.constants.Zero;
    let pickedStartAt = null;

    for (let id = count; id >= start; id--){
      try{
        const v = await flow.vests(id);

        // tuple-safe
        const ownerAddr = String(v[0] || v.owner || "").toLowerCase();
        const benAddr   = String(v[1] || v.beneficiary || "").toLowerCase();
        const startAt   = Number((v[2] ?? v.startAt)?.toString?.() ?? (v[2] ?? v.startAt) ?? 0);
        const terminated = Boolean(v[6] ?? v.terminated);

        const ownerOk = ownerAddr === addrLc;
        const benOk   = benAddr === addrLc;

        // picked: 最新一条与我相关（ben 或 owner）
        if (!pickedStartAt && (benOk || ownerOk) && startAt > 0){
          pickedStartAt = startAt;
        }

        // claimable: 仅 beneficiary
        if (benOk && !terminated){
          const due = await flow.dueAmount(id);
          if (due && due.gt && due.gt(0)){
            claimableVestIds.push(id);
            totalDue = totalDue.add(due);
          }
        }
      }catch(_e){}
    }

    return { totalDue, pickedStartAt };
  }

  async function fetchLatest3(){
    const url = `${C.API_VESTS_LATEST}?limit=3`;
    const r = await fetch(url, { cache:"no-store" });
    if (!r.ok) throw new Error("API fetch failed: " + r.status);
    return await r.json(); // array
  }

  async function refreshAll(state){
    if (!state?.signer || !state?.addr || !state?.flow || !state?.usdc) return;

    await WALLET.refreshNetworkInfo();

    const { flow, usdc, addr } = state;

    // protocol
    const tvl = await flow.totalPrincipal();
    const vc  = await flow.vestCount();
    UI.setText("kpiTVL", UI.fmtUnits(tvl, C.DEC) + " USDC");
    UI.setText("kpiVestCount", vc.toString());

    const tvlUSDC = Number(UI.fmtUnits(tvl, C.DEC));
    const usagePct = C.TVL_CAP_USDC > 0 ? (tvlUSDC / C.TVL_CAP_USDC) * 100 : 0;
    UI.setText("kpiUsage", usagePct.toFixed(2) + "%");

    // balance
    const bal = await usdc.balanceOf(addr);
    UI.setText("kpiBalance", UI.fmtUnits(bal, C.DEC) + " USDC");

    // scan
    const { totalDue, pickedStartAt } = await scan(flow, addr);
    UI.setText("kpiDue", UI.fmtUnits(totalDue, C.DEC) + " USDC");
    UI.setText("kpiDueHint",
      claimableVestIds.length
        ? `Claimable vests: #${claimableVestIds.join(", #")}`
        : "No claimable vests in last scan."
    );

    const btnClaim = UI.$("btnClaim");
    if (btnClaim) btnClaim.disabled = claimableVestIds.length === 0;

    // creator button
    const btnCreator = UI.$("btnCreator");
    if (btnCreator){
      const isCreator = String(addr).toLowerCase() === C.CREATOR_ADDR;
      btnCreator.classList.toggle("hidden", !isCreator);
    }

    // periods
    if (pickedStartAt) UI.renderPeriods(pickedStartAt);
    else UI.clearPeriods();

    // vest list 3 (API)
    try{
      const rows = await fetchLatest3();
      UI.renderVestList3(rows);
    }catch(e){
      UI.log("Vest list API error: " + (e?.message || String(e)));
      UI.renderVestList3([]);
    }
  }

  window.READ = { refreshAll, getClaimableVestIds };
})();
