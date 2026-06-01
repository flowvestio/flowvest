// assets/app/config.js
window.C = {
  // Network — Base Mainnet
  CHAIN_ID: 8453,
  CHAIN_ID_HEX: "0x2105",
  CHAIN_NAME: "Base",
  RPC_URL: "https://base-rpc.publicnode.com",
  EXPLORER_URL: "https://basescan.org",
  DECIMALS_USDC: 6,
  EXPLORER_TX: "https://basescan.org/tx/",
  EXPLORER_ADDRESS: "https://basescan.org/address/",
  OWNER: "0xbf7075006dB054Eb108667bbe0CB15CaFa9a79b0".trim(),

  // ---------------- PLANS ----------------
  // Plan A = 30 days × 3 periods | Plan B = 14 days × 6 periods
  PLAN_A: 1,
  PLAN_B: 2,

  PERIOD_A: 2592000,   // 30 days in seconds
  PERIODS_A: 3,

  PERIOD_B: 1209600,   // 14 days in seconds
  PERIODS_B: 6,

  MIN_TERMINATE_PERIODS_A: 2,
  MIN_TERMINATE_PERIODS_B: 4,

  // Legacy aliases (Plan A defaults — used by unaware code paths)
  PERIOD: 2592000,
  TOTAL: 3,
  // ----------------------------------------

  START_DELAY: 30,

  // Contracts (Base Mainnet)
  FLOW: "0x224887BdBfec85c8C5FdFF3F7376f60a6d079D84",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",

  // UI rules
  CREATOR_ADDR: "0xbf7075006db054eb108667bbe0cb15cafa9a79b0".toLowerCase(),

  // TVL cap
  // - REAL_TVL_CAP_USDC: intended production cap
  // - TVL_CAP_USDC: enforced cap for current deployment
  REAL_TVL_CAP_USDC: 60000,
  TVL_CAP_USDC: 60000,
  MAX_PRINCIPAL_USDC: 6000,

  // WalletConnect (Reown) Project ID
  WALLETCONNECT_PROJECT_ID: "fbe0b5092e4461779c51f771d7826f44",

  SCAN_BASE: "https://scan.flowvest.io",

  API_LATEST: "https://scan.flowvest.io/api/vests/latest",
  API_STATS: "https://scan.flowvest.io/api/stats"

};
