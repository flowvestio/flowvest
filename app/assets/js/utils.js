(function () {
  function shortAddr(addr) {
    if (!addr) return "-";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  }

  function parseAmount(value, decimals = 6) {
    const v = String(value || "").trim();
    if (!v) throw new Error("Amount is required");
    return ethers.utils.parseUnits(v, decimals);
  }

  function formatAmount(value, decimals = 6) {
    try {
      return ethers.utils.formatUnits(value, decimals);
    } catch {
      return "0";
    }
  }

  function safeError(err) {
    if (!err) return "Unknown error";
    const ok = (v) => v && String(v) !== "null" && String(v) !== "undefined" && String(v) !== "[object Object]";
    if (ok(err?.data?.message)) return String(err.data.message);
    if (ok(err?.error?.message)) return String(err.error.message);
    if (ok(err?.reason)) return String(err.reason);
    if (ok(err?.message)) return String(err.message);
    const s = String(err);
    return ok(s) ? s : "Unknown error";
  }

  function txUrl(hash) {
    return hash ? C.EXPLORER_TX + hash : "#";
  }

  function addressUrl(addr) {
    if (!addr) return "#";
    return `${C.EXPLORER_ADDRESS}${addr}`;
  }

  window.UTILS = {
    shortAddr,
    parseAmount,
    formatAmount,
    safeError,
    txUrl,
    addressUrl
  };
})();
