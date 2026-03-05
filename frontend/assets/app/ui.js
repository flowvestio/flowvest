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
    try { return ethers.utils.formatUnits(x, dec); }
    catch { return "0"; }
  }

  function fmtTs(sec){
    try { return new Date(Number(sec)*1000).toLocaleString(); }
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

  // Periods block (simple)
  function renderPeriods(startAtSec){
    if (!startAtSec) return clearPeriods();
    const t0 = Number(startAtSec);
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
      const btnT = $("btnOwnerTerminate");
      if (now < termFrom) {
        st.textContent = "⏳ Terminate not allowed yet";
        if (btnT) { btnT.disabled = true; btnT.style.cursor = "not-allowed"; }
      } else if (now < p3) {
        st.textContent = "🟢 Terminate allowed";
        if (btnT) { btnT.disabled = false; btnT.style.cursor = "pointer"; }
      } else {
        st.textContent = "✅ Vest completed";
        if (btnT) { btnT.disabled = false; btnT.style.cursor = "pointer"; }
      }
    }
  }

  function clearPeriods(){
    setText("p1","—");
    setText("p2","—");
    setText("p3","—");
    setText("terminateFrom","—");
    setText("terminateStatus","—");
    const btnT = $("btnOwnerTerminate");
    if (btnT) { btnT.disabled = true; btnT.style.cursor = "not-allowed"; }
  }

  // Latest 3 list
   // Latest 3 list
function renderVestList3(rows){
  const box = $("vestList3");
  if (!box) return;

  if (!rows || !rows.length){
    box.innerHTML = `<div class="text-sm text-slate-500">No vests</div>`;
    return;
  }

  const esc = (s) => String(s ?? "").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  function vestStatus(v){
    const now = Math.floor(Date.now()/1000);

    if (Number(v.is_terminated) === 1) return "🔴 terminated";

// released / principal 是字符串，必须 Number()
  if (Number(v.released) >= Number(v.principal)) return "✅ completed";

  if (now < Number(v.start_at)) return "⏳ pending";

  return "🟢 active";
  }

  box.innerHTML = rows.slice(0,3).map(r => {
    const id = esc(r.vest_id);
    const owner = shortAddr(r.owner);
    const ben = shortAddr(r.beneficiary);
    const monthly = esc(r.monthly);
    const startAt = fmtTs(r.start_at);

    const term = vestStatus(r); // ✅ 用新的状态

    return `
      <div class="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
        <div class="flex items-center justify-between">
          <div class="font-mono text-sm">#${id}</div>
          <div class="text-xs text-slate-400">${term}</div>
        </div>
        <div class="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div><span class="text-slate-400">Owner:</span> <span class="font-mono">${owner}</span></div>
          <div><span class="text-slate-400">Ben:</span> <span class="font-mono">${ben}</span></div>
          <div><span class="text-slate-400">Monthly:</span> ${monthly} USDC</div>
          <div><span class="text-slate-400">Start:</span> ${startAt}</div>
        </div>
      </div>
    `;
  }).join("");
}

  window.UI = {
    $,
    setText,
    shortAddr,
    fmtUnits,
    fmtTs,
    log,
    setConnected,
    renderPeriods,
    clearPeriods,
    renderVestList3
  };
})();
// inject terminate cursor style
(function(){
  const style = document.createElement("style");
  style.textContent = `
    #btnOwnerTerminate:disabled {
      cursor: not-allowed !important;
      pointer-events: auto !important;
    }
  `;
  document.head.appendChild(style);
})();
