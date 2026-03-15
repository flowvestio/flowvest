(function () {
  function init(state) {
    if (!state?.signer) throw new Error("CONTRACTS.init: signer missing");
    if (!window.ABI) throw new Error("ABI not loaded");
    if (!window.C) throw new Error("Config not loaded");

    state.flow = new ethers.Contract(C.FLOW, ABI.FLOW, state.signer);
    state.usdc = new ethers.Contract(C.USDC, ABI.ERC20, state.signer);

    UI.setText("flowAddr", C.FLOW);
    UI.setText("usdcAddr", C.USDC);
  }

  function clear(state) {
    state.flow = null;
    state.usdc = null;
  }
 
  async function loadStats() {
  if (!STATE.flow) return;

  try {
    // protocol TVL
    const tvl = await STATE.flow.totalLocked();

    // vest count
    const vestCount = await STATE.flow.vestCount();

    // usage 
    const usage = await STATE.flow.usagePercent();

    // user balance
    let balance = 0;
    let due = 0;

    if (STATE.account) {
      balance = await STATE.usdc.balanceOf(STATE.account);
      due = await STATE.flow.claimableOf(STATE.account);
    }

    return {
      tvl,
      vestCount,
      usage,
      balance,
      due
    };

  } catch (e) {
    console.error("loadStats error", e);
  }
}

  window.CONTRACTS = { init, clear };
})();
