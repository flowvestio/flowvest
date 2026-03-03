// assets/app/app.js
(function(){
  const state = {};

  async function connect(){
    try{
      UI.log("CONNECT CLICKED");
      await WALLET.connect(state);
      CONTRACTS.attach(state);
      await READ.refreshAll(state);
    }catch(e){
      console.error(e);
      alert(e?.message || String(e));
    }
  }

  function disconnect(){
    WALLET.disconnect(state);
  }

  async function onClaim(){
    try{ await ACTIONS.claim(state); }
    catch(e){ console.error(e); alert(e?.message || String(e)); }
  }

  async function onApprove(){
    try{ await ACTIONS.ownerApprove(state); }
    catch(e){ console.error(e); alert(e?.message || String(e)); }
  }

  async function onCreate(){
    try{ await ACTIONS.ownerCreate(state); }
    catch(e){ console.error(e); alert(e?.message || String(e)); }
  }

  async function onTerminate(){
    try{ await ACTIONS.ownerTerminateLatest(state); }
    catch(e){ console.error(e); alert(e?.message || String(e)); }
  }

  function bind(){
    UI.setConnected(false);
    WALLET.refreshNetworkInfo().catch(()=>{});

    UI.$("btnConnect")?.addEventListener("click", connect);
    UI.$("btnDisconnect")?.addEventListener("click", disconnect);
    UI.$("btnClaim")?.addEventListener("click", onClaim);

    UI.$("ownerMonthly")?.addEventListener("input", ACTIONS.updateCreatorTotals);
    ACTIONS.updateCreatorTotals();

    UI.$("btnOwnerApprove")?.addEventListener("click", onApprove);
    UI.$("btnOwnerCreate")?.addEventListener("click", onCreate);
    UI.$("btnOwnerTerminate")?.addEventListener("click", onTerminate);

    WALLET.autoConnect(state).then(()=>{
      if (state.addr){
        CONTRACTS.attach(state);
        return READ.refreshAll(state);
      }
    }).catch(()=>{});
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
