(function () {
  function patchEthersFormatter() {
    const proto = window.ethers?.providers?.Formatter?.prototype;
    if (!proto || proto.__flowvestPatched) return;
    proto.__flowvestPatched = true;

    const missing = (value) => value == null || value === "undefined" || value === "null";
    const normalizeTx = (tx) => {
      if (!tx || typeof tx !== "object") return tx;
      const normalized = { ...tx };
      Object.keys(normalized).forEach((key) => {
        if (normalized[key] === undefined) delete normalized[key];
      });
      if (missing(normalized.value)) normalized.value = "0x0";
      if (missing(normalized.gasLimit)) normalized.gasLimit = normalized.gas ?? normalized.gas_limit ?? "0x0";
      if (missing(normalized.gasPrice) && !missing(normalized.maxFeePerGas)) normalized.gasPrice = normalized.maxFeePerGas;
      if (missing(normalized.maxFeePerGas)) delete normalized.maxFeePerGas;
      if (missing(normalized.maxPriorityFeePerGas)) delete normalized.maxPriorityFeePerGas;
      return normalized;
    };

    const origCheck = proto.check;
    proto.check = function(format, object) {
      return origCheck.call(this, format, normalizeTx(object));
    };

    const origNumber = proto.number;
    if (origNumber) {
      proto.number = function(value) {
        return origNumber.call(this, missing(value) ? "0x0" : value);
      };
    }

    const origTxResponse = proto.transactionResponse;
    proto.transactionResponse = function(transaction) {
      return origTxResponse.call(this, normalizeTx(transaction));
    };
  }

  patchEthersFormatter();

  let wcProvider = null;
  let wcLastUri = null;

  /** OKX Wallet in-app browser exposes `okxwallet.ethereum`; `ethereum` may appear later. */
  function pickInjectedProvider() {
    try {
      if (window.okxwallet && window.okxwallet.ethereum) {
        return window.okxwallet.ethereum;
      }
    } catch (_) {}
    if (window.ethereum) return window.ethereum;
    return null;
  }

  async function getEthereum() {
    if (STATE.walletTransport === "walletconnect" && wcProvider) return wcProvider;
    const immediate = pickInjectedProvider();
    if (immediate) return immediate;
    return new Promise((resolve, reject) => {
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        const p = pickInjectedProvider();
        if (p) {
          clearInterval(t);
          resolve(p);
        }
        if (tries > 30) {
          clearInterval(t);
          reject(new Error("未检测到 EVM 钱包，请使用 MetaMask 或 OKX 钱包内置浏览器打开。"));
        }
      }, 200);
    });
  }

  function normalizeChainId(chainId) {
    if (chainId == null || chainId === "") return NaN;
    if (typeof chainId === "bigint") return Number(chainId);
    if (typeof chainId === "number") {
      return Number.isFinite(chainId) ? chainId : NaN;
    }
    let s = String(chainId).trim();
    // WalletConnect / CAIP-2: "eip155:84532"
    if (s.includes(":")) {
      s = s.split(":").pop() || s;
    }
    if (s.startsWith("0x") || s.startsWith("0X")) {
      const n = parseInt(s, 16);
      return Number.isFinite(n) ? n : NaN;
    }
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : NaN;
  }

  /** Ask wallet (injected or WalletConnect) to use the app network (e.g. Base Sepolia). */
  async function switchToAppChain(eth) {
    if (!eth?.request) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: C.CHAIN_ID_HEX }],
      });
    } catch (switchErr) {
      console.log("[WALLET] switchErr code =", switchErr.code, switchErr.message);
      if (switchErr.code === 4902 || switchErr.code === -32603) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: C.CHAIN_ID_HEX,
              chainName: C.CHAIN_NAME,
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: [C.RPC_URL],
              blockExplorerUrls: [C.EXPLORER_URL],
            },
          ],
        });
      }
    }
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
          STATE.readProvider = new ethers.providers.JsonRpcProvider(C.RPC_URL);
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
      await switchToAppChain(eth);

      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const rawChainId = await eth.request({ method: "eth_chainId" });

      STATE.account = accounts && accounts.length ? accounts[0] : null;
      STATE.chainId = normalizeChainId(rawChainId);

      console.log("[WALLET] connect chainId =", rawChainId, "→", STATE.chainId);

      STATE.provider = new ethers.providers.Web3Provider(eth, "any");
      STATE.signer = STATE.provider.getSigner();
      try {
        STATE.readProvider = new ethers.providers.JsonRpcProvider(C.RPC_URL);
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
        // Some wallets (OKX in particular) display "Unknown project" when dapp metadata
        // is missing/incomplete. Use an absolute https URL + stable app origin.
        const appOrigin = "https://app.flowvest.io";
        const iconUrl = `${appOrigin}/assets/logo/flowvest-logo.png`;
        wcProvider = await EthereumProvider.init({
          projectId,
          // Use `chains` for the required chain; more compatible than only optionalChains.
          chains: [Number(C.CHAIN_ID)],
          methods: [
            "eth_sendTransaction",
            "personal_sign",
            "eth_signTypedData",
            "eth_signTypedData_v4",
          ],
          optionalMethods: [
            "eth_accounts",
            "eth_chainId",
            "wallet_switchEthereumChain",
            "wallet_addEthereumChain",
          ],
          // We'll render QR ourselves in the UI (display_uri).
          showQrModal: false,
          rpcMap: { [Number(C.CHAIN_ID)]: String(C.RPC_URL) },
          metadata: {
            name: "Flowvest",
            description: "Flowvest V1.1",
            url: appOrigin,
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
            // Do not only patch STATE.account: MetaMask / WC often fires this before
            // connect()'s refreshAccount() runs. Without Web3Provider + getSigner(),
            // CONTRACTS.init sees signer missing while the header already shows an address.
            try {
              await refreshAccount();
            } catch (e) {
              console.warn("[WALLET] wc accountsChanged refreshAccount failed:", e);
            }
            if (window.APP?.initAfterWalletChange) {
              await APP.initAfterWalletChange();
            }
          });
          wcProvider.on("chainChanged", async (rawChainId) => {
            console.log("[WALLET] wc chainChanged =", rawChainId);
            try {
              await refreshAccount();
            } catch (e) {
              console.warn("[WALLET] wc chainChanged refreshAccount failed:", e);
            }
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

      const withTimeout = async (promise, ms, msg) => {
        let t = null;
        try {
          return await Promise.race([
            promise,
            new Promise((_, reject) => {
              t = setTimeout(() => reject(new Error(msg)), ms);
            }),
          ]);
        } finally {
          if (t) clearTimeout(t);
        }
      };

      // IMPORTANT: Don't request accounts twice. Some wallets (e.g. OKX) can hang
      // if `eth_requestAccounts` is called again while the approval UI is still finishing.
      if (!wcProvider.session) {
        // If we already have a URI from previous attempt, surface it immediately.
        if (wcLastUri && typeof opts.onDisplayUri === "function") {
          try { opts.onDisplayUri(wcLastUri); } catch (_) {}
        }
        await withTimeout(
          wcProvider.connect(),
          25000,
          "WalletConnect connection timed out. If OKX keeps spinning, try the OKX in-app browser or tap “Open OKX”, then approve again."
        );
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
        // Allow a bit longer for OKX / mobile QR.
        for (let i = 0; i < 25 && !accounts.length; i++) {
          await new Promise((r) => setTimeout(r, 250));
          accounts = Array.isArray(wcProvider.accounts) ? wcProvider.accounts : [];
        }
      }
      if (!accounts.length) {
        throw new Error(
          "WalletConnect connected but no account was returned. If you are scanning with OKX, approve the connection in OKX, or use the OKX in-app browser."
        );
      }
      // MetaMask QR often leaves the session on Ethereum mainnet unless we explicitly
      // switch — same as injected `connect()`.
      try {
        await switchToAppChain(wcProvider);
      } catch (e) {
        console.warn("[WALLET] WC switchToAppChain:", e);
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
    STATE.walletTransport = null;
    STATE.protocolTvlNum = null;

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
          STATE.readProvider = new ethers.providers.JsonRpcProvider(C.RPC_URL);
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
    },
    okxDeepLink: function (uri) {
      const u = String(uri || "");
      if (!u) return "";
      return `okx://wc?uri=${encodeURIComponent(u)}`;
    }
  };

})();
