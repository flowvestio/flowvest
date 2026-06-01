(function () {
  let statsTimer = null;
  let ownerVestPage = 1;
  let ownerVestTimer = null;
  let refreshRunning = false;
  let appInitialized = false;
  const OWNER_VEST_PAGE_SIZE = 5;
  // tracks the monthly value + plan for which USDC was approved this session
  let approvedForMonthly = null; // { value: string, plan: number } | null
  let selectedPlan = C.PLAN_A;

  function formatTvlCapShort(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return "—";
    if (x >= 1_000_000) {
      const m = x / 1_000_000;
      return (m % 1 === 0 ? String(m) : m.toFixed(1).replace(/\.0$/, "")) + "M";
    }
    if (x >= 1000) return `${Math.round(x / 1000)}k`;
    return String(x);
  }

  function formatInterval(secs) {
    const n = Number(secs);
    if (n < 3600) return n + 's';
    return Math.round(n / 86400) + 'd';
  }

  /** Sender total principal display: always 2 decimals, no thousands grouping (e.g. 4665.00). */
  function formatPrincipalUiAmount(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return x.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    });
  }

  function refreshMetaChips() {
    try {
      const cap = Number(C.TVL_CAP_USDC || 0) || 0;
      const metaChips = document.getElementById("metaChips");
      if (!metaChips || !window.I18N) return;
      while (metaChips.firstChild) metaChips.removeChild(metaChips.firstChild);

      const line1 = document.createElement("div");
      const line1Text = I18N.t("meta.line1", {
        chain: C.CHAIN_NAME,
        periodsA: C.PERIODS_A,
        intervalA: formatInterval(C.PERIOD_A),
        periodsB: C.PERIODS_B,
        intervalB: formatInterval(C.PERIOD_B),
      });
      line1.innerHTML = line1Text.replace(
        "V1.1",
        '<span style="color:#34d399;font-weight:700">V1.1</span>'
      );
      metaChips.appendChild(line1);

      if (cap > 0) {
        const line2 = document.createElement("div");
        line2.className = "fv-muted text-xs";
        line2.textContent = I18N.t("meta.line2TvlCap", { short: formatTvlCapShort(cap) });
        metaChips.appendChild(line2);
      }
    } catch (_) {}
  }

  function updateKpiTvlTooltip() {
    if (!window.I18N) return;
    const cap = Number(C.TVL_CAP_USDC || 0) || 0;
    const tip = document.getElementById("kpiTvlTooltip");
    if (!tip) return;
    const capStr = cap > 0 ? cap.toLocaleString() : "—";
    tip.textContent = I18N.t("kpi.tvlUsageTooltip", { cap: capStr });
  }

  function syncButtonOriginalsFromI18n() {
    if (!window.I18N) return;
    const btnApprove = document.getElementById("btnOwnerApprove");
    const btnCreate = document.getElementById("btnOwnerCreate");
    const btnClaim = document.getElementById("btnClaim");
    if (btnApprove) btnApprove.dataset.originalText = I18N.t("creator.approve");
    if (btnCreate) btnCreate.dataset.originalText = I18N.t("creator.create");
    if (btnClaim && !STATE.isBusy) {
      btnClaim.dataset.originalText = I18N.t("claim.action");
    }
  }

  async function onLocaleChanged() {
    refreshMetaChips();
    updateKpiTvlTooltip();
    syncButtonOriginalsFromI18n();
    if (window.UI?.refreshStatusI18n) UI.refreshStatusI18n();
    await renderOwnerVestList(ownerVestPage);
    if (STATE.account && Number(STATE.chainId) === Number(C.CHAIN_ID) && STATE.flow) {
      await FLOW.refreshView();
    } else {
      UI.updateWalletBtn();
      const c = document.getElementById("btnClaim");
      if (c && !STATE.account) {
        c.disabled = true;
        c.textContent = I18N.t("claim.action");
      }
    }
    updateCreatorFormState();
  }

  function applyScanStatsTvlHint(data) {
    const tvl = Number(data?.tvl || 0);
    STATE.protocolTvlNum = Number.isFinite(tvl) ? tvl : null;
    try {
      updateCreatorFormState();
    } catch (_) {}
  }

  async function refreshProtocolTvlFromScanApi() {
    try {
      const res = await fetch(`${C.API_STATS}?t=${Date.now()}`);
      if (!res.ok) return;
      applyScanStatsTvlHint(await res.json());
    } catch (_) {}
  }

  // Fetch protocol stats from scan API immediately at page load — no wallet needed.
  // DB query < 50ms vs chain RPC ~1-2s, so TVL appears almost instantly.
  async function prefetchPublicStats() {
    try {
      const res = await fetch(`${C.API_STATS}?t=${Date.now()}`);
      if (!res.ok) throw new Error("stats api failed");
      const data = await res.json();
      // Always keep scan TVL for sender TVL-cap hint — even if `STATE.flow` is already set.
      // OKX / mobile often finishes wallet init before this fetch returns; an early `return`
      // used to skip this and left `protocolTvlNum` null → no TVL warning on device.
      applyScanStatsTvlHint(data);

      if (STATE.flow) return; // wallet already initialized — refreshStats() owns KPI widgets
      const tvl = Number(data.tvl || 0);
      const cap = Number(C.TVL_CAP_USDC || 0) || 0;
      const usage = cap > 0 ? (tvl / cap) * 100 : null;
      UI.setText("kpiTVL", tvl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      UI.setText("kpiVestCount", String(data.total || 0));
      UI.setText("kpiUsage", usage == null ? "—" : `${usage.toFixed(2)}%`);
    } catch (_) {}
  }

  async function refreshStats() {
    try {
      if (!STATE.flow) return;
      if (STATE.rpcBackoffUntil && Date.now() < STATE.rpcBackoffUntil) return;

      const stats = await FLOW.loadStats();
      UI.updateStatsUI(stats);
      if (stats.tvl != null) {
        try {
          STATE.protocolTvlNum = Number(
            ethers.utils.formatUnits(stats.tvl, C.DECIMALS_USDC)
          );
        } catch (_) {
          STATE.protocolTvlNum = null;
        }
      }
      if (stats.balance != null) {
        STATE.balanceNum = Number(
          ethers.utils.formatUnits(stats.balance, C.DECIMALS_USDC)
        );
      }
      try {
        updateCreatorFormState();
      } catch (_) {}
    } catch (err) {
      console.error("[APP] refreshStats error:", err);
      if (err?.status === 429 || err?.response?.status === 429 || String(err?.message || "").includes("429")) {
        STATE.rpcBackoffUntil = Date.now() + 30000;
      }
    }
  }

  async function runRefresh() {
    if (document.hidden) return;
    if (!STATE.account) return;
    if (STATE.isBusy) return;
    if (STATE.isClaiming) return;
    if (STATE.rpcBackoffUntil && Date.now() < STATE.rpcBackoffUntil) return;
    if (refreshRunning) return;
    refreshRunning = true;
    try {
      await Promise.all([refreshStats(), FLOW.refreshView(), renderOwnerVestList(ownerVestPage)]);
    } catch (e) {
      console.warn("[APP] runRefresh error:", e);
    } finally {
      refreshRunning = false;
    }
  }

  /** OKX / mobile in-app: balance + contracts can lag first paint; re-pull shortly after connect/init. */
  function scheduleDeferredRunRefresh() {
    const kick = async () => {
      if (STATE.rpcBackoffUntil && Date.now() < STATE.rpcBackoffUntil) return;
      if (!STATE.account || Number(STATE.chainId) !== Number(C.CHAIN_ID)) {
        return;
      }
      if (STATE.isBusy || STATE.isClaiming) return;
      if (!STATE.flow) {
        await tryInitContracts(2);
        if (!STATE.flow) return;
      }
      await runRefresh();
      try {
        updateCreatorFormState();
      } catch (_) {}
    };
    setTimeout(() => void kick(), 2500);
  }

  /** When user returns to the tab / app: re-init contracts if first pass missed (refreshStats needs STATE.flow). */
  async function resyncWalletUiAfterReveal() {
    if (!appInitialized || STATE.isBusy) return;
    try {
      if (!STATE.account || Number(STATE.chainId) !== Number(C.CHAIN_ID)) {
        await renderOwnerVestList(ownerVestPage);
        return;
      }
      if (!STATE.flow) {
        await tryInitContracts(2);
        if (!STATE.flow) return;
      }
      await refreshStats();
      try {
        await FLOW.refreshView();
      } catch (_) {}
      await renderOwnerVestList(ownerVestPage);
      try {
        updateCreatorFormState();
      } catch (_) {}
    } catch (_) {}
  }

  async function tryInitContracts(maxAttempts = 3) {
    let lastErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (STATE.rpcBackoffUntil && Date.now() < STATE.rpcBackoffUntil) {
        return lastErr || new Error("RPC rate limited");
      }
      try {
        await CONTRACTS.init(STATE);
        return null;
      } catch (e) {
        lastErr = e;
        console.warn("[APP] CONTRACTS.init attempt", attempt, e);
        if (e?.status === 429 || e?.response?.status === 429 || String(e?.message || "").includes("429") || String(e?.message || "").includes("Too Many Requests")) {
          STATE.rpcBackoffUntil = Date.now() + 30000;
          break;
        }
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 450));
        }
      }
    }
    return lastErr;
  }

  function startAutoRefresh() {
  if (statsTimer) clearInterval(statsTimer);
  statsTimer = setInterval(runRefresh, 30000);
}

  async function connectInjectedWallet() {
    try {
      await WALLET.connect();
      UI.log(I18N.t("app.walletConnected"));

      UI.setBusy(true);

      if (Number(STATE.chainId) !== Number(C.CHAIN_ID)) {
        UI.showError(I18N.t("errors.switchChain", { chain: C.CHAIN_NAME }));
        return;
      }

      await CONTRACTS.init(STATE);
      UI.setConnected();

      if (window.WALLET?.bindEvents) {
        WALLET.bindEvents();
      }

      await runRefresh();
      scheduleDeferredRunRefresh();

      updateCreatorFormState();
      updateOwnerVestLink();
      UI.showStatusKey("status.ready", "info");
    } catch (e) {
      console.error("[APP] connectWallet error:", e);
      UI.showError(e.message || String(e));
    } finally {
      UI.setBusy(false);
    }
  }

  async function connectWalletConnect() {
    try {
      await WALLET.connectWalletConnect();
      UI.log(I18N.t("app.walletConnected"));

      UI.setBusy(true);

      if (Number(STATE.chainId) !== Number(C.CHAIN_ID)) {
        UI.showError(I18N.t("errors.switchChain", { chain: C.CHAIN_NAME }));
        return;
      }

      await CONTRACTS.init(STATE);
      UI.setConnected();

      await runRefresh();
      scheduleDeferredRunRefresh();

      updateCreatorFormState();
      updateOwnerVestLink();
      UI.showStatusKey("status.ready", "info");
    } catch (e) {
      console.error("[APP] connectWalletConnect error:", e);
      UI.showError(e.message || String(e));
    } finally {
      UI.setBusy(false);
    }
  }

  function syncWalletMenu() {
    const isConnected = !!STATE.account;
    const setHidden = (id, hidden) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle("hidden", !!hidden);
    };

    setHidden("btnCopyAddress", !isConnected);
    setHidden("btnViewExplorer", !isConnected);
    setHidden("btnDisconnect", !isConnected);

    // Keep wallet button label in sync (short address when connected).
    if (isConnected) {
      const btn = document.getElementById("btnWallet");
      if (btn) {
        try {
          btn.textContent = window.UTILS?.shortAddr
            ? UTILS.shortAddr(STATE.account)
            : String(STATE.account);
        } catch (_) {}
      }
      if (window.UI?.updateWalletBtn) UI.updateWalletBtn();
    }
  }

//read summary API	
async function loadAddressSummary() {
  if (!STATE.account) return null;

  const r = await fetch(
    `${C.SCAN_BASE}/api/address/${STATE.account}/summary?t=${Date.now()}`
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

    const chooser = document.getElementById("walletChooserOverlay");
    const btnOKX = document.getElementById("btnConnectOKX");
    const btnMM = document.getElementById("btnConnectMetaMask");
    const btnOther = document.getElementById("btnConnectOther");
    const btnShowQR = document.getElementById("btnShowWCQR");
    const qrActions = document.getElementById("wcQrActions");
    const btnOpenMM = document.getElementById("btnOpenMetaMask");
    const btnOpenOKX = document.getElementById("btnOpenOKX");
    const btnCopyLink = document.getElementById("btnCopyWcLink");
    const qrBox = document.getElementById("wcQrBox");
    const qrHint = document.getElementById("wcQrHint");
    const qrPlaceholder = document.getElementById("wcQrPlaceholder");

    const openChooser = () => {
      if (!chooser) return;
      chooser.classList.remove("hidden");
      if (qrPlaceholder) qrPlaceholder.classList.remove("hidden");
      if (qrBox) {
        qrBox.classList.add("hidden");
        qrBox.innerHTML = "";
      }
      if (qrHint) {
        qrHint.textContent = I18N.t("wallet.qrHintInitial");
      }
      if (btnShowQR) {
        btnShowQR.textContent = I18N.t("wallet.showQr");
        btnShowQR.dataset.qrShown = "0";
      }
      if (qrActions) {
        const uri = window.WALLET?.getWalletConnectUri ? WALLET.getWalletConnectUri() : "";
        qrActions.classList.toggle("hidden", !uri);
      }
    };
    const closeChooser = () => {
      if (!chooser) return;
      chooser.classList.add("hidden");
    };

    if (chooser) {
      chooser.querySelectorAll("[data-wallet-chooser-close='1']").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          closeChooser();
        });
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeChooser();
      });
    }

    if (btnWallet) {
      btnWallet.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (STATE.account) {
          // Ensure main button shows address (not stale \"Connect Wallet\").
          try {
            btnWallet.textContent = window.UTILS?.shortAddr
              ? UTILS.shortAddr(STATE.account)
              : String(STATE.account);
          } catch (_) {
            if (window.UI?.updateWalletBtn) UI.updateWalletBtn();
          }
          syncWalletMenu();
          UI.toggleWalletMenu();
        } else {
          openChooser();
        }
      });
    }

    // Delegate all injected-wallet buttons (MetaMask / OKX / Other) via the chooser container.
    // More robust than binding each button by ID — works even if DOM order changes.
    if (chooser) {
      chooser.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-connect-injected='1']");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        closeChooser();
        await connectInjectedWallet();
      });
    }

    const renderQr = (uri) => {
      if (!qrBox) return;
      qrBox.innerHTML = "";
      if (!uri) return;
      if (qrPlaceholder) qrPlaceholder.classList.add("hidden");
      qrBox.classList.remove("hidden");
      // Ensure high contrast for mobile scanners (OKX in particular):
      // force white background and some quiet-zone padding.
      try {
        qrBox.style.background = "#ffffff";
        qrBox.style.borderRadius = "16px";
        qrBox.style.padding = "12px";
        qrBox.style.width = "fit-content";
        qrBox.style.margin = "0 auto";
      } catch (_) {}
      try {
        // eslint-disable-next-line no-undef
        new QRCode(qrBox, {
          text: uri,
          width: 320,
          height: 320,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
      } catch (err) {
        console.warn("[APP] QR render failed", err);
      }
      if (qrHint) {
        qrHint.textContent = I18N.t("wallet.qrShownHint");
      }
      if (btnShowQR) {
        btnShowQR.textContent = I18N.t("wallet.refreshQr");
        btnShowQR.dataset.qrShown = "1";
      }
      if (qrActions) qrActions.classList.remove("hidden");

      // Show raw WalletConnect URI for manual open/copy fallback.
      try {
        const uriWrap = document.getElementById("wcUriWrap");
        const uriInput = document.getElementById("wcUriInput");
        const uriOpen = document.getElementById("wcUriOpenLink");
        if (uriInput) uriInput.value = uri;
        if (uriOpen) uriOpen.href = uri;
        if (uriWrap) uriWrap.classList.remove("hidden");
      } catch (_) {}
    };

    const syncQrActionLabels = () => {
      if (btnOpenMM) btnOpenMM.textContent = I18N.t("wallet.openMetaMask");
      if (btnOpenOKX) btnOpenOKX.textContent = (I18N.t("wallet.openOkx") || "Open OKX");
      if (btnCopyLink) btnCopyLink.textContent = I18N.t("wallet.copyLink");
    };
    syncQrActionLabels();

    if (btnOpenMM) {
      btnOpenMM.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const uri = window.WALLET?.getWalletConnectUri ? WALLET.getWalletConnectUri() : "";
        const link = window.WALLET?.metamaskDeepLink ? WALLET.metamaskDeepLink(uri) : "";
        UI.showInfo(I18N.t("wallet.openingMetaMask"));
        if (link) window.location.href = link;
      });
    }

    if (btnOpenOKX) {
      btnOpenOKX.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const uri = window.WALLET?.getWalletConnectUri ? WALLET.getWalletConnectUri() : "";
        const link = window.WALLET?.okxDeepLink ? WALLET.okxDeepLink(uri) : "";
        UI.showInfo(I18N.t("wallet.openingOkx") || "Opening OKX…");
        if (link) window.location.href = link;
      });
    }

    if (btnCopyLink) {
      btnCopyLink.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const uri = window.WALLET?.getWalletConnectUri ? WALLET.getWalletConnectUri() : "";
        if (!uri) return;
        const prevText = btnCopyLink.textContent;
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(uri);
          } else {
            const ta = document.createElement("textarea");
            ta.value = uri;
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            ta.style.top = "0";
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(ta);
            if (!ok) throw new Error("copy_failed");
          }
          // Visual feedback in modal (mobile wallets often hide global toasts).
          try {
            btnCopyLink.textContent = I18N.t("wallet.linkCopied") || "Copied";
            btnCopyLink.disabled = true;
            setTimeout(() => {
              btnCopyLink.textContent = prevText;
              btnCopyLink.disabled = false;
            }, 1200);
          } catch (_) {}
          UI.showSuccess(I18N.t("wallet.linkCopied") || "Copied.");
        } catch (err) {
          // Fallback: reveal URI input for manual copy
          try {
            const uriWrap = document.getElementById("wcUriWrap");
            const uriInput = document.getElementById("wcUriInput");
            if (uriInput) uriInput.value = uri;
            if (uriWrap) uriWrap.classList.remove("hidden");
            if (uriInput) {
              uriInput.focus();
              uriInput.select();
            }
          } catch (_) {}
          UI.showError(I18N.t("wallet.linkCopyFailed") || "Copy failed. Please copy the wc: link manually.");
        }
      });
    }

    if (btnShowQR) {
      btnShowQR.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (qrHint) qrHint.textContent = I18N.t("errors.generatingQr");
        try {
          await WALLET.connectWalletConnect({
            onDisplayUri: (uri) => renderQr(uri)
          });
          // If we already have a URI (some wallets keep session), show actions even if display_uri didn't fire.
          if (qrActions) {
            const uri = window.WALLET?.getWalletConnectUri ? WALLET.getWalletConnectUri() : "";
            if (uri) qrActions.classList.remove("hidden");
          }
          // Close immediately once connected (don't block on network/UI refresh).
          if (STATE.account) closeChooser();

          // WC mobile wallets sometimes connect without pushing events to the page immediately.
          // Force a state sync + UI refresh (run after closing).
          try {
            await WALLET.refreshAccount();
          } catch (_) {}
          if (window.APP?.initAfterWalletChange) {
            await APP.initAfterWalletChange();
          }
          // If account became available after refreshAccount(), close now.
          if (STATE.account) closeChooser();
        } catch (err) {
          if (qrPlaceholder) qrPlaceholder.classList.remove("hidden");
          if (qrBox) {
            qrBox.classList.add("hidden");
            qrBox.innerHTML = "";
          }
          if (qrHint) qrHint.textContent = I18N.t("errors.qrFailed");
          btnShowQR.textContent = I18N.t("wallet.showQr");
          btnShowQR.dataset.qrShown = "0";
          UI.showError(UI.safeError(err));
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
          UI.showSuccess(I18N.t("wallet.copied"));
        } catch (err) {
          UI.showError(I18N.t("wallet.copyFailed"));
        } finally {
          UI.closeWalletMenu();
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
        UI.log(I18N.t("app.walletDisconnected"));

        UI.closeWalletMenu();
        syncWalletMenu();

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
    link.href = `${C.SCAN_BASE}/viewsender.html?addr=${STATE.account}`;
    link.style.pointerEvents = "auto";
    link.style.opacity = "1";
  } else {
    link.href = "#";
    link.style.pointerEvents = "none";
    link.style.opacity = "0.5";
  }
}
  function updateStepIndicator(step) {
    // step: 0 = inactive, 1 = step1 active (approve), 2 = step2 active (create)
    const dot1 = document.getElementById('step1Dot');
    const lbl1 = document.getElementById('step1Label');
    const dot2 = document.getElementById('step2Dot');
    const lbl2 = document.getElementById('step2Label');
    if (!dot1 || !dot2) return;

    const s1 = window.I18N ? I18N.t('creator.step1') : 'Approve USDC';
    const s2 = window.I18N ? I18N.t('creator.step2') : 'Create Vest';
    if (lbl1) lbl1.textContent = s1;
    if (lbl2) lbl2.textContent = s2;

    function setDot(dot, lbl, bg, border, color, text, lblColor) {
      dot.style.background = bg;
      dot.style.border = border;
      dot.style.color = color;
      dot.textContent = text;
      lbl.style.color = lblColor;
    }

    const MUTED = 'var(--fv-muted)';
    const BORDER_MUTED = '2px solid var(--fv-border)';

    if (step === 2) {
      setDot(dot1, lbl1, '#22c55e', 'none', '#fff', '✓', '#22c55e');
      setDot(dot2, lbl2, '#10b981', 'none', '#fff', '2', '#10b981');
    } else if (step === 1) {
      setDot(dot1, lbl1, '#d97706', 'none', '#fff', '1', '#d97706');
      setDot(dot2, lbl2, 'transparent', BORDER_MUTED, MUTED, '2', MUTED);
    } else {
      setDot(dot1, lbl1, 'transparent', BORDER_MUTED, MUTED, '1', MUTED);
      setDot(dot2, lbl2, 'transparent', BORDER_MUTED, MUTED, '2', MUTED);
    }
  }

  function updateCreatorFormState() {
    // While a tx is in progress, avoid resetting button *labels* ("Claiming…") but
    // still refresh disabled state so WalletConnect / reconnect flows don't leave
    // Approve stuck disabled from the initial HTML `disabled` attribute.
    const deferButtonLabels = STATE.isBusy;

    const ownerMonthly = document.getElementById("ownerMonthly");
    const ownerTotal = document.getElementById("ownerTotal");
    const ownerTotalLabel = document.getElementById("ownerTotalLabel");
    const ownerBeneficiary = document.getElementById("ownerBeneficiary");
    const monthlyRulesEl = document.getElementById("monthlyRulesHint");

    const btnApprove = document.getElementById("btnOwnerApprove");
    const btnCreate = document.getElementById("btnOwnerCreate");

    const monthly = ownerMonthly?.value?.trim() || "";
    const beneficiary = ownerBeneficiary?.value?.trim() || "";

    const monthlyNum = Number(monthly);

    // Plan-aware periods and per-month limits
    const periods = selectedPlan === C.PLAN_B ? C.PERIODS_B : C.PERIODS_A;
    const maxPrincipalUi = Number(C.MAX_PRINCIPAL_USDC || 0) || 3000;
    const minMonthly = Math.ceil(200 / periods);
    const maxMonthly = Math.floor(maxPrincipalUi / periods);
    const total = monthlyNum * periods;

    const isPlanB = selectedPlan === C.PLAN_B;
    const releaseIntervalEl = document.getElementById("releaseIntervalHint");
    if (releaseIntervalEl) {
      releaseIntervalEl.textContent = I18N.t(isPlanB ? "creator.releaseIntervalB" : "creator.releaseInterval");
    }
    if (ownerTotalLabel) {
      ownerTotalLabel.textContent = I18N.t(
        isPlanB ? "creator.totalPrincipalLabelB" : "creator.totalPrincipalLabel",
        { periods }
      );
    }
    const monthlyLabelEl = document.querySelector("label[data-i18n='creator.monthlyLabel']");
    if (monthlyLabelEl) {
      monthlyLabelEl.textContent = I18N.t(isPlanB ? "creator.biweeklyLabel" : "creator.monthlyLabel");
    }
    if (monthlyRulesEl) {
      monthlyRulesEl.textContent = I18N.t(
        isPlanB ? "creator.biweeklyRules" : "creator.monthlyRules",
        { min: minMonthly, max: maxMonthly.toLocaleString() }
      );
    }

    const monthlyValid =
      Number.isFinite(monthlyNum) &&
      total >= 200 &&
      total <= maxPrincipalUi;

    const required = total;

const balanceError = document.getElementById("balanceError");
if (balanceError) {
  if (monthlyNum > 0 && monthlyValid && STATE.balanceNum > 0 && required > STATE.balanceNum) {
    balanceError.textContent = I18N.t("form.insufficientBalance", {
      required: required.toFixed(2),
      available: STATE.balanceNum.toFixed(2)
    });
    balanceError.classList.remove("hidden");
  } else {
    balanceError.classList.add("hidden");
  }
}

    const onRightChain = Number(STATE.chainId) === Number(C.CHAIN_ID);

    if (ownerTotal) {
      if (!monthlyNum || monthlyNum <= 0) {
    ownerTotal.textContent = "—";
    ownerTotal.className = "font-mono fv-text";
  } else if (total < 200) {
    ownerTotal.textContent = I18N.t("form.minTotal", { total: formatPrincipalUiAmount(total) });
    ownerTotal.className = "font-mono text-rose-400"; // 红色
  } else if (total > maxPrincipalUi) {
    ownerTotal.textContent = I18N.t("form.maxTotal", { total: formatPrincipalUiAmount(total) });
    ownerTotal.className = "font-mono text-rose-400"; // 红色
  } else {
    ownerTotal.textContent = formatPrincipalUiAmount(total);
    ownerTotal.className = "font-mono text-emerald-400"; // 绿色
  }
}

    const errorEl = document.getElementById("monthlyError");
if (errorEl) {
  if (monthlyNum > 0 && total < 200) {
    errorEl.textContent = I18N.t("form.minMonthly", { min: minMonthly });
    errorEl.classList.remove("hidden");
  } else if (total > maxPrincipalUi) {
    errorEl.textContent = I18N.t("form.maxMonthly", { max: maxMonthly.toLocaleString() });
    errorEl.classList.remove("hidden");
  } else {
    errorEl.classList.add("hidden");
  }
}
    const balanceInsufficient = monthlyValid && STATE.balanceNum > 0 && total > STATE.balanceNum;

    const capTvl = Number(C.TVL_CAP_USDC || 0) || 0;
    const tvlNow = STATE.protocolTvlNum;
    const hasProtocolTvl =
      capTvl > 0 &&
      tvlNow != null &&
      Number.isFinite(Number(tvlNow)) &&
      Number(tvlNow) >= 0;
    const remainingTvl = hasProtocolTvl ? Math.max(0, capTvl - Number(tvlNow)) : null;
    const tvlWouldExceed =
      !!(monthlyValid && remainingTvl != null && total > remainingTvl + 1e-6);

    const tvlCapHintEl = document.getElementById("tvlCapHint");
    if (tvlCapHintEl) {
      if (tvlWouldExceed) {
        tvlCapHintEl.textContent = I18N.t("form.tvlWouldExceed", {
          total: total.toFixed(2),
          remaining: remainingTvl.toFixed(2),
          cap: capTvl.toLocaleString(),
          periods: String(periods),
        });
        tvlCapHintEl.classList.remove("hidden");
      } else {
        tvlCapHintEl.textContent = "";
        tvlCapHintEl.classList.add("hidden");
      }
    }

    if (btnApprove) {
      btnApprove.disabled =
        !monthlyValid ||
        !STATE.account ||
        !onRightChain ||
        balanceInsufficient ||
        tvlWouldExceed;
      if (btnApprove.disabled && STATE.account && monthlyValid) {
        if (!onRightChain) {
          btnApprove.title = I18N.t("errors.switchChain", { chain: C.CHAIN_NAME });
        } else if (balanceInsufficient) {
          btnApprove.title = I18N.t("form.insufficientBalance", {
            required: required.toFixed(2),
            available: Number(STATE.balanceNum || 0).toFixed(2),
          });
        } else if (tvlWouldExceed) {
          btnApprove.title = I18N.t("form.tvlWouldExceed", {
            total: total.toFixed(2),
            remaining: remainingTvl.toFixed(2),
            cap: capTvl.toLocaleString(),
            periods: String(periods),
          });
        } else {
          btnApprove.title = "";
        }
      } else {
        btnApprove.title = "";
      }
    }
    
    const beneficiaryError = document.getElementById("beneficiaryError");
if (beneficiaryError) {
  if (beneficiary && !isValidAddress(beneficiary)) {
    beneficiaryError.textContent = I18N.t("form.invalidAddress");
    beneficiaryError.classList.remove("hidden");
  } else {
    beneficiaryError.classList.add("hidden");
  }
}
    const isApproved = approvedForMonthly !== null &&
      approvedForMonthly.value === monthly &&
      approvedForMonthly.plan === selectedPlan;
    if (btnCreate) {
      btnCreate.disabled =
        !monthlyValid ||
        !isValidAddress(beneficiary) ||
        !STATE.account ||
        !onRightChain ||
        balanceInsufficient ||
        tvlWouldExceed ||
        !isApproved;
    }

    // Deterministically restore button labels (disable state is controlled above).
    if (!deferButtonLabels) {
      if (btnApprove && btnApprove.dataset.originalText) {
        btnApprove.textContent = btnApprove.dataset.originalText;
      }
      if (btnCreate && btnCreate.dataset.originalText) {
        btnCreate.textContent = btnCreate.dataset.originalText;
      }
    }

    // Step indicator
    if (!STATE.account || !onRightChain || !monthlyValid || tvlWouldExceed) {
      updateStepIndicator(0);
    } else if (isApproved) {
      updateStepIndicator(2);
    } else {
      updateStepIndicator(1);
    }
  }

  function shortAddr(a) {
    a = String(a || "");
    return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "—";
  }

  function fmtCountdown(sec) {
    const s = Math.max(Number(sec || 0), 0);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  async function loadOwnerVests(page = 1) {
    if (!STATE.account) {
      return { total: 0, page: 1, limit: OWNER_VEST_PAGE_SIZE, data: [] };
    }
    if (!navigator.onLine) {
    throw new Error(I18N.t("errors.networkDisconnected"));
  }

    const url =
      `${C.SCAN_BASE}/api/owner-vests` +
      `?owner=${STATE.account}` +
      `&page=${page}` +
      `&limit=${OWNER_VEST_PAGE_SIZE}` +
      `&t=${Date.now()}`;

    const r = await fetch(url);

    if (!r.ok) {
      throw new Error(I18N.t("errors.loadOwnerVests", { status: r.status }));
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
  UI.showInfo(I18N.t("errors.clipboardBlocked"));
};

  async function renderOwnerVestList(page = 1) {
    const box = document.getElementById("ownerVestList");
    if (!box) return;

    ownerVestPage = page;

    if (!STATE.account || Number(STATE.chainId) !== Number(C.CHAIN_ID)) {
      box.innerHTML = `
        <div class="text-sm fv-muted">
          ${I18N.t("owner.connectHint", { chain: C.CHAIN_NAME })}
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
          <div class="text-sm fv-muted">
            ${I18N.t("owner.none")}
          </div>
        `;
        return;
      }

      rows.forEach((v) => {
        const vestId = v.vest_id ?? v.id;
        const beneficiary = v.beneficiary || "";
        const monthly = Number(v.periodAmount ?? v.monthly ?? 0);

        let actionHtml = "";

        if (v.terminate_ready === true) {
          actionHtml = `
            <button
              class="terminate-row-btn px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm"
              data-vest-id="${vestId}"
            >
              ${I18N.t("owner.terminate")}
            </button>
          `;
        } else if (v.terminate_seconds_left != null && Number(v.terminate_seconds_left) > 0) {
          actionHtml = `
            <div class="text-sm text-amber-400">
              ${I18N.t("owner.terminateIn", { time: fmtCountdown(v.terminate_seconds_left) })}
            </div>
          `;
        } else if (v.status === "completed") {
          actionHtml = `
            <div class="text-sm text-emerald-400">
              ${I18N.t("owner.completed")}
            </div>
          `;
        } else if (v.status === "terminated") {
          actionHtml = `
            <div class="text-sm text-rose-400">
              ${I18N.t("owner.terminated")}
            </div>
          `;
        } else if (v.terminate_reason) {
          const reasonKey = v.terminate_reason.toLowerCase().includes("closed")
            ? "ui.terminateWindowClosed"
            : v.terminate_reason.toLowerCase().includes("after")
            ? "ui.terminateAfterM2"
            : null;
          const reasonText = reasonKey ? I18N.t(reasonKey) : v.terminate_reason;
          actionHtml = `
            <div class="text-sm fv-muted">
              ${reasonText}
            </div>
          `;
        } else {
          actionHtml = `
            <div class="text-sm fv-muted">
              ${v.status || I18N.t("owner.active")}
            </div>
          `;
        }

        const canShare = v.status === "active" || v.status === "pending";

        box.innerHTML += `
          <div class="fv-surface flex items-center justify-between gap-4 rounded-2xl border px-4 py-3">
            <div>
	       <div class="font-medium">
  <a
    href="${C.SCAN_BASE}/vest.html?id=${vestId}"
    target="_blank"
    class="hover:text-cyan-500 underline"
  >
    ${I18N.t("owner.vestLink", { id: vestId })}
  </a>
</div>
              <div class="text-xs fv-muted mt-1 space-y-0.5">
                <div>${I18N.t("owner.beneficiaryLabel")} <span class="font-mono">${shortAddr(beneficiary)}</span></div>
                ${v.memo ? `<div>Label: <span class="font-mono">${UI.escapeHtml(v.memo)}</span></div>` : ""}
                <div>${I18N.t("owner.monthlyLabel")} <span class="font-mono">${monthly.toFixed(1)} USDC</span></div>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
              ${actionHtml}
              ${
                canShare
                  ? `<button
                      onclick="(function(btn){
                        var url='${C.SCAN_BASE}/vest.html?id=${vestId}';
                        navigator.clipboard.writeText(url).then(function(){
                          var orig=btn.textContent;
                          btn.textContent='✅ Link copied!';
                          setTimeout(function(){btn.textContent=orig;},1500);
                        }).catch(function(){
                          btn.textContent='Failed';
                          setTimeout(function(){btn.textContent='Share';},1500);
                        });
                      })(this)"
                      style="font-size:0.75rem;padding:3px 10px;border-radius:8px;border:1px solid var(--fv-border);background:transparent;color:var(--fv-muted);cursor:pointer;margin-right:18px;"
                    >Share</button>`
                  : ``
              }
            </div>
          </div>
        `;
      });

      box.innerHTML += `
        <div class="flex justify-center gap-4 mt-4 text-sm">
          <button
            id="ownerVestPrev"
            class="fv-surface px-3 py-1 rounded border disabled:opacity-40"
            ${page === 1 ? "disabled" : ""}
          >
            ${I18N.t("owner.prev")}
          </button>

          <span class="fv-muted">
            ${I18N.t("owner.page", { page, total: totalPages })}
          </span>

          <button
            id="ownerVestNext"
            class="fv-surface px-3 py-1 rounded border disabled:opacity-40"
            ${page >= totalPages ? "disabled" : ""}
          >
            ${I18N.t("owner.next")}
          </button>
        </div>
      `;

      box.querySelectorAll(".terminate-row-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const vestId = btn.getAttribute("data-vest-id");

          try {
            await FLOW.terminateVest(vestId);
            UI.log(I18N.t("app.vestTerminated", { id: vestId }));
            await refreshStats();
            await renderOwnerVestList(ownerVestPage);
          } catch (err) {
            console.error("[APP] terminate row failed:", err);
            UI.log(I18N.t("app.terminateFailed", { msg: UTILS.safeError(err) }));
            UI.showError(UI.safeError(err));
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
      const msg = !navigator.onLine
        ? I18N.t("errors.networkDisconnected")
        : err.message || I18N.t("errors.loadOwnerVestsGeneric");
      box.innerHTML = `
        <div class="text-sm text-rose-400">
	${msg}
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

    // Cache original button labels once, then restore deterministically in finally blocks.
    if (btnApprove && !btnApprove.dataset.originalText) {
      btnApprove.dataset.originalText = btnApprove.textContent || "";
    }
    if (btnCreate && !btnCreate.dataset.originalText) {
      btnCreate.dataset.originalText = btnCreate.textContent || "";
    }
    if (btnClaim && !btnClaim.dataset.originalText) {
      btnClaim.dataset.originalText = btnClaim.textContent || I18N.t("claim.action");
    }

    if (ownerMonthly) {
      ownerMonthly.addEventListener("input", () => {
        approvedForMonthly = null;
        updateCreatorFormState();
      });
    }

    if (ownerBeneficiary) {
      ownerBeneficiary.addEventListener("input", updateCreatorFormState);
    }

    // Plan selector
    const planBtnA = document.getElementById("planBtnA");
    const planBtnB = document.getElementById("planBtnB");

    function setPlanActive(plan) {
      selectedPlan = plan;
      approvedForMonthly = null;
      const ACTIVE_BORDER = "#10b981";
      const ACTIVE_BG = "rgba(16,185,129,0.07)";
      const IDLE_BORDER = "var(--fv-border)";
      if (planBtnA) {
        planBtnA.style.borderColor = plan === C.PLAN_A ? ACTIVE_BORDER : IDLE_BORDER;
        planBtnA.style.background = plan === C.PLAN_A ? ACTIVE_BG : "";
      }
      if (planBtnB) {
        planBtnB.style.borderColor = plan === C.PLAN_B ? ACTIVE_BORDER : IDLE_BORDER;
        planBtnB.style.background = plan === C.PLAN_B ? ACTIVE_BG : "";
      }
      updateCreatorFormState();
    }

    if (planBtnA) planBtnA.addEventListener("click", () => setPlanActive(C.PLAN_A));
    if (planBtnB) planBtnB.addEventListener("click", () => setPlanActive(C.PLAN_B));

    if (btnApprove) {
      btnApprove.addEventListener("click", async () => {
        try {
          if (btnApprove.disabled) {
            UI.explainDisabledReasons();
            return;
          }

          btnApprove.textContent = I18N.t("app.approving");
          btnApprove.disabled = true;

          const monthly = ownerMonthly?.value?.trim() || "";
          const monthlyAmount = UTILS.parseAmount(monthly, C.DECIMALS_USDC);
          const periods = selectedPlan === C.PLAN_B ? C.PERIODS_B : C.PERIODS_A;
          const totalPrincipal = monthlyAmount.mul(periods);

          await TX.send(
            () => TX.sendRaw(() => STATE.usdc.populateTransaction.approve(C.FLOW, totalPrincipal)),
            {
              pendingText: I18N.t("tx.pendingApprove"),
              successText: I18N.t("tx.successApprove")
            }
          );

          approvedForMonthly = { value: ownerMonthly?.value?.trim() || "", plan: selectedPlan };
          UI.log(I18N.t("app.usdcApproved"));
          await refreshStats();
          if (STATE.flow) {
            await FLOW.refreshView();
          }
        } catch (err) {
          approvedForMonthly = null;
          console.error("[APP] approve failed:", err);
          UI.showError(UI.safeError(err));
        } finally {
          btnApprove.textContent = btnApprove.dataset.originalText || I18N.t("creator.approve");
          updateCreatorFormState();
        }
      });
    }

    if (btnCreate) {
      btnCreate.addEventListener("click", async () => {
        try {
          if (btnCreate.disabled) {
            UI.explainDisabledReasons();
            return;
          }

          btnCreate.textContent = I18N.t("app.creating");
          btnCreate.disabled = true;

          const monthly = ownerMonthly?.value || "";
          const beneficiary = ownerBeneficiary?.value || "";
          const memo = (document.getElementById("ownerMemo")?.value?.trim() || "").slice(0, 80);

          const vestId = await FLOW.createVest(monthly, beneficiary, selectedPlan);
          approvedForMonthly = null;

          // Save memo to server if provided
          if (vestId && memo && STATE.account) {
            fetch(`${C.SCAN_BASE}/api/vest-memo`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vest_id: Number(vestId), owner: STATE.account, memo })
            }).catch(() => {});
          }

          const memoEl = document.getElementById("ownerMemo");
          if (memoEl) memoEl.value = "";

          await refreshStats();
          if (STATE.flow) {
            await FLOW.refreshView();
          }
          await refreshProtocolTvlFromScanApi();
          await renderOwnerVestList(1);
        } catch (err) {
          console.error("[APP] create failed:", err);
          UI.showError(UI.safeError(err));
        } finally {
          btnCreate.textContent = btnCreate.dataset.originalText || I18N.t("creator.create");
          updateCreatorFormState();
        }
      });
    }

    if (btnClaim) {
      btnClaim.addEventListener("click", async () => {
        let claimSucceeded = false;
        try {
          if (btnClaim.disabled) {
            UI.explainDisabledReasons();
            return;
          }

          btnClaim.textContent = I18N.t("claim.claiming");
          btnClaim.disabled = true;
          STATE.isClaiming = true;

          await FLOW.claim();
          claimSucceeded = true;
          UI.log(I18N.t("app.claimOk"));
          await refreshStats();
          await renderOwnerVestList(ownerVestPage);
        } catch (err) {
          console.error("[APP] claim failed:", err);
          UI.showError(UI.safeError(err));
          // Clear stale vest ID cache so next claim re-fetches fresh data.
          STATE.claimableVestIds = [];
          STATE.claimablePreparedAt = 0;
          try {
            if (STATE.flow && STATE.account) await FLOW.refreshView();
          } catch (_) {}
        } finally {
          STATE.isClaiming = false;
          // On success, FLOW.claim → refreshView + post-claim guard already set button & KPI.
          // Resetting here would wipe "Claimed · syncing…" and bring back stale API amounts.
          if (!claimSucceeded && btnClaim) {
            btnClaim.textContent =
              btnClaim.dataset.originalText || I18N.t("claim.action");
          }
        }
      });
    }

    updateCreatorFormState();
  }

  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
      await resyncWalletUiAfterReveal();
    }
  });

  // Mobile browsers (especially when switching to a wallet app) don't always fire
  // visibilitychange reliably. Add focus/pageshow fallbacks to refresh UI.
  window.addEventListener("focus", async () => {
    await resyncWalletUiAfterReveal();
  });

  window.addEventListener("pageshow", async (e) => {
    // Handles bfcache restore on iOS/Android
    await resyncWalletUiAfterReveal();
  });

  async function init() {
    void prefetchPublicStats(); // fire-and-forget: TVL visible in ~1-2s, no wallet needed

    await I18N.init();
    if (window.EARLY_ACCESS) EARLY_ACCESS.initEarlyAccess();

    bindWalletActions();
    bindBusinessActions();
    syncWalletMenu();

    refreshMetaChips();
    updateKpiTvlTooltip();
    syncButtonOriginalsFromI18n();
    I18N.updateDisconnectedWalletLabel();

    if (window.WALLET?.bindEvents) {
      WALLET.bindEvents();
    }

    try {
      await WALLET.refreshAccount();
    } catch (_) {
      // No wallet found (e.g. plain mobile browser) — treat as disconnected
    }

    // OKX in-app: `okxwallet` / authorized accounts often appear shortly after first `eth_accounts`.
    if (STATE.walletTransport !== "walletconnect") {
      for (let i = 0; i < 15 && !STATE.account; i++) {
        await new Promise((r) => setTimeout(r, 200));
        try {
          await WALLET.refreshAccount();
        } catch (_) {}
        if (STATE.account) break;
      }
    }

    if (STATE.account && Number(STATE.chainId) === Number(C.CHAIN_ID)) {
      const initErr = await tryInitContracts(3);
      if (initErr && !STATE.flow) {
        console.error("[APP] CONTRACTS.init failed:", initErr);
        UI.showError(initErr.message || "Contract init failed");
      }
      UI.setConnected();

      await runRefresh();
      scheduleDeferredRunRefresh();
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
    syncWalletMenu();

    UI.showStatusKey("status.ready", "info");
    appInitialized = true;
  }

  window.APP = {
    init,
    onLocaleChanged,
    renderOwnerVestList,
    initAfterWalletChange: async function () {
      STATE.claimableVestIds = [];
      STATE.claimablePreparedAt = 0;
      STATE.claimablePreparing = false;
      STATE.claimablePreparePromise = null;
      STATE.postClaimStaleGuardUntil = null;
      STATE.postClaimZeroSeenAt = 0;

      // WalletConnect (e.g. MetaMask QR): session can report an address before ethers
      // signer is wired; one more refresh avoids CONTRACTS.init: signer missing.
      if (
        STATE.walletTransport === "walletconnect" &&
        STATE.account &&
        window.WALLET?.refreshAccount
      ) {
        try {
          await WALLET.refreshAccount();
        } catch (e) {
          console.warn("[APP] WC refreshAccount before CONTRACTS.init:", e);
        }
      }

      if (STATE.account && Number(STATE.chainId) === Number(C.CHAIN_ID)) {
        const initErr = await tryInitContracts(3);
        if (initErr && !STATE.flow) {
          console.error("[APP] CONTRACTS.init failed:", initErr);
          UI.showError(initErr.message || "Contract init failed");
        }
        UI.setConnected();
        await runRefresh();
        scheduleDeferredRunRefresh();
      } else if (STATE.account) {
        UI.updateWalletBtn();
        UI.updateAccountInfo();
        await renderOwnerVestList(1);
      } else {
        UI.setDisconnected();
        await renderOwnerVestList(1);
      }

      if (STATE.account) {
        // If we became connected, force-close the connect overlay immediately.
        const chooser = document.getElementById("walletChooserOverlay");
        if (chooser) chooser.classList.add("hidden");

        const btn = document.getElementById("btnWallet");
        if (btn) {
          try {
            btn.textContent = window.UTILS?.shortAddr
              ? UTILS.shortAddr(STATE.account)
              : String(STATE.account);
          } catch (_) {}
        }
      }

      updateCreatorFormState();
      updateOwnerVestLink();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
})();
