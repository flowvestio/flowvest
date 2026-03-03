// assets/app/config.js
(function(){
  window.C = {
    // chain
    CHAIN_ID_DEC: 84532,
    CHAIN_ID_HEX: "0x14a34",
    CHAIN_NAME: "Base Sepolia",
    RPC: "https://sepolia.base.org",
    EXPLORER: "https://sepolia.basescan.org",

    // contracts
    FLOW: "0xE4ad0C9A342C6F604862026f9E548B07fc726c91",
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",

    // decimals
    DEC: 6,

    // V1 config
    PERIOD: 60,
    TOTAL: 3,
    START_DELAY: 30,

    // KPI usage cap (human unit)
    TVL_CAP_USDC: 200000,

    // creator (owner-only buttons show)
    CREATOR_ADDR: "0xbf7075006db054eb108667bbe0cb15cafa9a79b0".toLowerCase(),

    // API
    API_VESTS_LATEST: "/api/vests/latest"
  };
})();
