// assets/app/config.js
window.C = {
  CHAIN_ID: 8453,
  CHAIN_ID_HEX: "0x2105",
  CHAIN_NAME: "Base",
  RPC_URL: "https://mainnet.base.org",
  EXPLORER_URL: "https://basescan.org",
  DECIMALS_USDC: 6,
  EXPLORER_TX: "https://basescan.org/tx/",
  EXPLORER_ADDRESS: "https://basescan.org/address/",
  OWNER: "0xbf7075006dB054Eb108667bbe0CB15CaFa9a79b0".trim(),
  TOTAL: 3,
  PERIOD: 2592000,

  START_DELAY: 30,

  // Contracts (Base mainnet)
  FLOW: "0x1C3945D7588565daB4514Cbd7772fEe329E2A12d",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base mainnet USDC

  // UI rules
  CREATOR_ADDR: "0xbf7075006db054eb108667bbe0cb15cafa9a79b0".toLowerCase(),

  // TVL cap
  // - REAL_TVL_CAP_USDC: intended production cap
  // - TVL_CAP_USDC: enforced cap for current deployment
  REAL_TVL_CAP_USDC: 20000,
  TVL_CAP_USDC: 20000,

  // WalletConnect (Reown) Project ID
  WALLETCONNECT_PROJECT_ID: "fbe0b5092e4461779c51f771d7826f44",

  API_LATEST: "https://scan.flowvest.io/api/vests/latest",
  API_STATS: "https://scan.flowvest.io/api/stats"

};
