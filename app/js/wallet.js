(function () {

  async function getEthereum() {
    if (window.ethereum) return window.ethereum;
    return new Promise((resolve, reject) => {
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (window.ethereum) { clearInterval(t); resolve(window.ethereum); }
        if (tries > 20) { clearInterval(t); reject(new Error("No EVM wallet found. Please use MetaMask or OKX wallet browser.")); }
      }, 200);
    });
  }

  function normalizeChainId(chainId) {
    if (typeof chainId === "number") return chainId;

    if (typeof chainId === "string") {
      if (chainId.startsWith("0x") || chainId.startsWith("0X")) {
        return parseInt(chainId, 16);
      }
      return parseInt(chainId, 10);
    }

    return NaN;
  }

  async function refreshAccount() {

    const eth = await getEthereum();

    try {

      const accounts = await eth.request({ method: "eth_accounts" });
      const rawChainId = await eth.request({ method: "eth_chainId" });

      STATE.account = accounts && accounts.length ? accounts[0] : null;
      STATE.chainId = normalizeChainId(rawChainId);

      console.log("[WALLET] chainId =", rawChainId, "→", STATE.chainId);

      if (STATE.account) {
        STATE.provider = new ethers.providers.Web3Provider(eth, "any");
        STATE.signer = STATE.provider.getSigner();
      } else {
        STATE.provider = null;
        STATE.signer = null;
        STATE.flow = null;
        STATE.usdc = null;
      }

    } catch (err) {

      console.error("[WALLET] refreshAccount failed:", err);
      throw err;

    }
  }

  async function connect() {

    const eth = await getEthereum();

    try {

      //Switch to Base Sepolia; if it doesn't exist, add it automatically 
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: C.CHAIN_ID_HEX }]
        });
      } catch (switchErr) {
        if (switchErr.code === 4902 || switchErr.code === -32603) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: C.CHAIN_ID_HEX,
              chainName: C.CHAIN_NAME,
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: [C.RPC_URL],
              blockExplorerUrls: [C.EXPLORER_URL]
            }]
          });
        }
      }

      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const rawChainId = await eth.request({ method: "eth_chainId" });

      STATE.account = accounts && accounts.length ? accounts[0] : null;
      STATE.chainId = normalizeChainId(rawChainId);

      console.log("[WALLET] connect chainId =", rawChainId, "→", STATE.chainId);

      STATE.provider = new ethers.providers.Web3Provider(eth, "any");
      STATE.signer = STATE.provider.getSigner();

      return STATE.account;

    } catch (err) {

      console.error("[WALLET] connect failed:", err);
      throw err;

    }
  }

  function disconnect() {

    STATE.account = null;
    STATE.chainId = null;
    STATE.provider = null;
    STATE.signer = null;
    STATE.flow = null;
    STATE.usdc = null;

    if (window.UI?.setDisconnected) {
      UI.setDisconnected();
    }

  }

  async function bindEvents() {

    const eth = await getEthereum();

    if (eth._flowvestBound) return;
    eth._flowvestBound = true;

    eth.on("accountsChanged", async (accounts) => {

      console.log("[WALLET] accountsChanged =", accounts);

      STATE.account = accounts && accounts.length ? accounts[0] : null;

      if (STATE.account) {
        STATE.provider = new ethers.providers.Web3Provider(eth, "any");
        STATE.signer = STATE.provider.getSigner();
        const rawChainId = await eth.request({ method: "eth_chainId" });
        STATE.chainId = normalizeChainId(rawChainId);
      } else {
        STATE.chainId = null;
      }

      if (window.APP?.initAfterWalletChange) {
        await APP.initAfterWalletChange();
      }

    });

    eth.on("chainChanged", async (rawChainId) => {

      console.log("[WALLET] chainChanged =", rawChainId);

      STATE.chainId = normalizeChainId(rawChainId);

      if (window.APP?.initAfterWalletChange) {
        await APP.initAfterWalletChange();
      }

    });

  }

  window.WALLET = {
    connect,
    disconnect,
    refreshAccount,
    bindEvents
  };

})();
