// Used to verify the browser loaded the latest JS bundle.
window.__FV_SAVING_UI_VERSION__ = "2026-04-30.1";

// ===== CONFIG =====
const BASE_MAINNET = {
  chainId: "0x2105",
  chainName: "Base",
  rpcUrls: ["https://base-rpc.publicnode.com"],
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  blockExplorerUrls: ["https://basescan.org"],
};
const EXPLORER = "https://basescan.org";
const TARGET_CHAIN_ID = 8453;
const CONTRACT_ABI = [
  "function createPlan(uint256 goal, uint256 duration) external returns (uint256 id)",
  "function deposit(uint256 id, uint256 amount, bool confirmDonate) external",
  "function claim(uint256 id) external",
  "function canClaim(uint256 id) external view returns (bool)",
  "function maxDeposit(uint256 id) external view returns (uint256)",
  "function remaining(uint256 id) external view returns (uint256)",
  "function plans(uint256 id) external view returns (address owner, uint256 goal, uint256 saved, uint256 startAt, uint256 unlockAt, bool claimed)",
  "function token() external view returns (address)",
  "function totalPrincipal() external view returns (uint256)",
  "function tvlCap() external view returns (uint256)",
  "function planCount() external view returns (uint256)",
  "function maxPrincipal() external view returns (uint256)",
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

const USDC_DECIMALS = 6;
const ONE_USDC = ethers.BigNumber.from(10).pow(USDC_DECIMALS);

// ethers v5 + MetaMask on Base: tx responses can omit BigNumberish fields.
// Normalize before ethers' formatter calls BigNumber.from(undefined).
(function patchEthersFormatter() {
  const proto = ethers.providers?.Formatter?.prototype;
  if (!proto) return;
  const missing = (value) => value == null || value === "undefined" || value === "null";
  const normalizeBigNumberishFields = (transaction) => {
    if (!transaction || typeof transaction !== "object") return transaction;
    const normalized = { ...transaction };

    Object.keys(normalized).forEach((key) => {
      if (normalized[key] === undefined) delete normalized[key];
    });

    if (missing(normalized.value)) normalized.value = "0x0";
    if (missing(normalized.gasLimit)) {
      normalized.gasLimit = normalized.gas ?? normalized.gas_limit ?? "0x0";
    }
    if (missing(normalized.gasPrice) && !missing(normalized.maxFeePerGas)) {
      normalized.gasPrice = normalized.maxFeePerGas;
    }
    if (missing(normalized.maxFeePerGas)) delete normalized.maxFeePerGas;
    if (missing(normalized.maxPriorityFeePerGas)) delete normalized.maxPriorityFeePerGas;

    return normalized;
  };

  const origCheck = proto.check;
  proto.check = function(format, object) {
    return origCheck.call(this, format, normalizeBigNumberishFields(object));
  };

  const origNumber = proto.number;
  if (origNumber) {
    proto.number = function(value) {
      return origNumber.call(this, missing(value) ? "0x0" : value);
    };
  }

  const orig = proto.transactionResponse;
  proto.transactionResponse = function(transaction) {
    return orig.call(this, normalizeBigNumberishFields(transaction));
  };
})();

// ===== STATE =====
let provider, signer, userAddress, walletProvider, wcProvider;
let selectedGoal = null;
let selectedDays = null;
let tokenContractCache = null;
let tokenContractCacheKey = "";

// ===== INPUT SANITIZERS =====
function sanitizeUintString(raw) {
  return String(raw ?? "").trim().replace(/[^\d]/g, "");
}

function parsePlanIdFromInput(inputEl) {
  const cleaned = sanitizeUintString(inputEl?.value);
  if (inputEl && inputEl.value !== cleaned) inputEl.value = cleaned;
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

function parseUsdAmountFromInput(inputEl) {
  const raw = String(inputEl?.value ?? "").trim().replace(/,/g, "");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function toUsdcUnitsFromUsdNumber(amountNum) {
  if (!Number.isFinite(amountNum) || amountNum <= 0) throw new Error("INVALID_AMOUNT_NUMBER");
  const whole = Math.round(amountNum);
  if (!Number.isFinite(whole) || whole <= 0) throw new Error("INVALID_AMOUNT_WHOLE");
  return ethers.BigNumber.from(String(whole)).mul(ONE_USDC);
}

// ===== WALLET =====
function getInjectedProvider(kind = "other") {
  const eth = window.ethereum;
  const providers = eth?.providers || [];
  if (kind === "metamask") return providers.find(p => p.isMetaMask) || (eth?.isMetaMask ? eth : null) || eth;
  if (kind === "trust") return providers.find(p => p.isTrust || p.isTrustWallet) || (eth?.isTrust || eth?.isTrustWallet ? eth : null) || eth;
  return eth;
}

async function connectWallet(selectedProvider = null) {
  const eth = selectedProvider || walletProvider || window.ethereum;
  if (!eth) { openWalletChooser(); return; }
  walletProvider = eth;
  provider = new ethers.providers.Web3Provider(eth, "any");
  await provider.send("eth_requestAccounts", []);

  const network = await provider.getNetwork();
  if (network.chainId !== TARGET_CHAIN_ID) {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_MAINNET.chainId }] });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        await eth.request({ method: "wallet_addEthereumChain", params: [BASE_MAINNET] });
      } else { throw switchErr; }
    }
    provider = new ethers.providers.Web3Provider(eth, "any");
  }

  signer = provider.getSigner();
  userAddress = await signer.getAddress();

  const btn = document.getElementById("btnConnect");
  btn.textContent = shortAddr(userAddress);
  btn.disabled = false;

  updateCreateButton();
  await refreshBalance();
  loadContractParams().catch(err => console.warn("[connect loadContractParams]", err));
  loadMyPlans().catch(err => console.warn("[connect loadMyPlans]", err));
}

async function refreshConnectedWalletState(accounts = null) {
  const eth = walletProvider || window.ethereum;
  if (!eth) return disconnectWallet();
  const nextAccounts = accounts || await eth.request({ method: "eth_accounts" });
  if (!nextAccounts || !nextAccounts.length) return disconnectWallet();

  walletProvider = eth;
  provider = new ethers.providers.Web3Provider(eth, "any");
  const network = await provider.getNetwork();
  if (network.chainId !== TARGET_CHAIN_ID) {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_MAINNET.chainId }] });
      provider = new ethers.providers.Web3Provider(eth, "any");
    } catch (err) {
      console.warn("[wallet:chainChanged]", err);
      return;
    }
  }

  signer = provider.getSigner();
  userAddress = ethers.utils.getAddress(nextAccounts[0]);
  document.getElementById("btnConnect").textContent = shortAddr(userAddress);
  document.getElementById("walletMenu").style.display = "none";
  clearStatus(document.getElementById("statusCreate"));
  clearStatus(document.getElementById("statusDeposit"));
  clearStatus(document.getElementById("statusClaim"));
  updateCreateButton();
  await refreshBalance();
  loadContractParams().catch(err => console.warn("[wallet refresh loadContractParams]", err));
  loadMyPlans().catch(err => console.warn("[wallet refresh loadMyPlans]", err));
  if (depositPlanData) {
    checkDonateNotice();
    await loadPlanForDeposit();
  }
  if (parsePlanIdFromInput(document.getElementById("claimPlanId"))) await loadPlanForClaim();
}

async function loadContractParams() {
  try {
    const contract = getContract();
    const [maxPrinc, tvl] = await Promise.all([
      contract.maxPrincipal(),
      contract.totalPrincipal(),
    ]);
    applyGoalLimits(maxPrinc);
    const tvlNum = Number(tvl) / 1e6;
    const el = document.getElementById("tvlDisplay");
    if (el) el.textContent = "$" + tvlNum.toLocaleString("en-US", { maximumFractionDigits: 0 });
  } catch {}
}

function applyGoalLimits(maxPrinc) {
  const maxUsd = maxPrinc.div(ONE_USDC).toNumber();
  document.querySelectorAll(".chip").forEach(el => {
    const val = parseInt(el.textContent.replace("$", "").replace(",", ""));
    if (val > maxUsd) {
      el.style.opacity = "0.35"; el.style.pointerEvents = "none";
      el.title = "Exceeds contract max principal";
    } else {
      el.style.opacity = ""; el.style.pointerEvents = ""; el.title = "";
    }
  });
  const customInput = document.getElementById("customGoal");
  customInput.max = maxUsd;
  customInput.placeholder = `Min $200, max $${maxUsd.toLocaleString()}`;
}

function shortAddr(addr) { return addr.slice(0, 6) + "..." + addr.slice(-4); }

function getContract() {
  const addr = document.getElementById("contractAddr").value.trim();
  if (!addr || !ethers.utils.isAddress(addr)) throw new Error("Invalid contract address.");
  if (!signer) throw new Error("Wallet not connected.");
  return new ethers.Contract(addr, CONTRACT_ABI, signer);
}

async function getTokenContract() {
  const contractAddr = document.getElementById("contractAddr").value.trim().toLowerCase();
  if (tokenContractCache && tokenContractCacheKey === contractAddr) return tokenContractCache;
  const c = getContract();
  const tokenAddr = await c.token();
  tokenContractCache = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
  tokenContractCacheKey = contractAddr;
  return tokenContractCache;
}

async function sendPopulatedTransaction(contract, method, args) {
  const eth = walletProvider || window.ethereum;
  if (!eth) throw new Error("Wallet not connected.");
  if (!provider || !userAddress) throw new Error("Wallet not connected.");

  const txReq = await contract.populateTransaction[method](...args);
  if (!txReq.to || !ethers.utils.isAddress(txReq.to)) {
    throw new Error(`Invalid transaction target for ${method}.`);
  }
  if (!txReq.data || !ethers.utils.isHexString(txReq.data)) {
    throw new Error(`Invalid transaction data for ${method}.`);
  }

  const txParams = {
    from: ethers.utils.getAddress(userAddress),
    to: ethers.utils.getAddress(txReq.to),
    data: txReq.data,
  };
  if (txReq.value && !ethers.BigNumber.from(txReq.value).isZero()) {
    txParams.value = ethers.BigNumber.from(txReq.value).toHexString();
  }

  try {
    const hash = await eth.request({
      method: "eth_sendTransaction",
      params: [txParams],
    });

    return makeTxHandle(hash);
  } catch (rawErr) {
    console.warn("[sendPopulatedTransaction:raw]", { method, txParams, rawErr });
    const rawMsg = String(rawErr?.message || rawErr || "").toLowerCase();
    if (!rawMsg.includes("invalid params") && rawErr?.code !== -32602) throw rawErr;

    // Some wallet providers are stricter about raw EIP-1193 tx params.
    // Fall back to ethers Signer.sendTransaction with the same calldata.
    const fallbackTx = {
      to: txParams.to,
      data: txParams.data,
    };
    if (txParams.value) fallbackTx.value = txParams.value;
    const fallback = await signer.sendTransaction(fallbackTx);
    return makeTxHandle(fallback.hash);
  }
}

function makeTxHandle(hash) {
  return {
    hash,
    wait: async () => {
      const ro = new ethers.providers.JsonRpcProvider(BASE_MAINNET.rpcUrls[0]);
      return ro.waitForTransaction(hash, 1, 120000);
    },
  };
}

// ===== TABS =====
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t, i) => {
    t.classList.toggle("active", ["create","deposit","claim"][i] === name);
  });
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById("panel-" + name).classList.add("active");
  clearStatus(document.getElementById("statusCreate"));
  clearStatus(document.getElementById("statusDeposit"));
  clearStatus(document.getElementById("statusClaim"));
  if (name === "deposit" || name === "claim") loadMyPlans();
}

// ===== CREATE =====
function selectGoal(usd, el) {
  selectedGoal = usd;
  document.getElementById("customGoal").value = "";
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  updateCreatePreview();
  updateCreateButton();
}

function onCustomGoal(val) {
  const hint = document.getElementById("goalHint");
  const input = document.getElementById("customGoal");
  const num = val ? parseFloat(val) : null;
  if (num !== null && num < 200) {
    hint.textContent = "Minimum is $200."; hint.style.display = "block";
    hint.style.color = "#f87171"; input.style.borderColor = "#f87171";
    selectedGoal = null;
  } else if (num !== null && num > 3000) {
    hint.textContent = "Maximum is $3,000."; hint.style.display = "block";
    hint.style.color = "#f87171"; input.style.borderColor = "#f87171";
    selectedGoal = null;
  } else {
    hint.style.display = "none"; input.style.borderColor = "";
    selectedGoal = num;
  }
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
  updateCreatePreview();
  updateCreateButton();
}

function selectDuration(days, el) {
  selectedDays = days;
  document.querySelectorAll(".duration-option").forEach(d => d.classList.remove("selected"));
  el.classList.add("selected");
  updateCreatePreview();
  updateCreateButton();
}

function updateCreatePreview() {
  const preview = document.getElementById("unlockPreview");
  const dateEl = document.getElementById("unlockDate");
  const btnCreate = document.getElementById("btnCreate");
  if (selectedDays) {
    const d = new Date(Date.now() + selectedDays * 1000);
    dateEl.textContent = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    preview.classList.add("visible");
  } else {
    preview.classList.remove("visible");
  }
  const summary = document.getElementById("createSummary");
  if (selectedGoal) {
    const monthsMap = { 7776000: "3 months", 15552000: "6 months", 31104000: "12 months", 46656000: "18 months" };
    document.getElementById("summaryGoal").textContent = `$${selectedGoal.toLocaleString()}`;
    if (selectedDays) {
      const unlockStr = new Date(Date.now() + selectedDays * 1000)
        .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      document.getElementById("summaryMonths").textContent = monthsMap[selectedDays] || `${selectedDays / 30} months`;
      document.getElementById("summaryUnlock").textContent = unlockStr;
      btnCreate.textContent = `Start saving $${selectedGoal.toLocaleString()} →`;
    } else {
      document.getElementById("summaryMonths").textContent = "— select duration";
      document.getElementById("summaryUnlock").textContent = "—";
      btnCreate.textContent = "Start saving →";
    }
    summary.style.display = "block";
  } else {
    summary.style.display = "none";
    btnCreate.textContent = "Start saving →";
  }
}

function updateCreateButton() {
  const btn = document.getElementById("btnCreate");
  btn.disabled = !(selectedGoal && selectedGoal >= 200 && selectedDays && signer);
}

async function createPlan() {
  const btn = document.getElementById("btnCreate");
  const status = document.getElementById("statusCreate");
  if (!selectedGoal || selectedGoal < 200) return showStatus(status, "error", "Minimum goal is $200.");
  if (!selectedDays) return showStatus(status, "error", "Please select a duration.");
  try {
    const contract = getContract();
    const goal = toUsdcUnitsFromUsdNumber(selectedGoal);
    btn.disabled = true;
    showStatus(status, "loading", "Sending transaction...");
    const tx = await sendPopulatedTransaction(contract, "createPlan", [goal, selectedDays]);
    showStatus(status, "loading", `Tx sent — waiting... <a href="${EXPLORER}/tx/${tx.hash}" target="_blank">${shortAddr(tx.hash)}</a>`);
    const receipt = await tx.wait();
    const iface = new ethers.utils.Interface(["event PlanCreated(uint256 indexed id, address indexed user, uint256 goal, uint256 startAt, uint256 unlockAt, uint256 duration)"]);
    let planId = "?";
    for (const log of receipt.logs) {
      try { const parsed = iface.parseLog(log); planId = parsed.args.id.toString(); break; } catch {}
    }
    showStatus(status, "success", `Plan #${planId} created! <button onclick="switchTab('deposit'); fillDepositId('${planId}')" style="margin-left:10px; background:transparent; border:1px solid #10b981; color:#10b981; border-radius:6px; padding:3px 12px; cursor:pointer; font-size:13px;">Add funds now →</button>`);
    document.getElementById("createSummary").style.display = "none";
    document.getElementById("unlockPreview").classList.remove("visible");
    btn.textContent = "Start saving →";
    selectedGoal = null; selectedDays = null;
  } catch (err) {
    console.error("[createPlan]", err);
    showStatus(status, "error", parseError(err));
  } finally { updateCreateButton(); }
}

// ===== MY PLANS =====
async function loadMyPlans() {
  const targets = [
    { el: document.getElementById("myPlansList"),      onclick: "fillDepositId" },
    { el: document.getElementById("myPlansListClaim"), onclick: "fillClaimId"  },
  ];
  targets.forEach(({ el }) => {
    if (el) el.textContent = userAddress ? "Loading..." : "Connect wallet to load.";
  });
  if (!userAddress) return;
  try {
    const contract = getContract();
    const count = (await contract.planCount()).toNumber();
    const mine = [];
    for (let i = 1; i <= count; i++) {
      const plan = await contract.plans(i);
      if (plan.owner.toLowerCase() === userAddress.toLowerCase()) mine.push({ id: i, plan });
    }
    const html = mine.length === 0
      ? `<span style="color:#bbb;">None</span>`
      : mine.map(({ id, plan }) => {
          const unlockDate = new Date(plan.unlockAt.toNumber() * 1000)
            .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const isLocked = Date.now() / 1000 < plan.unlockAt.toNumber();
          const statusColor = plan.claimed ? "#aaa" : isLocked ? "#7C3AED" : "#16a34a";
          const statusText = plan.claimed ? "claimed" : isLocked ? "locked" : "unlocked";
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f0f0f0;cursor:pointer;" onclick="ONCLICK(${id})" title="Click to fill Plan ID">
            <span><strong style="color:#7C3AED;">#${id}</strong> · $${formatUsdc(plan.saved)} / $${formatUsdc(plan.goal)} · <span style="color:#888;font-size:12px;">${unlockDate}</span></span>
            <span style="font-size:11px;color:${statusColor};">${statusText}</span>
          </div>`;
        }).join("") + `<div style="font-size:11px;color:#ccc;margin-top:8px;">Click a row to fill the Plan ID.</div>`;
    targets.forEach(({ el, onclick }) => { if (el) el.innerHTML = html.replaceAll("ONCLICK", onclick); });
  } catch (err) {
    console.error("[loadMyPlans]", err);
    const msg = `<span style="color:#991b1b;">${parseError(err)}</span>`;
    targets.forEach(({ el }) => { if (el) el.innerHTML = msg; });
  }
}

function depositZeroReason(plan, totalPrincipal, tvlCap) {
  if (plan.claimed) return "already claimed";
  if (Date.now() / 1000 >= plan.unlockAt.toNumber()) return "plan already unlocked";
  if (plan.saved.gte(plan.goal.mul(12000).div(10000))) return "120% cap reached";
  if (totalPrincipal.gte(tvlCap)) return "TVL cap full";
  return "unavailable";
}

function fillDepositId(id) { document.getElementById("depositPlanId").value = id; loadPlanForDeposit(); }
function fillClaimId(id)   { document.getElementById("claimPlanId").value = id;   loadPlanForClaim(); }

// ===== DEPOSIT =====
let depositPlanData = null;

async function loadPlanForDeposit() {
  const idEl = document.getElementById("depositPlanId");
  const idNum = parsePlanIdFromInput(idEl);
  const idStr = idNum ? String(idNum) : "";
  const infoEl = document.getElementById("depositPlanInfo");
  const formEl = document.getElementById("depositForm");
  const statusEl = document.getElementById("statusDeposit");
  depositPlanData = null;
  formEl.style.display = "none";
  infoEl.classList.remove("visible");
  clearStatus(statusEl);
  if (!idNum) return;
  try {
    const contract = getContract();
    const [plan, maxDep, rem, totalPrincipal, tvlCap] = await Promise.all([
      contract.plans(idNum), contract.maxDeposit(idNum), contract.remaining(idNum),
      contract.totalPrincipal(), contract.tvlCap(),
    ]);
    if (plan.owner === ethers.constants.AddressZero) return showPlanInfo(infoEl, "Plan not found.");
    depositPlanData = { id: idStr, plan, maxDep };
    const unlockDate = new Date(plan.unlockAt.toNumber() * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const isLocked = Date.now() / 1000 < plan.unlockAt.toNumber();
    const isOwner = userAddress && plan.owner.toLowerCase() === userAddress.toLowerCase();
    infoEl.innerHTML = `
      <div class="plan-info-row"><span class="key">Plan ID</span><span class="val">#${idStr}</span></div>
      <div class="plan-info-row"><span class="key">Owner</span><span class="val">${shortAddr(plan.owner)}${isOwner ? " (you)" : ""}</span></div>
      <div class="plan-info-row"><span class="key">Goal</span><span class="val">$${formatUsdc(plan.goal)}</span></div>
      <div class="plan-info-row"><span class="key">Saved</span><span class="val purple">$${formatUsdc(plan.saved)}</span></div>
      <div class="plan-info-row"><span class="key">Remaining to goal</span><span class="val">$${formatUsdc(rem)}</span></div>
      <div class="plan-info-row"><span class="key">Max deposit</span><span class="val ${maxDep.gt(0) ? "green" : "red"}">$${formatUsdc(maxDep)}${maxDep.isZero() ? ` <span style="font-weight:normal;font-size:11px;">(${depositZeroReason(plan, totalPrincipal, tvlCap)})</span>` : ""}</span></div>
      <div class="plan-info-row"><span class="key">Unlocks</span><span class="val">${unlockDate}</span></div>
      <div class="plan-info-row"><span class="key">Status</span><span class="val ${isLocked ? "purple" : "red"}">${plan.claimed ? "Claimed" : isLocked ? "Locked" : "Unlocked (not yet claimed)"}</span></div>
    `;
    infoEl.classList.add("visible");
    if (!plan.claimed && isLocked && maxDep.gt(0)) {
      formEl.style.display = "block";
      document.getElementById("donateConfirm").checked = false;
      checkDonateNotice();
    }
  } catch (err) {
    console.error("[loadPlanForDeposit]", err);
    showPlanInfo(infoEl, parseError(err));
  }
}

function showPlanInfo(el, msg) {
  el.innerHTML = `<div style="color:#888;">${msg}</div>`;
  el.classList.add("visible");
}

function checkDonateNotice() {
  const notice = document.getElementById("donateNotice");
  const checkbox = document.getElementById("donateConfirm");
  if (!depositPlanData || !userAddress) { notice.classList.remove("visible"); updateDepositButton(); return; }
  const isOwner = depositPlanData.plan.owner.toLowerCase() === userAddress.toLowerCase();
  notice.classList.toggle("visible", !isOwner);
  if (isOwner) checkbox.checked = false;
  updateDepositButton();
}

function onDonateConfirmChange() { updateDepositButton(); }

function updateDepositButton() {
  const btn = document.getElementById("btnDeposit");
  if (!depositPlanData || !userAddress) { btn.disabled = true; return; }
  const isOwner = depositPlanData.plan.owner.toLowerCase() === userAddress.toLowerCase();
  btn.disabled = !isOwner && !document.getElementById("donateConfirm").checked;
}

async function approveUsdc() {
  const status = document.getElementById("statusDeposit");
  const amountNum = parseUsdAmountFromInput(document.getElementById("depositAmount"));
  if (!amountNum) return showStatus(status, "error", "Enter a valid amount.");
  try {
    const tokenContract = await getTokenContract();
    const contractAddr = document.getElementById("contractAddr").value.trim();
    showStatus(status, "loading", "Approving USDC...");
    // Use MaxUint256 so the user only needs to approve once
    const tx = await sendPopulatedTransaction(tokenContract, "approve", [contractAddr, ethers.constants.MaxUint256]);
    showStatus(status, "loading", "Waiting for approval confirmation...");
    await tx.wait();
    showStatus(status, "success", "USDC approved. You can now deposit.");
    document.getElementById("btnApprove").style.display = "none";
    document.getElementById("btnDeposit").style.display = "flex";
  } catch (err) {
    console.error("[approveUsdc]", err);
    showStatus(status, "error", parseError(err));
  }
}

async function doDeposit() {
  const status = document.getElementById("statusDeposit");
  const amountNum = parseUsdAmountFromInput(document.getElementById("depositAmount"));
  const idNum = parsePlanIdFromInput(document.getElementById("depositPlanId"));
  if (!depositPlanData) return showStatus(status, "error", "Load a plan first.");
  if (!idNum) return showStatus(status, "error", "Enter a valid Plan ID.");
  if (!amountNum) return showStatus(status, "error", "Enter a valid amount.");
  let amount;
  try {
    amount = toUsdcUnitsFromUsdNumber(amountNum);
  } catch (e) {
    return showStatus(status, "error", "Invalid amount — whole numbers only (e.g. 30).");
  }
  try {
    const contractAddr = document.getElementById("contractAddr").value.trim();
    const tokenContract = await getTokenContract();
    const allowance = await tokenContract.allowance(userAddress, contractAddr);
    if (allowance.lt(amount)) {
      document.getElementById("btnApprove").style.display = "flex";
      document.getElementById("btnDeposit").style.display = "none";
      return showStatus(status, "info", "Allowance insufficient — approve USDC first.");
    }
  } catch (err) {
    console.error("[doDeposit:allowance]", err);
    return showStatus(status, "error", parseError(err));
  }
  const confirmDonate = depositPlanData.plan.owner.toLowerCase() !== userAddress.toLowerCase();
  try {
    const contract = getContract();
    document.getElementById("btnDeposit").disabled = true;
    showStatus(status, "loading", "Sending transaction...");
    const tx = await sendPopulatedTransaction(contract, "deposit", [idNum, amount, confirmDonate]);
    showStatus(status, "loading", `Tx sent — waiting... <a href="${EXPLORER}/tx/${tx.hash}" target="_blank">${shortAddr(tx.hash)}</a>`);
    await tx.wait();
    showStatus(status, "success", `Deposited $${amountNum} to Plan #${depositPlanData.id}.`);
    refreshBalance();
    await loadPlanForDeposit();
    await loadMyPlans();
    setTimeout(() => {
      loadPlanForDeposit().catch((err) => console.warn("[deposit refresh plan]", err));
      loadMyPlans().catch((err) => console.warn("[deposit refresh plans]", err));
    }, 1500);
  } catch (err) {
    console.error("[doDeposit:deposit]", err);
    showStatus(status, "error", parseError(err));
  } finally {
    document.getElementById("btnDeposit").disabled = false;
  }
}

// ===== CLAIM =====
let claimPlanId = null;

async function loadPlanForClaim() {
  const idEl = document.getElementById("claimPlanId");
  const idNum = parsePlanIdFromInput(idEl);
  const infoEl = document.getElementById("claimPlanInfo");
  const btnClaim = document.getElementById("btnClaim");
  claimPlanId = null; btnClaim.style.display = "none"; infoEl.classList.remove("visible");
  if (!idNum) return;
  try {
    const contract = getContract();
    const [plan, canClaimVal] = await Promise.all([contract.plans(idNum), contract.canClaim(idNum)]);
    if (plan.owner === ethers.constants.AddressZero) {
      infoEl.innerHTML = `<div style="color:#888;">Plan not found.</div>`; infoEl.classList.add("visible"); return;
    }
    claimPlanId = String(idNum);
    const unlockDate = new Date(plan.unlockAt.toNumber() * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const isOwner = userAddress && plan.owner.toLowerCase() === userAddress.toLowerCase();
    const isUnlocked = Date.now() / 1000 >= plan.unlockAt.toNumber();
    infoEl.innerHTML = `
      <div style="background:#10b98115;border:1px solid #10b98140;border-radius:6px;padding:14px 16px;margin-bottom:10px;line-height:2;">
        <div style="font-size:11px;color:var(--fv-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Plan summary</div>
        <div><span style="color:#888;">Plan</span> &nbsp;<strong>#${claimPlanId}</strong></div>
        <div><span style="color:#888;">Available</span> &nbsp;<strong style="color:#7C3AED;">$${formatUsdc(plan.saved)}</strong></div>
        <div><span style="color:#888;">Unlocks</span> &nbsp;<strong>${unlockDate}</strong></div>
      </div>
      <div class="plan-info-row"><span class="key">Owner</span><span class="val">${shortAddr(plan.owner)}${isOwner ? " (you)" : ""}</span></div>
      <div class="plan-info-row"><span class="key">Status</span><span class="val ${plan.claimed ? "red" : isUnlocked ? "green" : "purple"}">${plan.claimed ? "Already claimed" : isUnlocked ? "Ready to claim" : "Still locked"}</span></div>
    `;
    infoEl.classList.add("visible");
    if (canClaimVal && isOwner) { btnClaim.style.display = "flex"; btnClaim.textContent = `Claim $${formatUsdc(plan.saved)} →`; }
  } catch (err) {
    console.error("[loadPlanForClaim]", err);
    infoEl.innerHTML = `<div style="color:#991b1b;">${parseError(err)}</div>`; infoEl.classList.add("visible");
  }
}

async function doClaim() {
  const status = document.getElementById("statusClaim");
  const btn = document.getElementById("btnClaim");
  if (!claimPlanId) return;
  try {
    const contract = getContract();
    btn.disabled = true;
    showStatus(status, "loading", "Sending transaction...");
    const tx = await sendPopulatedTransaction(contract, "claim", [claimPlanId]);
    showStatus(status, "loading", `Tx sent — waiting... <a href="${EXPLORER}/tx/${tx.hash}" target="_blank">${shortAddr(tx.hash)}</a>`);
    await tx.wait();
    showStatus(status, "success", "Claimed! Funds transferred to your wallet.");
    refreshBalance(); btn.style.display = "none"; await loadPlanForClaim();
  } catch (err) {
    console.error("[doClaim]", err);
    showStatus(status, "error", parseError(err));
  } finally { btn.disabled = false; }
}

// ===== WALLET MENU =====
function onWalletButtonClick() {
  if (!userAddress) { openWalletChooser(); return; }
  const menu = document.getElementById("walletMenu");
  menu.style.display = menu.style.display === "none" ? "block" : "none";
}

function openWalletChooser() {
  const el = document.getElementById("walletChooserOverlay");
  if (el) el.style.display = "block";
}

function closeWalletChooser() {
  const el = document.getElementById("walletChooserOverlay");
  if (el) el.style.display = "none";
}

async function connectInjectedWallet(kind) {
  try {
    const eth = getInjectedProvider(kind);
    if (!eth) throw new Error("Browser wallet not detected.");
    closeWalletChooser();
    await connectWallet(eth);
  } catch (err) {
    alert(parseError(err));
  }
}

async function showWalletConnectQr() {
  const qrBox = document.getElementById("wcQrBox");
  const placeholder = document.getElementById("wcQrPlaceholder");
  const hint = document.getElementById("wcQrHint");
  const btn = document.getElementById("btnShowWCQR");
  try {
    if (btn) { btn.disabled = true; btn.textContent = "Generating..."; }
    const mod = window["@walletconnect/ethereum-provider"];
    const EthereumProvider = mod?.EthereumProvider || mod?.default?.EthereumProvider || mod?.default || mod;
    if (!EthereumProvider?.init) throw new Error("WalletConnect SDK not loaded.");
    if (!wcProvider) {
      wcProvider = await EthereumProvider.init({
        projectId: "fbe0b5092e4461779c51f771d7826f44",
        chains: [TARGET_CHAIN_ID],
        methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData", "eth_signTypedData_v4"],
        optionalMethods: ["eth_accounts", "eth_chainId", "wallet_switchEthereumChain", "wallet_addEthereumChain"],
        showQrModal: false,
        rpcMap: { [TARGET_CHAIN_ID]: BASE_MAINNET.rpcUrls[0] },
        metadata: {
          name: "Flowvest",
          description: "Flowvest Saving",
          url: "https://app.flowvest.io",
          icons: ["https://app.flowvest.io/assets/logo/flowvest-logo.png"]
        }
      });
      wcProvider.on("display_uri", (uri) => renderWalletConnectQr(uri));
      wcProvider.on("connect", async () => {
        closeWalletChooser();
        await connectWallet(wcProvider);
      });
    }
    await wcProvider.connect();
  } catch (err) {
    if (hint) hint.textContent = parseError(err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Show QR"; }
  }

  function renderWalletConnectQr(uri) {
    if (!qrBox || !uri) return;
    qrBox.innerHTML = "";
    if (placeholder) placeholder.style.display = "none";
    qrBox.style.display = "flex";
    const inner = document.createElement("div");
    inner.style.background = "#fff";
    inner.style.borderRadius = "14px";
    inner.style.padding = "10px";
    qrBox.appendChild(inner);
    new QRCode(inner, { text: uri, width: 240, height: 240, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
    if (hint) hint.textContent = "Scan this QR code with your mobile wallet.";
  }
}

document.addEventListener("click", (e) => {
  if (!e.target.closest("#walletMenu") && !document.getElementById("btnConnect").contains(e.target)) {
    const menu = document.getElementById("walletMenu");
    if (menu) menu.style.display = "none";
  }
});

function copyAddress() { navigator.clipboard.writeText(userAddress); document.getElementById("walletMenu").style.display = "none"; }
function viewExplorer() { window.open(`${EXPLORER}/address/${userAddress}`, "_blank"); document.getElementById("walletMenu").style.display = "none"; }
function disconnectWallet() {
  userAddress = null; signer = null; provider = null; walletProvider = null;
  tokenContractCache = null; tokenContractCacheKey = "";
  document.getElementById("btnConnect").textContent = "Connect Wallet";
  document.getElementById("walletMenu").style.display = "none";
  document.getElementById("usdcBalance").textContent = "—";
  document.getElementById("myPlansList").textContent = "Connect wallet to load.";
  document.getElementById("myPlansListClaim").textContent = "Connect wallet to load.";
  updateCreateButton();
}

(function bindWalletEvents() {
  const eth = window.ethereum;
  if (!eth?.on || eth.__flowvestSavingBound) return;
  eth.__flowvestSavingBound = true;
  eth.on("accountsChanged", (accounts) => {
    refreshConnectedWalletState(accounts).catch(err => console.warn("[accountsChanged]", err));
  });
  eth.on("chainChanged", () => {
    refreshConnectedWalletState().catch(err => console.warn("[chainChanged]", err));
  });
})();

// ===== TVL (read-only) =====
async function loadTvlReadOnly() {
  try {
    const ro = new ethers.providers.JsonRpcProvider(BASE_MAINNET.rpcUrls[0]);
    const c = new ethers.Contract("0x10e7D68aF2230E43BB88336173567f8e800Ba664", ["function totalPrincipal() view returns (uint256)"], ro);
    const tvl = await c.totalPrincipal();
    const el = document.getElementById("tvlDisplay");
    if (el) el.textContent = "$" + (Number(tvl) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 });
  } catch {}
}
loadTvlReadOnly();

// ===== BALANCE =====
async function refreshBalance() {
  const el = document.getElementById("usdcBalance");
  if (!el || !userAddress) return;
  el.textContent = "Loading...";
  try { el.textContent = formatUsdc(await (await getTokenContract()).balanceOf(userAddress)); }
  catch { el.textContent = "—"; }
}

// ===== THEME =====
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  try { localStorage.setItem("fv_theme", isDark ? "dark" : "light"); } catch (_) {}
  document.getElementById("themeIcon").textContent = isDark ? "☀" : "☾";
}
(function initThemeIcon() {
  const el = document.getElementById("themeIcon");
  if (el) el.textContent = document.documentElement.classList.contains("dark") ? "☀" : "☾";
})();

// ===== UTILS =====
function formatUsdc(bn) {
  return parseFloat(ethers.utils.formatUnits(bn, USDC_DECIMALS))
    .toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function showStatus(el, type, msg) { el.className = `status visible ${type}`; el.innerHTML = msg; }
function clearStatus(el) { if (!el) return; el.className = "status"; el.innerHTML = ""; }

function parseError(err) {
  console.error("[parseError raw]", err);
  const reason = err?.reason ?? "";
  const msg = err?.message || String(err);
  if (reason.toLowerCase().includes("invalid bignumber") || msg.toLowerCase().includes("invalid bignumber") || err?.code === "INVALID_ARGUMENT") {
    return `Invalid input (code=${err?.code ?? "?"}, arg=${err?.argument ?? "?"}).`;
  }
  if (msg.toLowerCase().includes("invalid params") || err?.code === -32602) {
    return "Wallet rejected the transaction parameters. Please refresh and try again.";
  }
  if (reason) return reason;
  if (err?.data?.message) return err.data.message;
  const match = msg.match(/reason="([^"]+)"/);
  if (match) return match[1];
  if (msg.includes("user rejected")) return "Transaction rejected.";
  return msg.length > 120 ? msg.slice(0, 120) + "..." : msg;
}

// ===== INIT =====
document.getElementById("customGoal").addEventListener("focus", () => {
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
});
document.getElementById("contractAddr").addEventListener("input", () => {
  tokenContractCache = null; tokenContractCacheKey = "";
  updateCreateButton();
});
document.getElementById("depositPlanId")?.addEventListener("input", () => clearStatus(document.getElementById("statusDeposit")));
document.getElementById("depositAmount")?.addEventListener("input", () => clearStatus(document.getElementById("statusDeposit")));
document.getElementById("claimPlanId")?.addEventListener("input", () => clearStatus(document.getElementById("statusClaim")));

(function () {
  const el = document.getElementById("uiVersion");
  if (el && window.__FV_SAVING_UI_VERSION__) el.textContent = `v${window.__FV_SAVING_UI_VERSION__}`;
})();
