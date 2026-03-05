// assets/app/app.js
(function(){
  const state = {};

  async function connect(){
    try{
      UI.log("CONNECT CLICKED");
      await WALLET.connect(state);
      CONTRACTS.init(state);
      await READ.refreshAll(state);
      ACTIONS.updateCreatorTotals(state);
    }catch(e){
      console.error(e);
      UI.log("Connect error: " + (e?.message || String(e)));
      alert(e?.message || String(e));
    }
  }

  function disconnect(){
    try{
      WALLET.disconnect(state);
      UI.log("Disconnected.");
    }catch(e){
      console.error(e);
      UI.log("Disconnect error: " + (e?.message || String(e)));
    }
  }

  function bind(){
    // 如果有任何模块没加载，直接提示（避免“点了没反应”）
    const need = ["UI","WALLET","CONTRACTS","READ","ACTIONS","TX","C"];
    for (const k of need){
      if (!window[k]){
        console.error("[bind] missing:", k);
        alert("Boot error: missing " + k + ". Check script load order / 404.");
        return;
      }
    }

    UI.setConnected(false);
    UI.log("[app] bind ok");

    UI.$("btnConnect")?.addEventListener("click", connect);
    UI.$("btnDisconnect")?.addEventListener("click", disconnect);

    // Claim
    UI.$("btnClaim")?.addEventListener("click", ()=> ACTIONS.claim(state));

    // Creator Actions toggle
    const btnCreator = UI.$("btnCreator");
    const panel = UI.$("creatorPanel");
    if (btnCreator && panel){
      btnCreator.addEventListener("click", ()=>{
        panel.classList.toggle("hidden");
        if (!panel.classList.contains("hidden")){
          panel.scrollIntoView({behavior:"smooth", block:"start"});
        }
      });
    }

    // Creator bindings
    UI.$("ownerMonthly")?.addEventListener("input", ()=> ACTIONS.updateCreatorTotals(state));
    UI.$("ownerBeneficiary")?.addEventListener("input", ()=> ACTIONS.updateCreatorTotals(state));

    UI.$("btnOwnerApprove")?.addEventListener("click", ()=> ACTIONS.ownerApprove(state));
    UI.$("btnOwnerCreate")?.addEventListener("click", ()=> ACTIONS.ownerCreate(state));
    UI.$("btnOwnerTerminate")?.addEventListener("click", ()=> ACTIONS.ownerTerminateLatest(state));
    UI.$("ownerMonthly")?.addEventListener("input", ()=> ACTIONS.updateCreatorTotals(state));
UI.$("ownerBeneficiary")?.addEventListener("input", ()=> ACTIONS.updateCreatorTotals(state));

    // 初始化一次（会正确设置按钮 enable/disable）
    ACTIONS.updateCreatorTotals(state);

    // 自动恢复会话（可选）
    WALLET.autoConnect(state).then(()=>{
      // autoConnect 成功后，WALLET.connect 已经跑过，但合约和 read 可能没跑
      if (state.provider && state.signer){
        CONTRACTS.init(state);
        return READ.refreshAll(state).then(()=> ACTIONS.updateCreatorTotals(state));
      }
    }).catch(()=>{});
  }

  // 把所有 runtime error 打到 log（避免“静默没反应”）
  window.addEventListener("error", (e)=>{
    UI?.log?.("JS error: " + (e?.message || "unknown"));
  });

  document.addEventListener("DOMContentLoaded", bind);
  // 每30秒自动刷新，保持按钮状态最新
  setInterval(async ()=>{
    if (state?.signer) await READ.refreshAll(state);
  }, 30000);
  // 每30秒自动刷新一次，保持按钮状态最新
  setInterval(async ()=>{
    if (window._appState?.signer) await READ.refreshAll(window._appState);
  }, 30000);
})();
