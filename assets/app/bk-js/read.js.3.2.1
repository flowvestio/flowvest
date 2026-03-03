// assets/app/read.js
(function () {
  let claimableVestIds = [];
  let _tlStartAt = null;
  let _tlTimer = null;

  function stopTimelineTick() {
    if (_tlTimer) clearInterval(_tlTimer);
    _tlTimer = null;
  }

  function startTimelineTick() {
    stopTimelineTick();
    if (_tlStartAt == null) return;
    UI.renderV1Timeline(_tlStartAt, C.PERIOD, C.TOTAL);
    _tlTimer = setInterval(() => UI.renderV1Timeline(_tlStartAt, C.PERIOD, C.TOTAL), 1000);
  }

  async function refreshNetworkInfo(state) {
    UI.setText("net", C.CHAIN_NAME);
    UI.setText("addr", UI.shortAddr(state.addr));
    UI.setText("flowAddr", C.FLOW);
    UI.setText("usdcAddr", C.USDC);

    // creator button show/hide
    const isCreator = state.addr?.toLowerCase() === C.CREATOR_ADDR;
    const btnCreator = UI.$("btnCreator");
    if (btnCreator) btnCreator.classList.toggle("hidden", !isCreator);
  }

  async function computeClaimable(flow, addr) {
    claimableVestIds = [];
    _tlStartAt = null;

    const vcBN = await flow.vestCount();
    const count = vcBN.toNumber ? vcBN.toNumber() : Number(vcBN);
    if (!count || count <= 0) return { totalDue: ethers.constants.Zero, hit: 0 };

    const N = 25;
    const start = Math.max(1, count - N + 1);

    let totalDue = ethers.constants.Zero;
    let hit = 0;

    let chosenBeneficiary = null;
    let chosenOwner = null;

    for (let id = count; id >= start; id--) {
      try {
        const v = await flow.vests(id);

        const benOk = v.beneficiary && addr && v.beneficiary.toLowerCase() === addr.toLowerCase();
        const ownerOk = v.owner && addr && v.owner.toLowerCase() === addr.toLowerCase();

        if (!chosenBeneficiary && benOk) chosenBeneficiary = { id, startAt: Number(v.startAt.toString()) };
        if (!chosenOwner && ownerOk) chosenOwner = { id, startAt: Number(v.startAt.toString()) };

        if (benOk && !v.terminated) {
          const due = await flow.dueAmount(id);
          if (due.gt(0)) {
            claimableVestIds.push(id);
            totalDue = totalDue.add(due);
            hit++;
          }
        }
      } catch (_) {}
    }

    const chosen = chosenBeneficiary || chosenOwner;
    _tlStartAt = chosen ? chosen.startAt : null;

    return { totalDue, hit };
  }

  window.READ = {
    getClaimableVestIds() {
      return claimableVestIds.slice();
    },

    async refreshAll(state) {
      if (!state?.signer || !state?.addr || !state?.flow || !state?.usdc) return;

      await refreshNetworkInfo(state);

      const { flow, usdc, addr } = state;

      // protocol
      const tvl = await flow.totalPrincipal();
      const vc = await flow.vestCount();
      UI.setText("kpiTVL", UI.fmtUnits(tvl, C.DEC) + " USDC");
      UI.setText("kpiVestCount", vc.toString());

      // usage: 用“人类单位”算
      const tvlUSDC = Number(UI.fmtUnits(tvl, C.DEC));
      const usagePct = C.TVL_CAP_USDC > 0 ? (tvlUSDC / C.TVL_CAP_USDC) * 100 : 0;
      UI.setText("kpiUsage", usagePct.toFixed(2) + "%");

      // balance
      const bal = await usdc.balanceOf(addr);
      UI.setText("kpiBalance", UI.fmtUnits(bal, C.DEC) + " USDC");

      // claimable + timeline choice
      const { totalDue, hit } = await computeClaimable(flow, addr);
      UI.setText("kpiDue", UI.fmtUnits(totalDue, C.DEC) + " USDC");
      UI.setText("kpiDueHint", hit > 0 ? `Found ${hit} claimable vest(s): #${claimableVestIds.join(", #")}` : "—");

      // claim button
      const btnClaim = UI.$("btnClaim");
      if (btnClaim) btnClaim.disabled = !(claimableVestIds.length > 0);

      // timeline
      if (_tlStartAt != null) startTimelineTick();
      else {
        stopTimelineTick();
        UI.clearTimeline();
      }
    },
  };
})();
