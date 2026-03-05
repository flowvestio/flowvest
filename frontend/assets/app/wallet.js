// assets/app/wallet.js
(function(){
  async function refreshNetworkInfo(){
    if (!window.ethereum) return;
    const hex = await window.ethereum.request({ method: "eth_chainId" });
    const chainId = parseInt(hex, 16);
    const name = (chainId === C.CHAIN_ID_DEC) ? C.CHAIN_NAME : `Chain ${chainId}`;
    UI.setText("net", name);
  }

  async function ensureBaseSepolia(){
    if (!window.ethereum) throw new Error("No injected wallet found.");
    try{
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: C.CHAIN_ID_HEX }]
      });
    }catch(e){
      if (e && e.code === 4902){
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: C.CHAIN_ID_HEX,
            chainName: C.CHAIN_NAME,
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [C.RPC],
            blockExplorerUrls: [C.EXPLORER],
          }]
        });
      }else{
        throw e;
      }
    }
  }

  async function assertContract(provider, addr, label){
    const code = await provider.getCode(addr);
    if (!code || code === "0x"){
      throw new Error(`${label} not deployed on current network: ${addr}`);
    }
  }

  async function connect(state){
    if (!window.ethereum) throw new Error("No injected wallet found (MetaMask/OKX).");
    if (!window.ethers) throw new Error("ethers.js not loaded.");

    await ensureBaseSepolia();

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts || !accounts.length) throw new Error("No accounts returned.");

    const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    const signer = provider.getSigner();
    const addr = await signer.getAddress();

    await assertContract(provider, C.FLOW, "Flowvest");
    await assertContract(provider, C.USDC, "USDC");

    state.provider = provider;
    state.signer = signer;
    state.addr = addr;

    UI.setText("addr", UI.shortAddr(addr));
    UI.setConnected(true);
    await refreshNetworkInfo();
    UI.log(`Connected: ${UI.shortAddr(addr)}`);

    return state;
  }

  function disconnect(state){
    state.provider = null;
    state.signer = null;
    state.addr = null;
    state.flow = null;
    state.usdc = null;

    UI.setText("addr", "—");
    UI.setConnected(false);
    UI.log("Disconnected.");
    refreshNetworkInfo();
    READ?.stopPeriodsTick?.();
  UI.clearPeriods?.();
  }

  async function autoConnect(state){
    if (!window.ethereum) return;
    try{
      const acc = await window.ethereum.request({ method: "eth_accounts" });
      if (acc && acc.length){
        UI.log("Restoring session…");
        await connect(state);
      }
    }catch(_e){}
  }

  window.WALLET = { connect, disconnect, autoConnect, refreshNetworkInfo };
})();
