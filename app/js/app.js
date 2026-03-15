(function () {
  let statsTimer = null;
  let ownerVestPage = 1;
  let ownerVestTimer = null;
  let refreshRunning = false;
  const OWNER_VEST_PAGE_SIZE = 5;

  async function refreshStats() {
    try {
      if (!STATE.flow) return;

      const stats = await FLOW.loadStats();
      UI.updateStatsUI(stats);
      await FLOW.refreshView();
    } catch (err) {
      console.error("[APP] refreshStats error:", err);
    }
  }

 function startAutoRefresh() {
  if (statsTimer) clearInterval(statsTimer);

  statsTimer = setInterval(async () => {
    if (document.hidden) return;
    if (!STATE.account) return;
    if (refreshRunning) return;

    refreshRunning = true;
    try {
      await refreshStats();
      await FLOW.refreshView();
      await renderOwnerVestList(ownerVestPage);
    } finally {
      refreshRunning = false;
    }
  }, 5000);
}
  async function connectWallet() {
    try {
      UI.setBusy(true);

      await WALLET.connect();
      UI.log("Wallet connected");

      if (Number(STATE.chainId) !== Number(C.CHAIN_ID)) {
        UI.showError(`Please switch to ${C.CHAIN_NAME}`);
        return;
      }

      CONTRACTS.init(STATE);
      UI.setConnected();

      await refreshStats();
      await FLOW.refreshView();
      await renderOwnerVestList(1);

      setTimeout(refreshStats, 3000);
      setTimeout(refreshStats, 8000);
      setTimeout(refreshStats, 15000);

      updateCreatorFormState();
      updateOwnerVestLink();
    } catch (e) {
      console.error("[APP] connectWallet error:", e);
      UI.showError(e.message || String(e));
    } finally {
      UI.setBusy(false);
    }
  }

//read summary API	
async function loadAddressSummary() {
  if (!STATE.account) return null;

  const r = await fetch(
    `https://scan.flowvest.io/api/address/${STATE.account}/summary?t=${Date.now()}`
  );

  if (!r.ok) {
    throw new Error("summary fetch failed");
  }

  return await r.json();
}

  function bindWalletActions() {
    const btnWallet = document.getElementById("btnWallet");
    const btnCopyAddress = document.getElementById("btnCopyAddress");
    const btnViewExplorer = document.getElementById("btnViewExplorer");
    const btnDisconnect = document.getElementById("btnDisconnect");

    if (btnWallet) {
      btnWallet.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (STATE.account) {
          UI.toggleWalletMenu();
        } else {
          await connectWallet();
        }
      });
    }

    if (btnCopyAddress) {
      btnCopyAddress.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!STATE.account) return;

        try {
          await navigator.clipboard.writeText(STATE.account);
          UI.showSuccess("Address copied");
          UI.closeWalletMenu();
        } catch (err) {
          UI.showError("Failed to copy address");
        }
      });
    }

    if (btnViewExplorer) {
      btnViewExplorer.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!STATE.account) return;

        const url = UTILS.addressUrl(STATE.account);
        window.open(url, "_blank");
        UI.closeWalletMenu();
      });
    }

    if (btnDisconnect) {
      btnDisconnect.addEventListener("click", async () => {
        WALLET.disconnect();
        UI.log("Wallet disconnected");

        UI.closeWalletMenu();

        await refreshStats();
        await renderOwnerVestList(1);
        updateCreatorFormState();
	updateOwnerVestLink();
      });
    }

    document.addEventListener("click", (e) => {
      const menu = document.getElementById("walletMenu");
      const btn = document.getElementById("btnWallet");

      if (!menu || !btn) return;

      if (!menu.contains(e.target) && !btn.contains(e.target)) {
        UI.closeWalletMenu();
      }
    });
  }

  function isValidAddress(addr) {
    try {
      return !!addr && ethers.utils.isAddress(addr.trim());
    } catch {
      return false;
    }
  }
  
  function updateOwnerVestLink() {
  const link = document.getElementById("viewOwnerVestsLink");
  if (!link) return;

  if (STATE.account) {
    link.href = `https://scan.flowvest.io/viewowner.html?addr=${STATE.account}`;
    link.style.pointerEvents = "auto";
    link.style.opacity = "1";
  } else {
    link.href = "#";
    link.style.pointerEvents = "none";
    link.style.opacity = "0.5";
  }
}
  function updateCreatorFormState() {
    const ownerMonthly = document.getElementById("ownerMonthly");
    const ownerTotal = document.getElementById("ownerTotal");
    const ownerBeneficiary = document.getElementById("ownerBeneficiary");

    const btnApprove = document.getElementById("btnOwnerApprove");
    const btnCreate = document.getElementById("btnOwnerCreate");

    const monthly = ownerMonthly?.value?.trim() || "";
    const beneficiary = ownerBeneficiary?.value?.trim() || "";

    const monthlyNum = Number(monthly);
    const total = monthlyNum * 3;

    const monthlyValid =
      Number.isFinite(monthlyNum) &&
      total >= 200 &&
      total <= 10000;

    const onRightChain = Number(STATE.chainId) === Number(C.CHAIN_ID);

    if (ownerTotal) {
      if (!monthlyNum || monthlyNum <= 0) {
        ownerTotal.textContent = "—";
      } else if (total < 200) {
        ownerTotal.textContent = `${total.toFixed(2)} (min 200 USDC)`;
      } else if (total > 10000) {
        ownerTotal.textContent = `${total.toFixed(2)} (max 10,000 USDC)`;
      } else {
        ownerTotal.textContent = total.toFixed(2);
      }
    }

    if (btnApprove) {
      btnApprove.disabled = !monthlyValid || !STATE.account || !onRightChain;
    }

    if (btnCreate) {
      btnCreate.disabled =
        !monthlyValid ||
        !isValidAddress(beneficiary) ||
        !STATE.account ||
        !onRightChain;
    }
  }

  function shortAddr(a) {
    a = String(a || "");
    return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "—";
  }

  function fmtCountdown(sec) {
    const s = Math.max(Number(sec || 0), 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  async function loadOwnerVests(page = 1) {
    if (!STATE.account) {
      return { total: 0, page: 1, limit: OWNER_VEST_PAGE_SIZE, data: [] };
    }

    const url =
      `https://scan.flowvest.io/api/owner-vests` +
      `?owner=${STATE.account}` +
      `&page=${page}` +
      `&limit=${OWNER_VEST_PAGE_SIZE}` +
      `&t=${Date.now()}`;

    const r = await fetch(url);

    if (!r.ok) {
      throw new Error("Failed to load owner vests");
    }

    return await r.json();
  }

  window.pasteAddress = async function () {
  const input = document.getElementById("ownerBeneficiary");
  if (!input) return;

  input.focus();

  try {
    const text = await navigator.clipboard.readText();

    if (text && text.trim()) {
      input.value = text.trim();

      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));

      updateCreatorFormState();
      return;
    }
  } catch (e) {
    console.warn("[APP] Clipboard read blocked:", e);
  }

  // fallback 
  UI.showInfo("Clipboard blocked. Long-press the input field to paste.");
};

  async function renderOwnerVestList(page = 1) {
    const box = document.getElementById("ownerVestList");
    if (!box) return;

    ownerVestPage = page;

    if (!STATE.account || Number(STATE.chainId) !== Number(C.CHAIN_ID)) {
      box.innerHTML = `
        <div class="text-sm text-slate-500">
          Connect wallet on ${C.CHAIN_NAME} to view owner vests.
        </div>
      `;
      return;
    }

    try {
      const res = await loadOwnerVests(page);
      const rows = Array.isArray(res.data) ? res.data : [];
      const total = Number(res.total || 0);
      const limit = Number(res.limit || OWNER_VEST_PAGE_SIZE);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      box.innerHTML = "";

      if (!rows.length) {
        box.innerHTML = `
          <div class="text-sm text-slate-500">
            No owner vests found.
          </div>
        `;
        return;
      }

      rows.forEach((v) => {
        const vestId = v.vest_id ?? v.id;
        const beneficiary = v.beneficiary || "";
        const monthly = Number(v.monthly || 0);

        let actionHtml = "";

        if (v.terminate_ready === true) {
          actionHtml = `
            <button
              class="terminate-row-btn px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm"
              data-vest-id="${vestId}"
            >
              Terminate
            </button>
          `;
        } else if (v.terminate_seconds_left != null && Number(v.terminate_seconds_left) > 0) {
          actionHtml = `
            <div class="text-sm text-amber-400">
              terminate in ${fmtCountdown(v.terminate_seconds_left)}
            </div>
          `;
        } else if (v.status === "completed") {
          actionHtml = `
            <div class="text-sm text-emerald-400">
              completed
            </div>
          `;
        } else if (v.status === "terminated") {
          actionHtml = `
            <div class="text-sm text-rose-400">
              terminated
            </div>
          `;
        } else if (v.terminate_reason) {
          actionHtml = `
            <div class="text-sm text-slate-500">
              ${v.terminate_reason}
            </div>
          `;
        } else {
          actionHtml = `
            <div class="text-sm text-slate-500">
              ${v.status || "active"}
            </div>
          `;
        }

        box.innerHTML += `
          <div class="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-3">
            <div>
	       <div class="text-slate-100 font-medium">
  <a
    href="https://scan.flowvest.io/vest.html?id=${vestId}"
    target="_blank"
    class="hover:text-cyan-400 underline"
  >
    Vest #${vestId} ↗
  </a>
</div>
              <div class="text-sm text-slate-400 mt-1">
                Beneficiary ${shortAddr(beneficiary)} · Monthly ${monthly.toFixed(1)} USDC
              </div>
            </div>
            <div>
              ${actionHtml}
            </div>
          </div>
        `;
      });

      box.innerHTML += `
        <div class="flex justify-center gap-4 mt-4 text-sm">
          <button
            id="ownerVestPrev"
            class="px-3 py-1 bg-slate-800 rounded disabled:opacity-40"
            ${page === 1 ? "disabled" : ""}
          >
            Prev
          </button>

          <span class="text-slate-400">
            Page ${page} / ${totalPages}
          </span>

          <button
            id="ownerVestNext"
            class="px-3 py-1 bg-slate-800 rounded disabled:opacity-40"
            ${page >= totalPages ? "disabled" : ""}
          >
            Next
          </button>
        </div>
      `;

      box.querySelectorAll(".terminate-row-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const vestId = btn.getAttribute("data-vest-id");

          try {
            await FLOW.terminateVest(vestId);
            UI.log(`Vest #${vestId} terminated`);
            await refreshStats();
            await renderOwnerVestList(ownerVestPage);
          } catch (err) {
            console.error("[APP] terminate row failed:", err);
            UI.log(`Terminate failed: ${UTILS.safeError(err)}`);
            UI.showError(UTILS.safeError(err));
          }
        });
      });

      const prev = document.getElementById("ownerVestPrev");
      const next = document.getElementById("ownerVestNext");

      if (prev) {
        prev.onclick = async () => {
          if (ownerVestPage > 1) {
            await renderOwnerVestList(ownerVestPage - 1);
          }
        };
      }

      if (next) {
        next.onclick = async () => {
          if (ownerVestPage < totalPages) {
            await renderOwnerVestList(ownerVestPage + 1);
          }
        };
      }

    } catch (err) {
      console.error("[APP] renderOwnerVestList failed:", err);

      box.innerHTML = `
        <div class="text-sm text-rose-400">
          Failed to load owner vests.
        </div>
      `;
    }
  }

  function bindBusinessActions() {
    const btnClaim = document.getElementById("btnClaim");
    const ownerMonthly = document.getElementById("ownerMonthly");
    const ownerBeneficiary = document.getElementById("ownerBeneficiary");

    const btnApprove = document.getElementById("btnOwnerApprove");
    const btnCreate = document.getElementById("btnOwnerCreate");

    if (ownerMonthly) {
      ownerMonthly.addEventListener("input", updateCreatorFormState);
    }

    if (ownerBeneficiary) {
      ownerBeneficiary.addEventListener("input", updateCreatorFormState);
    }

    if (btnApprove) {
      btnApprove.addEventListener("click", async () => {
        try {
          const monthly = ownerMonthly?.value?.trim() || "";
          const monthlyAmount = UTILS.parseAmount(monthly, C.DECIMALS_USDC);
          const totalPrincipal = monthlyAmount.mul(3);

          await TX.send(
            () => STATE.usdc.approve(C.FLOW, totalPrincipal),
            {
              pendingText: "Approving USDC...<br>Please confirm the transaction in your wallet.",
	      successText: "✓ USDC approval confirmed<br>You can now create your vest."

            }
          );

          UI.log("USDC approval confirmed");
          await refreshStats();
        } catch (err) {
          console.error("[APP] approve failed:", err);
          UI.showError(UTILS.safeError(err));
        }
      });
    }

    if (btnCreate) {
      btnCreate.addEventListener("click", async () => {
        try {
          const monthly = ownerMonthly?.value || "";
          const beneficiary = ownerBeneficiary?.value || "";

          await FLOW.createVest(monthly, beneficiary);

          await refreshStats();
          await renderOwnerVestList(1);
        } catch (err) {
          console.error("[APP] create failed:", err);
          UI.showError(UTILS.safeError(err));
        }
      });
    }

    if (btnClaim) {
      btnClaim.addEventListener("click", async () => {
        try {
          await FLOW.claim();
          UI.log("Claim successful");
          await refreshStats();
          await renderOwnerVestList(ownerVestPage);
        } catch (err) {
          console.error("[APP] claim failed:", err);
          UI.showError(UTILS.safeError(err));
        }
      });
    }

    updateCreatorFormState();
  }

  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
      await refreshStats();
      await renderOwnerVestList(ownerVestPage);
    }
  });

  async function init() {
    bindWalletActions();
    bindBusinessActions();

    if (window.WALLET?.bindEvents) {
      WALLET.bindEvents();
    }

    await WALLET.refreshAccount();

    if (STATE.account && Number(STATE.chainId) === Number(C.CHAIN_ID)) {
      CONTRACTS.init(STATE);
      UI.setConnected();

      await refreshStats();
      await FLOW.refreshView();
      await renderOwnerVestList(1);
    } else if (STATE.account) {
      UI.updateWalletBtn();
      UI.updateAccountInfo();
      await renderOwnerVestList(1);
    } else {
      UI.setDisconnected();
      await renderOwnerVestList(1);
    }

    updateCreatorFormState();
    updateOwnerVestLink();
    startAutoRefresh();

  }

  window.APP = {
    init,
    renderOwnerVestList,
    initAfterWalletChange: async function () {
      if (STATE.account && Number(STATE.chainId) === Number(C.CHAIN_ID)) {
        CONTRACTS.init(STATE);
        UI.setConnected();
        await FLOW.refreshView();
        await refreshStats();
        await renderOwnerVestList(1);
      } else if (STATE.account) {
        UI.updateWalletBtn();
        UI.updateAccountInfo();
        await renderOwnerVestList(1);
      } else {
        UI.setDisconnected();
        await renderOwnerVestList(1);
      }

      updateCreatorFormState();
      updateOwnerVestLink();
    }
  };

  document.addEventListener("DOMContentLoaded", init);
})();
