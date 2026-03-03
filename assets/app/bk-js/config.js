// assets/app/config.js
(function () {
  window.C = {
    // app meta
    PERIOD: 60,
    TOTAL: 3,
    DEC: 6,
    START_DELAY: 30, // create startAt = now + 30s

    // chain
    CHAIN_ID_HEX: "0x14a34", // Base Sepolia (84532)
    CHAIN_NAME: "Base Sepolia",
    RPC_URLS: ["https://sepolia.base.org"],
    EXPLORER: "https://sepolia.basescan.org",

    // contracts
    FLOW: "0xE4ad0C9A342C6F604862026f9E548B07fc726c91",
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",

    // owner (creator actions 显示用)
    CREATOR_ADDR: "0xbf7075006db054eb108667bbe0cb15cafa9a79b0".toLowerCase(),

    // utilization cap (人类单位：USDC)
    TVL_CAP_USDC: 200000,
  };
})();
