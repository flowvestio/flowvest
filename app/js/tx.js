(function () {
  async function send(txFactory, opts = {}) {
    if (STATE.isBusy) throw new Error("Another transaction is in progress");

    STATE.isBusy = true;
    UI.setBusy(true);

    try {
      UI.showStatus(opts.pendingText || "Waiting for wallet confirmation...");

      const tx = await txFactory();

      if (!tx?.hash) throw new Error("Transaction was not created");

      STATE.lastTxHash = tx.hash;

      UI.showStatus(
        `Transaction sent<br><a href="https://sepolia.basescan.org/tx/${tx.hash}" target="_blank" class="underline">View on BaseScan ↗</a>`
      );

      const receipt = await tx.wait();

      UI.showSuccess(
        `${opts.successText || "Transaction confirmed"}<br><a href="https://sepolia.basescan.org/tx/${tx.hash}" target="_blank" class="underline">View on BaseScan ↗</a>`
      );

      return receipt;
    } catch (err) {
      UI.showError(UTILS.safeError(err));
      throw err;
    } finally {
      STATE.isBusy = false;
      UI.setBusy(false);
    }
  }

  window.TX = { send };
})();
