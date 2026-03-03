
n(){
  function parseUSDC(s){
    const v = String(s || "").trim();
    if (!v) return ethers.constants.Zero;
    return ethers.utils.parseUnits(v, C.DEC);
  }

  async function ownerApprove(state){
    const monthly = parseUSDC(UI.$("ownerMonthly")?.value);
    const total = monthly.mul(C.TOTAL);

    await TX.runTx("Approve USDC", async ()=>{
      return state.usdc.approve(C.FLOW, total);
    });

    await READ.refreshAll(state);
  }

  async function ownerCreate(state){
    const ben = (UI.$("ownerBeneficiary")?.value || "").trim();
    if (!ethers.utils.isAddress(ben)) throw new Error("Invalid beneficiary address");

    const monthly = parseUSDC(UI.$("ownerMonthly")?.value);
    const block = await state.provider.getBlock("latest");
    const startAt = ethers.BigNumber.from(block.timestamp + C.START_DELAY);

    await TX.runTx("Create Vest", async ()=>{
      return state.flow.createVest(ben, startAt, monthly);
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
    // 最简单：终止“最新一条 vest_id”（你也可以做输入框指定）
    const vcBN = await state.flow.vestCount();
    const id = vcBN.toNumber ? vcBN.toNumber() : Number(vcBN);
    if (!id) return alert("No vest found.");

    await TX.runTx(`Terminate #${id}`, async ()=> state.flow.terminate(id));
    await READ.refreshAll(state);
  }

  function updateCreatorTotals(){
    const monthlyStr = UI.$("ownerMonthly")?.value || "";
    let total = "—";
    try{
      const monthly = parseUSDC(monthlyStr);
      total = UI.fmtUnits(monthly.mul(C.TOTAL), C.DEC);
    }catch(_e){}
    UI.setText("ownerTotal", total);
  }

  window.ACTIONS = {
    ownerApprove, ownerCreate, ownerTerminateLatest,
    claim,
    updateCreatorTotals
  };
})();
