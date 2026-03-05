// assets/app/tx.js
(function(){
  async function runTx(label, fn){
    UI.log(`${label}… (check wallet)`);
    let tx;
    try{
      tx = await fn();
    }catch(e){
      UI.log(`${label}: ❌ ${e?.message || String(e)}`);
      throw e;
    }
    UI.log(`${label}: sent ${tx.hash}`);
    const r = await tx.wait();
    UI.log(`${label}: confirmed ✅`);
    return r;
  }

  window.TX = { runTx };
})();
