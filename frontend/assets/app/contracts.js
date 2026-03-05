// assets/app/contracts.js
(function(){

  function init(state){
    if (!state?.signer) throw new Error("CONTRACTS.init: signer missing");

    state.flow = new ethers.Contract(C.FLOW, ABI.FLOW, state.signer);
    state.usdc = new ethers.Contract(C.USDC, ABI.ERC20, state.signer);

    UI.setText("flowAddr", C.FLOW);
    UI.setText("usdcAddr", C.USDC);
  }

  window.CONTRACTS = { init };
})();
