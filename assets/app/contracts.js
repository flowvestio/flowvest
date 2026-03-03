// assets/app/contracts.js
(function(){
  const FLOW_ABI = [
    "function vestCount() view returns (uint256)",
    "function totalPrincipal() view returns (uint256)",
    "function dueAmount(uint256 id) view returns (uint256)",
    "function vests(uint256 id) view returns (address owner,address beneficiary,uint256 startAt,uint256 monthlyAmount,uint256 principal,uint256 releasedAmount,bool terminated)",
    "function createVest(address beneficiary,uint256 startAt,uint256 monthlyAmount) external",
    "function release(uint256 id) external",
    "function terminate(uint256 id) external"
  ];

  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)"
  ];

  function attach(state){
    if (!state?.signer) throw new Error("No signer");
    state.flow = new ethers.Contract(C.FLOW, FLOW_ABI, state.signer);
    state.usdc = new ethers.Contract(C.USDC, ERC20_ABI, state.signer);

    UI.setText("flowAddr", C.FLOW);
    UI.setText("usdcAddr", C.USDC);

    return state;
  }

  window.CONTRACTS = { attach };
})();
