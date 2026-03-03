// assets/app/app.js
console.log("boot: ethers?", !!window.ethers, "version:", window.ethers?.version);
(function () {
  window.APP = {
    state: {
      provider: null,
      signer: null,
      addr: null,
      flow: null,
      usdc: null,
    },
  };

  let _isConnecting = false;

  async function connect() {
    if (_isConnecting) return;
    _isConnecting = true;

    try {
      UI.log("CONNECT CLICKED");

      const state = window.APP.state;
      await window.WALLET.connect(state);

      UI.setConnected(true);
      UI.log(`Connected: ${UI.shortAddr(state.addr)}`);

      await window.READ.refreshAll(state);

    } catch (e) {
      console.error(e);
      alert(e?.message || String(e));
      UI.setConnected(false);
    } finally {
      _isConnecting = false;
    }
  }

  function disconnect() {
    const state = window.APP.state;

    window.WALLET.disconnect(state);
    UI.setConnected(false);

    UI.setText("net", "—");
    UI.setText("addr", "—");
    UI.setText("kpiTVL", "—");
    UI.setText("kpiVestCount", "—");
    UI.setText("kpiUsage", "—");
    UI.setText("kpiBalance", "—");
    UI.setText("kpiDue", "—");
    UI.setText("kpiDueHint", "—");
    UI.clearTimeline();

    UI.log("Disconnected.");
  }

  function bindUI() {
    // contract addrs
    UI.setText("flowAddr", C.FLOW);
    UI.setText("usdcAddr", C.USDC);

    UI.$("btnConnect")?.addEventListener("click", connect);
    UI.$("btnDisconnect")?.addEventListener("click", disconnect);
    UI.$("btnClaim")?.addEventListener("click", () => window.ACTIONS.claim(window.APP.state));

    // creator
    UI.$("btnCreator")?.addEventListener("click", () => UI.$("creatorPanel")?.classList.toggle("hidden"));
    UI.$("ownerMonthly")?.addEventListener("input", window.ACTIONS.updateCreatorTotals);
    UI.$("btnOwnerApprove")?.addEventListener("click", () => window.ACTIONS.ownerApprove(window.APP.state));
    UI.$("btnOwnerCreate")?.addEventListener("click", () => window.ACTIONS.ownerCreate(window.APP.state));
    UI.$("btnOwnerTerminate")?.addEventListener("click", () => window.ACTIONS.ownerTerminate(window.APP.state));
    window.ACTIONS.updateCreatorTotals();

    window.WALLET.bindListenersOnce(() => {
      disconnect();
      UI.log("Account/Network changed. Please connect again.");
    });

    UI.setConnected(false);
    UI.log("Ready.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUI);
  } else {
    bindUI();
  }
})();
