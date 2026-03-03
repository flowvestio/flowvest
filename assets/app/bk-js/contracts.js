// assets/app/contracts.js
(function () {
  const FLOW_ABI = [
    "function vestCount() view returns (uint256)",
    "function totalPrincipal() view returns (uint256)",
    "function dueAmount(uint256 id) view returns (uint256)",
    "function vests(uint256 id) view returns (address owner,address beneficiary,uint256 startAt,uint256 monthlyAmount,uint256 principal,uint256 releasedAmount,bool terminated)",
    "function createVest(address beneficiary_, uint256 startAt_, uint256 monthlyAmount_)",
    "function release(uint256 id)",
    "function terminate(uint256 id)",
  ];

  const USDC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner,address spender) view returns (uint256)",
    "function approve(address spender,uint256 amount) returns (bool)",
  ];

  window.ABI = { FLOW_ABI, USDC_ABI };

  window.CONTRACTS = {
    make(state) {
      const { FLOW, USDC } = window.C;
      const { signer } = state;
      state.flow = new ethers.Contract(FLOW, FLOW_ABI, signer);
      state.usdc = new ethers.Contract(USDC, USDC_ABI, signer);
    },
  };
})();
