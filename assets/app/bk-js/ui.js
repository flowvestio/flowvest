// assets/app/ui.js
(function () {
  const $ = (id) => document.getElementById(id);

  const UI = {
    $,
    logLines: [],

    setText(id, v) {
      const el = $(id);
      if (el) el.textContent = v;
    },

    setHTML(id, html) {
      const el = $(id);
      if (el) el.innerHTML = html;
    },

    log(msg) {
      const box = $("logBox");
      if (!box) return;
      const t = new Date().toLocaleTimeString();
      UI.logLines.push(`[${t}] ${msg}`);
      if (UI.logLines.length > 60) UI.logLines.shift();
      box.textContent = UI.logLines.join("\n");
      box.scrollTop = box.scrollHeight;
    },

    shortAddr(a) {
      return a ? a.slice(0, 6) + "..." + a.slice(-4) : "—";
    },

    fmtUnits(x, dec) {
      try {
        return window.ethers.utils.formatUnits(x, dec);
      } catch {
        return "0";
      }
    },

    clamp(n, a, b) {
      return Math.max(a, Math.min(b, n));
    },

    fmtTs(sec) {
      try {
        return new Date(Number(sec) * 1000).toLocaleString();
      } catch {
        return "—";
      }
    },

    setConnected(connected) {
      const btnC = $("btnConnect");
      const btnD = $("btnDisconnect");
      const btnClaim = $("btnClaim");

      if (btnC) btnC.disabled = !!connected;
      if (btnD) btnD.disabled = !connected;
      if (btnClaim) btnClaim.disabled = !connected;

      // disconnect 时隐藏 creator
      if (!connected) {
        $("btnCreator")?.classList.add("hidden");
        $("creatorPanel")?.classList.add("hidden");
      }
    },

    // 只渲染 timeline（不发链请求）
    renderV1Timeline(startAtSec, PERIOD, TOTAL) {
      const t0 = Number(startAtSec);
      if (!Number.isFinite(t0) || t0 <= 0) return;

      const t1 = t0 + PERIOD;
      const tTerminate = t0 + 2 * PERIOD;
      const tEnd = t0 + TOTAL * PERIOD;

      UI.setText("tlStart", UI.fmtTs(t0));
      UI.setText("tlP1", UI.fmtTs(t1));
      UI.setText("tlTerminate", UI.fmtTs(tTerminate));
      UI.setText("tlEnd", UI.fmtTs(tEnd));

      const denom = (tEnd - t0);
      if (denom > 0) {
        const now = Math.floor(Date.now() / 1000);
        const pct = UI.clamp(((now - t0) / denom) * 100, 0, 100);

        const fill = $("tlFill");
        if (fill) fill.style.width = `${pct}%`;

        const st = $("kpiTerminateStatus");
        if (st) {
          if (now < tTerminate) st.textContent = "⏳ Terminate not allowed yet";
          else if (now < tEnd) st.textContent = "ð¢ Terminate allowed";
          else st.textContent = "✅ Vest completed";
        }
      }
    },

    clearTimeline() {
      UI.setText("kpiTerminateStatus", "—");
      UI.setText("tlStart", "—");
      UI.setText("tlP1", "—");
      UI.setText("tlTerminate", "—");
      UI.setText("tlEnd", "—");
      const fill = $("tlFill");
      if (fill) fill.style.width = "0%";
    },
  };

  window.UI = UI;
})();
