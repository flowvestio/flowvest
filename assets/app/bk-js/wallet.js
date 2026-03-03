// assets/app/wallet.js
(function(){

  const $ = (id) => document.getElementById(id);

  let provider = null;
  let signer   = null;
  let addr     = null;

  // ✅ 1️⃣ 放在这里（模块内部私有函数）
  async function assertContract(provider, contractAddr, label){
    const code = await provider.getCode(contractAddr);
    if (!code || code === "0x"){
      throw new Error(`${label} not deployed on this network`);
    }
  }

  async function connect(state){
    if (!window.ethereum) throw new Error("No wallet found");

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer   = provider.getSigner();
    addr     = await signer.getAddress();

    // ✅ 2️⃣ 在这里调用
    await assertContract(provider, C.FLOW, "Flowvest");
    await assertContract(provider, C.USDC, "USDC");

    state.provider = provider;
    state.signer   = signer;
    state.addr     = addr;

    return state;
  }

  function disconnect(state){
    state.provider = null;
    state.signer   = null;
    state.addr     = null;
  }

  // ✅ 只暴露真正需要的接口
  window.WALLET = {
    connect,
    disconnect
  };

})();
