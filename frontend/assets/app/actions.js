// assets/app/actions.js
(function(){

  function parseUSDC(s){
    const v = String(s ?? "").trim();
    if (!v) return ethers.constants.Zero;
    return ethers.utils.parseUnits(v, C.DEC);
  }

  function minMonthlyBN(){
    // Min principal = 200, TOTAL=3 => monthly >= 66.666.. -> enforce 67
    return ethers.utils.parseUnits("67", C.DEC);
  }

  function validateMonthly(monthlyBN){
    const minBN = minMonthlyBN();
    if (!monthlyBN || monthlyBN.lte(0)) {
      throw new Error("Monthly amount is required.");
    }
    if (monthlyBN.lt(minBN)){
      throw new Error("Monthly must be ≥ 67 USDC (min principal 200 / 3 periods).");
    }
    return true;
  }

  function updateCreatorTotals(state){
    const monthlyStr = UI.$("ownerMonthly")?.value || "";
    const benStr = (UI.$("ownerBeneficiary")?.value || "").trim();

    let monthlyBN = ethers.constants.Zero;
    try { monthlyBN = parseUSDC(monthlyStr); } catch(_e) {}

    // total
    let totalStr = "—";
    try{
      totalStr = UI.fmtUnits(monthlyBN.mul(C.TOTAL), C.DEC);
    }catch(_e){}
    UI.setText("ownerTotal", totalStr);

    // validation
    const connected = !!state?.signer && !!state?.usdc && !!state?.flow;
    const benOk = ethers.utils.isAddress(benStr);

    const minBN = minMonthlyBN();
    const isEnough = monthlyBN.gte(minBN);

    // optional: give user hint
    if (!monthlyStr){
      UI.setText("ownerTotal", "—");
    } else if (!isEnough){
      UI.setText("ownerTotal", "Min principal 200 USDC → monthly ≥ 67");
    }

    const btnApprove = UI.$("btnOwnerApprove");
    const btnCreate  = UI.$("btnOwnerCreate");

    if (btnApprove) btnApprove.disabled = !(connected && isEnough);
    if (btnCreate)  btnCreate.disabled  = !(connected && isEnough && benOk);

  }

  async function ownerApprove(state){
    const monthlyBN = parseUSDC(UI.$("ownerMonthly")?.value);
    validateMonthly(monthlyBN);

    const total = monthlyBN.mul(C.TOTAL);

    await TX.runTx("Approve USDC", async ()=>{
      return state.usdc.approve(C.FLOW, total);
    });

    await READ.refreshAll(state);
  }

  async function ownerCreate(state){
    const ben = (UI.$("ownerBeneficiary")?.value || "").trim();
    if (!ethers.utils.isAddress(ben)) throw new Error("Invalid beneficiary address");

    const monthlyBN = parseUSDC(UI.$("ownerMonthly")?.value);
    validateMonthly(monthlyBN);

    const block = await state.provider.getBlock("latest");
    const startAt = ethers.BigNumber.from(block.timestamp + C.START_DELAY);

    await TX.runTx("Create Vest", async ()=>{
      return state.flow.createVest(ben, startAt, monthlyBN);
    });

    await READ.refreshAll(state);
  }

  async function claim(state){
    const ids = READ.getClaimableVestIds();
    if (!ids.length) return alert("Nothing claimable.");
    for (const id of ids){
      await TX.runTx(`Release #${id}`, async ()=> state.flow.release(id));
    }
    alert("Claim complete ✅");
    await READ.refreshAll(state);
  }

  async function ownerTerminateLatest(state){
    const vcBN = await state.flow.vestCount();
    const total = vcBN.toNumber ? vcBN.toNumber() : Number(vcBN);
    if (!total) return alert("No vest found.");
    // 找最新的未terminated且未completed的vest
    let targetId = null;
    for (let id = total; id >= 1; id--){
      const v = await state.flow.vests(id);
      const terminated = v[6];
      const released = v[5];
      const principal = v[4];
      const startAt = v[2].toNumber ? v[2].toNumber() : Number(v[2]);
      const termFrom = startAt + 2 * C.PERIOD;
      const now = Math.floor(Date.now()/1000);
      if (!terminated && released.lt(principal) && now >= termFrom){
        targetId = id;
        break;
      }
    }
    if (!targetId) return alert("No active vest found to terminate.");
    await TX.runTx(`Terminate #${targetId}`, async ()=> state.flow.terminate(targetId));
    await READ.refreshAll(state);
  }

  window.ACTIONS = {
    ownerApprove,
    ownerCreate,
    ownerTerminateLatest,
    claim,
    updateCreatorTotals
  };

})();
