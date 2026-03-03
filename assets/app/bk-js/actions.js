// assets/app/actions.js
(function () {
  function parseUSDC(s) {
    const v = (s || "").trim();
    if (!v) return ethers.constants.Zero;
    return ethers.utils.parseUnits(v, C.DEC);
  }

  function updateCreatorTotals() {
    const monthly = parseFloat(UI.$("ownerMonthly")?.value || "0");
    const total = monthly > 0 ? (monthly * C.TOTAL) : 0;
    UI.setText("ownerTotal", total ? total.toFixed(2) : "—");

    // 简单启用/禁用
    UI.$("btnOwnerApprove") && (UI.$("btnOwnerApprove").disabled = !(monthly > 0));
    UI.$("btnOwnerCreate") && (UI.$("btnOwnerCreate").disabled = !(monthly > 0));
  }

  async function ownerApprove(state) {
    const monthly = parseUSDC(UI.$("ownerMonthly")?.value);
    const total = monthly.mul(C.TOTAL);
 
    await runTx("Approve USDC", async () => state.usdc.approve(C.FLOW, total), state);
    await window.READ.refreshAll(state);
  }

  async function ownerCreate(state) {
    const ben = (UI.$("ownerBeneficiary")?.value || "").trim();
    if (!ethers.utils.isAddress(ben)) throw new Error("Invalid beneficiary address");

    const monthly = parseUSDC(UI.$("ownerMonthly")?.value);

    // startAt = latest block ts + delay
    const block = await state.provider.getBlock("latest");
    const startAt = ethers.BigNumber.from(block.timestamp + C.START_DELAY);
    await runTx("Create Vest", async () => state.flow.createVest(ben, startAt, monthly), state);
     await window.READ.refreshAll(state);
  }

  async function ownerTerminate(state) {
    // 你后面加：terminate allowed 校验（根据 selected vest）
    UI.log("Terminate not wired yet (hook id here).");
  }

  async function claim(state) {
    const ids = window.READ.getClaimableVestIds();
    if (!ids.length) return alert("Nothing claimable.");

    for (const id of ids) {
     await runTx(`Release #${id}`, async () => state.flow.release(id), state);
    }
    alert("Claim complete ✅");
    await window.READ.refreshAll(state);
  }

  window.ACTIONS = {
    updateCreatorTotals,
    ownerApprove,
    ownerCreate,
    ownerTerminate,
    claim,
  };
})();
