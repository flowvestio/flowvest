// assets/app/tx.js
(function () {
  async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  async function safeGetReceipt(provider, hash, tries = 6){
    for (let i = 0; i < tries; i++){
      try{
        const rcpt = await provider.getTransactionReceipt(hash);
        if (rcpt) return rcpt;
      }catch(_e){}
      await sleep(1200);
    }
    return null;
  }

  window.runTx = async function runTx(label, fn, state) {
    UI.log(`${label}… (check wallet)`);

    let tx;
    try{
      tx = await fn();
    }catch(e){
      const msg = e?.error?.message || e?.data?.message || e?.message || String(e);
      UI.log(`${label}: ❌ ${msg}`);
      throw e;
    }

    // tx 已发送就先显示 hash
    UI.log(`${label}: sent ${tx.hash}`);

    // 1) 优先正常 wait
    try{
      const rcpt = await tx.wait();
      if (rcpt?.status === 1){
        UI.log(`${label}: confirmed ✅`);
        return rcpt;
      }
      throw new Error("Transaction failed (status != 1)");
    }catch(e){
      // 2) wait 失败 → 用 provider 查 receipt 兜底
      const provider =
        state?.provider ||
        tx?.provider ||
        window.APP?.state?.provider;

      if (!provider){
        const msg = e?.error?.message || e?.data?.message || e?.message || String(e);
        UI.log(`${label}: ⚠️ wait failed; no provider to verify. ${msg}`);
        throw e;
      }

      const rcpt = await safeGetReceipt(provider, tx.hash);
      if (rcpt && rcpt.status === 1){
        UI.log(`${label}: confirmed ✅ (verified by receipt)`);
        return rcpt;
      }

      const msg = e?.error?.message || e?.data?.message || e?.message || String(e);
      UI.log(`${label}: ❌ ${msg}`);
      throw e;
    }
  };
})();
