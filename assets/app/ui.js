// assets/app/ui.js
(function(){
  function $(id){ return document.getElementById(id); }

  function setText(id, v){
    const el = $(id);
    if (!el) return;
    el.textContent = (v === undefined || v === null || v === "") ? "—" : String(v);
  }

  function shortAddr(a){
    a = String(a || "");
    return a ? (a.slice(0,6) + "..." + a.slice(-4)) : "—";
  }

  function fmtUnits(x, dec){
    try { return window.ethers.utils.formatUnits(x, dec); }
    catch { return "0"; }
  }

  function fmtTs(sec){
    try { return new Date(Number(sec) * 1000).toLocaleString(); }
    catch { return "—"; }
  }

  const logLines = [];
  function log(msg){
    const box = $("logBox");
    const t = new Date().toLocaleTimeString();
    logLines.push(`[${t}] ${msg}`);
    if (logLines.length > 80) logLines.shift();
    if (box){
      box.textContent = logLines.join("\n");
      box.scrollTop = box.scrollHeight;
    }
  }

  function setConnected(connected){
    const c = $("btnConnect");
    const d = $("btnDisconnect");
    if (c) c.disabled = !!connected;
    if (d) d.disabled = !connected;
  }

  // Periods & Terminate (simple)
  function renderPeriods(startAtSec){
    if (!startAtSec){ clearPeriods(); return; }

    const t0 = Number(startAtSec);
    if (!Number.isFinite(t0) || t0 <= 0){ clearPeriods(); return; }

    const p1 = t0 + C.PERIOD;
    const p2 = t0 + 2*C.PERIOD;
    const p3 = t0 + 3*C.PERIOD;
    const termFrom = t0 + 2*C.PERIOD;

    setText("p1", fmtTs(p1));
    setText("p2", fmtTs(p2));
    setText("p3", fmtTs(p3));
    setText("terminateFrom", fmtTs(termFrom));

    const now = Math.floor(Date.now()/1000);
    const st = $("terminateStatus");
    if (st){
      if (now < termFrom) st.textContent = "⏳ Terminate not allowed yet";
      else if (now < p3) st.textContent = "🟢 Terminate allowed";
      else st.textContent = "✅ Vest completed";
    }
  }

  function clearPeriods(){
    setText("p1","—");
    setText("p2","—");
    setText("p3","—");
    setText("terminateFrom","—");
    setText("terminateStatus","—");
  }

  // Vest list (latest 3 rows from API)
  function renderVestList3(rows){
    const box = $("vestList3");
    if (!box) return;

    if (!Array.isArray(rows) || rows.length === 0){
      box.innerHTML = `<div class="text-sm text-slate-500">No vests</div>`;
      return;
    }

    box.innerHTML = rows.slice(0,3).map(r => {
      const term = r.is_terminated ? "✅ terminated" : "🟢 active";
      return `
        <div class="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
          <div class="flex items-center justify-between">
            <div class="font-mono text-sm">#${r.vest_id}</div>
            <div class="text-xs text-slate-400">${term}</div>
          </div>
          <div class="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div><span class="text-slate-400">Owner:</span> <span class="font-mono">${shortAddr(r.owner)}</span></div>
            <div><span class="text-slate-400">Ben:</span> <span class="font-mono">${shortAddr(r.beneficiary)}</span></div>
            <div><span class="text-slate-400">Monthly:</span> ${r.monthly} USDC</div>
            <div><span class="text-slate-400">Start:</span> ${fmtTs(r.start_at)}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  window.UI = {
    $, setText, shortAddr, fmtUnits, fmtTs,
    log, setConnected,
    renderPeriods, clearPeriods,
    renderVestList3
  };
})();
