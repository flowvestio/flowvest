(function () {
  function patchEthersFormatter() {
    const proto = window.ethers?.providers?.Formatter?.prototype;
    if (!proto || proto.__flowvestPatched) return;
    proto.__flowvestPatched = true;

    const missing = (value) => value == null || value === "undefined" || value === "null";
    const normalizeTx = (tx) => {
      if (!tx || typeof tx !== "object") return tx;
      const normalized = { ...tx };
      Object.keys(normalized).forEach((key) => {
        if (normalized[key] === undefined) delete normalized[key];
      });
      if (missing(normalized.value)) normalized.value = "0x0";
      if (missing(normalized.gasLimit)) normalized.gasLimit = normalized.gas ?? normalized.gas_limit ?? "0x0";
      if (missing(normalized.gasPrice) && !missing(normalized.maxFeePerGas)) normalized.gasPrice = normalized.maxFeePerGas;
      if (missing(normalized.maxFeePerGas)) delete normalized.maxFeePerGas;
      if (missing(normalized.maxPriorityFeePerGas)) delete normalized.maxPriorityFeePerGas;
      return normalized;
    };

    const origCheck = proto.check;
    proto.check = function(format, object) {
      return origCheck.call(this, format, normalizeTx(object));
    };

    const origNumber = proto.number;
    if (origNumber) {
      proto.number = function(value) {
        return origNumber.call(this, missing(value) ? "0x0" : value);
      };
    }

    const origTxResponse = proto.transactionResponse;
    proto.transactionResponse = function(transaction) {
      return origTxResponse.call(this, normalizeTx(transaction));
    };
  }

  patchEthersFormatter();

  function showTxStatus(msg, type, htmlOpts, claimStatus) {
    if (claimStatus) {
      const el = document.getElementById("kpiClaimStatus");
      if (el) {
        if (htmlOpts?.html) {
          el.innerHTML = msg;
        } else {
          el.textContent = msg;
        }
        el.style.color = type === "success" ? "#22c55e" : type === "error" ? "#f87171" : "";
        el.style.display = "block";
      }
      const details = document.getElementById("kpiClaimDetails");
      if (details) details.style.display = "none";
      const msgEl = document.getElementById("kpiClaimMsg");
      if (msgEl) msgEl.style.display = "none";
    } else {
      UI.showStatus(msg, type, htmlOpts);
    }
  }

  function setClaimExplorerLink(txUrl) {
    const el = document.getElementById("kpiClaimExplorer");
    if (!el) return;
    const explorerLinkText = window.I18N ? I18N.t("tx.viewOnExplorer") : "View On Explorer ↗";
    el.innerHTML = `<a href="${UI.escapeHtml(txUrl)}" target="_blank" rel="noopener noreferrer" class="text-emerald-400 underline">${explorerLinkText}</a>`;
    el.style.display = "block";
  }

  function toRpcQuantity(value) {
    if (value == null) return null;
    if (ethers.BigNumber.isBigNumber(value)) return value.isZero() ? null : value.toHexString();
    try {
      const bn = ethers.BigNumber.from(value);
      return bn.isZero() ? null : bn.toHexString();
    } catch (_) {
      return value;
    }
  }

  async function sendRaw(populateFactory) {
    if (!STATE.account) throw new Error("Wallet not connected");
    const eth = STATE.provider?.provider;
    if (!eth?.request) throw new Error("Wallet provider not available");

    const txReq = await populateFactory();
    if (!txReq?.to || !txReq?.data) throw new Error("Transaction data was not created");

    const txParams = {
      from: ethers.utils.getAddress(STATE.account),
      to: ethers.utils.getAddress(txReq.to),
      data: txReq.data,
    };

    const value = toRpcQuantity(txReq.value);
    const gas = toRpcQuantity(txReq.gasLimit || txReq.gas);
    if (value) txParams.value = value;
    if (gas) txParams.gas = gas;

    const hash = await eth.request({
      method: "eth_sendTransaction",
      params: [txParams],
    });

    return {
      hash,
      wait: async () => {
        if (STATE.readProvider) {
          return STATE.readProvider.waitForTransaction(hash, 1, 120000);
        }
        return STATE.provider.waitForTransaction(hash, 1, 120000);
      },
    };
  }

  async function send(txFactory, opts = {}) {
    if (STATE.isBusy) throw new Error(window.I18N ? I18N.t("tx.busy") : "Another transaction is in progress");

    STATE.isBusy = true;
    UI.setBusy(true);

    const isClaimTx = !!opts.claimStatus;

    try {
      showTxStatus(opts.pendingText || "Waiting for wallet confirmation...", "info", {}, isClaimTx);

      const tx = await txFactory();

      if (!tx?.hash) throw new Error("Transaction was not created");

      STATE.lastTxHash = tx.hash;

      const txUrl = (window.UTILS?.txUrl ? UTILS.txUrl(tx.hash) : (C?.EXPLORER_TX ? (C.EXPLORER_TX + tx.hash) : `https://sepolia.basescan.org/tx/${tx.hash}`));
      const explorerLinkText = window.I18N ? I18N.t("tx.viewOnExplorer") : "View On Explorer ↗";

      if (isClaimTx) {
        showTxStatus(window.I18N ? I18N.t("tx.txSent") : "Transaction sent", "info", {}, true);
        setClaimExplorerLink(txUrl);
      } else {
        showTxStatus(
          `${window.I18N ? I18N.t("tx.txSent") : "Transaction sent"}<br><a href="${UI.escapeHtml(txUrl)}" target="_blank" rel="noopener noreferrer" class="underline text-green-400">${explorerLinkText}</a>`,
          "info",
          { html: true },
          false
        );
      }

      // Use readProvider (direct RPC) for receipt polling to avoid mobile wallet
      // provider instability; fall back to tx.wait() if readProvider unavailable.
      const receipt = STATE.readProvider
        ? await STATE.readProvider.waitForTransaction(tx.hash, 1, 120000)
        : await tx.wait();

      if (isClaimTx) {
        showTxStatus(UI.escapeHtml(opts.successText || "Transaction confirmed"), "success", {}, true);
        setClaimExplorerLink(txUrl);
      } else if (!opts.suppressSuccess) {
        showTxStatus(
          `${UI.escapeHtml(opts.successText || "Transaction confirmed")}<br><a href="${UI.escapeHtml(txUrl)}" target="_blank" rel="noopener noreferrer" class="underline text-green-400">${explorerLinkText}</a>`,
          "success",
          { html: true },
          false
        );
      }

      return receipt;
    } catch (err) {
      showTxStatus(UI.safeError(err), "error", {}, isClaimTx);
      throw err;
    } finally {
      STATE.isBusy = false;
      UI.setBusy(false);
    }
  }

  window.TX = { send, sendRaw };
})();
