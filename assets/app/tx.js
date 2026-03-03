// assets/app/tx.js
(function(){
  async function runTx(title, fn){
    UI.log(`${title}… (check wallet)`);
    try{
      const tx = await fn();
      if (!tx || !tx.hash){
        UI.log(`${title}: (no tx hash)`);
        return tx;
      }
      UI.log(`${title}: sent ${tx.hash}`);
      const rc = await tx.wait();
      if (rc && rc.status === 1) UI.log(`${title}: confirmed ✅`);
      else UI.log(`${title}: ❌ reverted (status=0)`);
      return rc;
    }catch(e){
      const msg = e?.error?.message || e?.data?.message || e?.message || String(e);
      UI.log(`${title}: ❌ ${msg}`);
      throw e;
    }
  }

  window.TX = { runTx };
})();
