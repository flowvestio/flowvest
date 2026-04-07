(function () {

  let wcProvider = null;
  let wcLastUri = null;

  async function getEthereum() {
    if (STATE.walletTransport === "walletconnect" && wcProvider) return wcProvider;
    if (window.ethereum) return window.ethereum;
    return new Promise((resolve, reject) => {
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (window.ethereum) { clearInterval(t); resolve(window.ethereum); }
        if (tries > 20) { clearInterval(t); reject(new Error("未检测到 EVM 钱包，请使用 MetaMask 或 OKX 钱包内置浏览器打开。")); }
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
        // Use a direct RPC for reads to avoid wallet RPC rate limits (MetaMask 429).
        try {
          STATE.readProvider = new ethers.providers.JsonRpcBatchProvider(C.RPC_URL);
        } catch (e) {
          console.warn("[WALLET] readProvider init failed:", e);
          STATE.readProvider = null;
        }
      } else {
        STATE.provider = null;
        STATE.signer = null;
        STATE.flow = null;
        STATE.usdc = null;
        STATE.readProvider = null;
        STATE.readFlow = null;
        STATE.readUsdc = null;
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
	  console.log("[WALLET] switchErr code =", switchErr.code, switchErr.message);

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
      try {
        STATE.readProvider = new ethers.providers.JsonRpcBatchProvider(C.RPC_URL);
      } catch (e) {
        console.warn("[WALLET] readProvider init failed:", e);
        STATE.readProvider = null;
      }

      return STATE.account;

    } catch (err) {

      console.error("[WALLET] connect failed:", err);
      // -32002: a wallet_requestPermissions/eth_requestAccounts is already pending
      if (err.code === -32002 || (err.message && err.message.includes("already pending"))) {
        throw new Error("钱包连接请求已发出，请打开 MetaMask 或 OKX 钱包 App 确认授权。");
      }
      throw err;

    }
  }

  async function connectWalletConnect(opts = {}) {
    try {
      const mod = window["@walletconnect/ethereum-provider"];
      const EthereumProvider = mod?.EthereumProvider || mod?.default?.EthereumProvider || mod?.default || mod;
      if (!EthereumProvider?.init) {
        throw new Error("WalletConnect SDK not loaded");
      }

      const projectId = String(C.WALLETCONNECT_PROJECT_ID || "").trim();
      if (!projectId) {
        throw new Error("Missing WalletConnect Project ID");
      }

      if (!wcProvider) {
        const iconUrl = `${location.origin}/assets/logo/flowvest-logo.png`;
        wcProvider = await EthereumProvider.init({
          projectId,
          // Use `chains` for the required chain; more compatible than only optionalChains.
          chains: [Number(C.CHAIN_ID)],
          // We'll render QR ourselves in the UI (display_uri).
          showQrModal: false,
          rpcMap: { [Number(C.CHAIN_ID)]: String(C.RPC_URL) },
          metadata: {
            name: "Flowvest",
            description: "Flowvest V1",
            url: location.origin,
            icons: [iconUrl]
          }
        });

        // Save latest URI for custom QR rendering.
        wcProvider.on("display_uri", (uri) => {
          wcLastUri = String(uri || "");
          try {
            if (typeof opts.onDisplayUri === "function") {
              opts.onDisplayUri(wcLastUri);
            }
          } catch (_) {}
        });

        // Ensure UI updates on WalletConnect session changes.
        try {
          wcProvider.on("accountsChanged", async (accounts) => {
            console.log("[WALLET] wc accountsChanged =", accounts);
            STATE.account = accounts && accounts.length ? accounts[0] : null;
            try {
              const rawChainId =
                wcProvider.chainId != null
                  ? String(wcProvider.chainId)
                  : await wcProvider.request({ method: "eth_chainId" });
              STATE.chainId = normalizeChainId(rawChainId);
            } catch (_) {}
            if (window.APP?.initAfterWalletChange) {
              await APP.initAfterWalletChange();
            }
          });
          wcProvider.on("chainChanged", async (rawChainId) => {
            console.log("[WALLET] wc chainChanged =", rawChainId);
            STATE.chainId = normalizeChainId(rawChainId);
            if (window.APP?.initAfterWalletChange) {
              await APP.initAfterWalletChange();
            }
          });
          wcProvider.on("disconnect", async () => {
            console.log("[WALLET] wc disconnected");
            disconnect();
          });
          wcProvider.on("session_delete", async () => {
            console.log("[WALLET] wc session deleted");
            disconnect();
          });
        } catch (e) {
          console.warn("[WALLET] wc event bind failed:", e);
        }
      }

      STATE.walletTransport = "walletconnect";

      // IMPORTANT: Don't request accounts twice. Some wallets (e.g. OKX) can hang
      // if `eth_requestAccounts` is called again while the approval UI is still finishing.
      if (!wcProvider.session) {
        // If we already have a URI from previous attempt, surface it immediately.
        if (wcLastUri && typeof opts.onDisplayUri === "function") {
          try { opts.onDisplayUri(wcLastUri); } catch (_) {}
        }
        await wcProvider.connect();
      }

      // Hard sync: request accounts directly (more reliable than wcProvider.accounts on some wallets).
      try {
        const reqAccounts = await wcProvider.request({ method: "eth_accounts" });
        if (Array.isArray(reqAccounts) && reqAccounts.length) {
          wcProvider.accounts = reqAccounts;
        }
      } catch (_) {}

      // Some mobile wallets report session connected slightly before accounts are available.
      // Wait briefly for accounts to populate.
      let accounts = Array.isArray(wcProvider.accounts) ? wcProvider.accounts : [];
      if (!accounts.length) {
        for (let i = 0; i < 15 && !accounts.length; i++) {
          await new Promise((r) => setTimeout(r, 200));
          accounts = Array.isArray(wcProvider.accounts) ? wcProvider.accounts : [];
        }
      }
      // Force-refresh state using unified refreshAccount() (uses eth_accounts/eth_chainId).
      await refreshAccount();

      return STATE.account;
    } catch (err) {
      console.error("[WALLET] WalletConnect connect failed:", err);
      throw err;
    }
  }

  function disconnect() {
    try {
      if (STATE.walletTransport === "walletconnect" && wcProvider?.disconnect) {
        wcProvider.disconnect();
      }
    } catch (_) {}

    STATE.account = null;
    STATE.chainId = null;
    STATE.provider = null;
    STATE.signer = null;
    STATE.flow = null;
    STATE.usdc = null;
    STATE.readProvider = null;
    STATE.readFlow = null;
    STATE.readUsdc = null;

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

      // OKX wallet sometimes fires accountsChanged([]) spuriously while still connected.
      // Re-verify before treating as disconnect.
      let resolvedAccounts = accounts;
      if (!resolvedAccounts || !resolvedAccounts.length) {
        try {
          const verified = await eth.request({ method: "eth_accounts" });
          if (verified && verified.length) {
            console.log("[WALLET] accountsChanged spurious, re-verified =", verified);
            resolvedAccounts = verified;
          }
        } catch (_) {}
      }

      STATE.account = resolvedAccounts && resolvedAccounts.length ? resolvedAccounts[0] : null;

      if (STATE.account) {
        STATE.provider = new ethers.providers.Web3Provider(eth, "any");
        STATE.signer = STATE.provider.getSigner();
        try {
          STATE.readProvider = new ethers.providers.JsonRpcBatchProvider(C.RPC_URL);
        } catch (e) {
          console.warn("[WALLET] readProvider init failed:", e);
          STATE.readProvider = null;
        }
        const rawChainId = await eth.request({ method: "eth_chainId" });
        STATE.chainId = normalizeChainId(rawChainId);
      } else {
        STATE.chainId = null;
        STATE.readProvider = null;
        STATE.readFlow = null;
        STATE.readUsdc = null;
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
    connectWalletConnect,
    disconnect,
    refreshAccount,
    bindEvents,
    getWalletConnectUri: function () {
      return wcLastUri || "";
    },
    metamaskDeepLink: function (uri) {
      const u = String(uri || "");
      if (!u) return "";
      return `https://metamask.app.link/wc?uri=${encodeURIComponent(u)}`;
    }
  };

})();
