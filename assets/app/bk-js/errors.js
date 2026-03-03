// assets/app/errors.js
(function(){
  window.ERRORS = {
    mapError(e){
      if (!e) return "Unknown error";

      const msg = e.reason || e.message || String(e);

      if (msg.includes("insufficient funds")) return "Insufficient ETH for gas.";
      if (msg.includes("ERC20: transfer amount exceeds balance")) return "Not enough USDC balance.";
      if (msg.includes("user rejected")) return "Transaction rejected in wallet.";

      return msg;
    }
  };
})();
