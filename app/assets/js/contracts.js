(function () {
  async function init(state) {
    if (!state?.signer) throw new Error("CONTRACTS.init: signer missing");
    if (!state?.provider) throw new Error("CONTRACTS.init: provider missing");
    if (!window.ABI) throw new Error("ABI not loaded");
    if (!window.C) throw new Error("Config not loaded");

    const flowAddr = ethers.utils.getAddress(String(C.FLOW || ""));
    const usdcAddr = ethers.utils.getAddress(String(C.USDC || ""));

    // Prefer direct RPC for reads to avoid wallet RPC throttling.
    const readProvider =
      state.readProvider ||
      new ethers.providers.JsonRpcProvider(C.RPC_URL);
    state.readProvider = readProvider;

    const readUsdc = new ethers.Contract(usdcAddr, ABI.ERC20, readProvider);

    const [flowCode, usdcCode, dec] = await Promise.all([
      readProvider.getCode(flowAddr),
      readProvider.getCode(usdcAddr),
      readUsdc.decimals(),
    ]);

    if (!flowCode || flowCode === "0x") {
      throw new Error("FLOW contract address has no code on this network");
    }
    if (!usdcCode || usdcCode === "0x") {
      throw new Error("USDC contract address has no code on this network");
    }

    const expected = Number(C.DECIMALS_USDC);
    if (Number(dec) !== expected) {
      throw new Error(`USDC decimals mismatch (got ${dec}, expected ${expected})`);
    }

    state.flow = new ethers.Contract(flowAddr, ABI.FLOW, state.signer);
    state.usdc = new ethers.Contract(usdcAddr, ABI.ERC20, state.signer);
    state.readFlow = new ethers.Contract(flowAddr, ABI.FLOW, readProvider);
    state.readUsdc = readUsdc;

    // Sync on-chain caps into C so UI reflects deployed values
    try {
      const [onChainTvlCap, onChainMaxPrincipal] = await Promise.all([
        state.readFlow.tvlCap(),
        state.readFlow.maxPrincipal(),
      ]);
      C.TVL_CAP_USDC = Number(ethers.utils.formatUnits(onChainTvlCap, C.DECIMALS_USDC));
      C.MAX_PRINCIPAL_USDC = Number(ethers.utils.formatUnits(onChainMaxPrincipal, C.DECIMALS_USDC));
    } catch (e) {
      console.warn("[CONTRACTS] failed to read tvlCap/maxPrincipal from chain", e);
    }

    UI.setText("flowAddr", flowAddr);
    UI.setText("usdcAddr", usdcAddr);
  }

  function clear(state) {
    state.flow = null;
    state.usdc = null;
    state.readFlow = null;
    state.readUsdc = null;
  }

  window.CONTRACTS = { init, clear };
})();
