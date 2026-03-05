// assets/app/config.js
(function(){
  window.C = {
    // Base Sepolia
    CHAIN_ID_DEC: 84532,
    CHAIN_ID_HEX: "0x14a34",
    CHAIN_NAME: "Base Sepolia",
    RPC: "https://sepolia.base.org",
    EXPLORER: "https://sepolia.basescan.org",

    // Contracts (replace when mainnet)
    FLOW: "0xE4ad0C9A342C6F604862026f9E548B07fc726c91",
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC

    // UI rules
    CREATOR_ADDR: "0xbf7075006db054eb108667bbe0cb15cafa9a79b0".toLowerCase(),

    // Vest params (V1)
    PERIOD: 60,
    TOTAL: 3,
    START_DELAY: 30,

    // USDC decimals
    DEC: 6,

    // for KPI usage (optional)
    TVL_CAP_USDC: 300000,

    // API
    API_LATEST: "/api/vests/latest"
  };

  // minimal ABIs
  window.ABI = {
    ERC20: [
      "function balanceOf(address) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ],
    FLOW: [
      "function vestCount() view returns (uint256)",
      "function totalPrincipal() view returns (uint256)",
      "function vests(uint256) view returns (address owner,address beneficiary,uint256 startAt,uint256 monthly,uint256 principal,uint256 released,bool terminated)",
      "function dueAmount(uint256) view returns (uint256)",
      "function createVest(address beneficiary,uint256 startAt,uint256 monthly)",
      "function release(uint256 vestId)",
      "function terminate(uint256 vestId)"
    ]
  };
})();
