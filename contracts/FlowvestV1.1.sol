// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// @title Flowvest V1.1
// @notice Programmable stablecoin vesting on Base
contract FlowvestV1_1 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public owner;

    uint256 public constant USDC_DECIMALS = 1e6;

    // ---------------- MAINNET CONFIG ----------------
    // Plan A = 30 days × 3 periods
    // Plan B = 14 days × 6 periods

    uint8 public constant PLAN_A = 1;
    uint8 public constant PLAN_B = 2;

    uint256 public constant PERIOD_A = 30 days;
    uint256 public constant PERIODS_A = 3;

    uint256 public constant PERIOD_B = 14 days;
    uint256 public constant PERIODS_B = 6;

    // Plan A: terminate after 2 periods (of 3)
    // Plan B: terminate after 4 periods (of 6)
    uint256 public constant MIN_TERMINATE_PERIODS_A = 2;
    uint256 public constant MIN_TERMINATE_PERIODS_B = 4;

    // Start time safety
    uint256 public constant MAX_START_DELAY = 180 days;
   
    // Minimum principal per vest
    uint256 public constant MIN_PRINCIPAL = 200 * USDC_DECIMALS;

    // Adjustable upward only
    uint256 public maxPrincipal;
    uint256 public tvlCap;

    // Hard safety ceilings
    uint256 public constant ABSOLUTE_TVL_CAP = 6_000_000 * USDC_DECIMALS;
    uint256 public constant ABSOLUTE_MAX_PRINCIPAL = 200_000 * USDC_DECIMALS;

    // Batch release limit
    uint256 public constant MAX_BATCH = 20;

    // Current locked principal across all active vests
    uint256 public totalPrincipal;
    uint256 public vestCount;

    struct Vest {
        address owner;
        address beneficiary;
        uint256 startAt;
        uint256 periodAmount;   // amount released per period
        uint256 principal;      // total locked amount
        uint256 releasedAmount; // cumulative released
        bool terminated;
        uint8 plan;             // PLAN_A or PLAN_B
    }

    mapping(uint256 => Vest) public vests;

    // ---------------- EVENTS ----------------

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TvlCapIncreased(uint256 oldValue, uint256 newValue);
    event MaxPrincipalIncreased(uint256 oldValue, uint256 newValue);

    event VestCreated(
        uint256 indexed id,
        address indexed owner_,
        address indexed beneficiary,
        uint256 startAt,
        uint256 periodAmount,
        uint256 principal,
        uint8 plan
    );
    
    event BatchReleased(
    address indexed caller,
    uint256 processedCount,
    uint256 totalAmount
    );
    
    event Released(uint256 indexed id, address indexed caller, uint256 amount);
    event Terminated(uint256 indexed id, uint256 paidToBeneficiary, uint256 refundedToOwner);

    // ---------------- MODIFIERS ----------------

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    // ---------------- CONSTRUCTOR ----------------

    constructor(
        address token_,
        address owner_,
        uint256 initialMaxPrincipal_,
        uint256 initialTvlCap_
    ) {
        require(token_ != address(0), "ZERO_TOKEN");
        require(owner_ != address(0), "ZERO_OWNER");

        require(initialMaxPrincipal_ >= MIN_PRINCIPAL, "MAX_BELOW_MIN");
        require(initialMaxPrincipal_ <= ABSOLUTE_MAX_PRINCIPAL, "MAX_TOO_HIGH");
        require(initialTvlCap_ >= initialMaxPrincipal_, "TVL_BELOW_MAX");
        require(initialTvlCap_ <= ABSOLUTE_TVL_CAP, "TVL_TOO_HIGH");

        token = IERC20(token_);
        owner = owner_;
        maxPrincipal = initialMaxPrincipal_;
        tvlCap = initialTvlCap_;

        emit OwnershipTransferred(address(0), owner_);
    }

    // ---------------- ADMIN ----------------

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");

        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function increaseTvlCap(uint256 newTvlCap) external onlyOwner {
        require(newTvlCap > tvlCap, "NOT_INCREASE");
        require(newTvlCap <= ABSOLUTE_TVL_CAP, "TVL_TOO_HIGH");

        uint256 old = tvlCap;
        tvlCap = newTvlCap;

        emit TvlCapIncreased(old, newTvlCap);
    }

    function increaseMaxPrincipal(uint256 newMaxPrincipal) external onlyOwner {
        require(newMaxPrincipal > maxPrincipal, "NOT_INCREASE");
        require(newMaxPrincipal <= ABSOLUTE_MAX_PRINCIPAL, "MAX_TOO_HIGH");
        require(newMaxPrincipal <= tvlCap, "MAX_ABOVE_TVL");

        uint256 old = maxPrincipal;
        maxPrincipal = newMaxPrincipal;

        emit MaxPrincipalIncreased(old, newMaxPrincipal);
    }

    // ---------------- INTERNAL HELPERS ----------------

    function _planConfig(
        uint8 plan
    )
        internal
        pure
        returns (
            uint256 period,
            uint256 totalPeriods,
            uint256 minTerminatePeriods
        )
    {
        if (plan == PLAN_A) {
            return (PERIOD_A, PERIODS_A, MIN_TERMINATE_PERIODS_A);
        }
        if (plan == PLAN_B) {
            return (PERIOD_B, PERIODS_B, MIN_TERMINATE_PERIODS_B);
        }
        revert("INVALID_PLAN");
    }

    // ---------------- CREATE ----------------

    function createVest(
        address beneficiary_,
        uint256 startAt_,
        uint256 periodAmount_,
        uint8 plan_
    ) external nonReentrant returns (uint256 id) {
        require(plan_ == PLAN_A || plan_ == PLAN_B, "INVALID_PLAN");
        require(beneficiary_ != address(0), "ZERO_BENEFICIARY");
        require(beneficiary_ != address(token), "BENEFICIARY_IS_TOKEN");
        require(beneficiary_ != address(this), "BENEFICIARY_IS_CONTRACT");

        require(startAt_ >= block.timestamp, "START_IN_PAST");
        require(startAt_ <= block.timestamp + MAX_START_DELAY, "START_TOO_FAR");
        require(periodAmount_ > 0, "AMOUNT_ZERO");

        (, uint256 totalPeriods, ) = _planConfig(plan_);

        require(periodAmount_ <= maxPrincipal / totalPeriods, "AMOUNT_TOO_HIGH");

        uint256 principal = periodAmount_ * totalPeriods;

        require(principal >= MIN_PRINCIPAL, "PRINCIPAL_TOO_SMALL");
        require(principal <= maxPrincipal, "PRINCIPAL_TOO_HIGH");
        require(totalPrincipal + principal <= tvlCap, "TVL_CAP_REACHED");

        id = ++vestCount;

        vests[id] = Vest({
            owner: msg.sender,
            beneficiary: beneficiary_,
            startAt: startAt_,
            periodAmount: periodAmount_,
            principal: principal,
            releasedAmount: 0,
            terminated: false,
            plan: plan_
        });

        totalPrincipal += principal;

        token.safeTransferFrom(msg.sender, address(this), principal);

        emit VestCreated(id, msg.sender, beneficiary_, startAt_, periodAmount_, principal, plan_);
    }

    // ---------------- VIEW ----------------

    function duePeriods(uint256 id) public view returns (uint256) {
        Vest memory v = vests[id];
        if (v.owner == address(0)) return 0;
        if (v.terminated) return 0;
        if (block.timestamp < v.startAt) return 0;

        (uint256 period, uint256 totalPeriods, ) = _planConfig(v.plan);

        uint256 elapsed = block.timestamp - v.startAt;
        uint256 periods = elapsed / period;

        if (periods > totalPeriods) {
            periods = totalPeriods;
        }

        return periods;
    }

    function dueAmount(uint256 id) public view returns (uint256) {
        Vest memory v = vests[id];
        if (v.owner == address(0)) return 0;
        if (v.terminated) return 0;

        uint256 vested = duePeriods(id) * v.periodAmount;
        if (vested <= v.releasedAmount) return 0;

        return vested - v.releasedAmount;
    }

    function isCompleted(uint256 id) public view returns (bool) {
        Vest memory v = vests[id];
        if (v.owner == address(0)) return false;
        if (v.terminated) return false;

        (uint256 period, uint256 totalPeriods, ) = _planConfig(v.plan);

        return block.timestamp >= v.startAt + (totalPeriods * period);
    }

    function nextClaimAt(uint256 id) external view returns (uint256) {
        Vest memory v = vests[id];
        if (v.owner == address(0)) return 0;
        if (v.terminated) return 0;
        if (v.periodAmount == 0) return 0; // defensive check

        if (block.timestamp < v.startAt) return v.startAt;

        (uint256 period, uint256 totalPeriods, ) = _planConfig(v.plan);

        uint256 releasedPeriods = v.releasedAmount / v.periodAmount;

        if (releasedPeriods >= totalPeriods) return 0;

        return v.startAt + ((releasedPeriods + 1) * period);
    }

    function vestPlanInfo(uint256 id)
        external
        view
        returns (
            uint8 plan,
            uint256 period,
            uint256 totalPeriods,
            uint256 minTerminatePeriods
        )
    {
        Vest memory v = vests[id];
        require(v.owner != address(0), "NO_VEST");

        (uint256 p, uint256 tp, uint256 mt) = _planConfig(v.plan);
        return (v.plan, p, tp, mt);
    }

    // ---------------- RELEASE ----------------

    function release(uint256 id) external nonReentrant {
        Vest storage v = vests[id];

        require(v.owner != address(0), "NO_VEST");
        require(!v.terminated, "TERMINATED");
        require(block.timestamp >= v.startAt, "NOT_STARTED");

        uint256 amount = dueAmount(id);
        require(amount > 0, "NOTHING_DUE");

        v.releasedAmount += amount;

        require(totalPrincipal >= amount, "TVL_UNDERFLOW");
        totalPrincipal -= amount;

        token.safeTransfer(v.beneficiary, amount);

        emit Released(id, msg.sender, amount);
    }

    // ---------------- BATCH RELEASE ----------------

    function batchRelease(uint256[] calldata ids)
        external
        nonReentrant
        returns (uint256 processedCount, uint256 totalAmount)
    {
        uint256 len = ids.length;
        require(len > 0 && len <= MAX_BATCH, "INVALID_BATCH_SIZE");

        for (uint256 i = 0; i < len; i++) {
            uint256 id = ids[i];
            Vest storage v = vests[id];

            if (v.owner == address(0)) continue;
            if (v.terminated) continue;
            if (block.timestamp < v.startAt) continue;

            uint256 amount = dueAmount(id);
            if (amount == 0) continue;

            v.releasedAmount += amount;
            totalAmount += amount;
            processedCount += 1;

            token.safeTransfer(v.beneficiary, amount);

            emit Released(id, msg.sender, amount);
        }

        if (processedCount > 0) {
            require(totalPrincipal >= totalAmount, "TVL_UNDERFLOW");
            totalPrincipal -= totalAmount;

            emit BatchReleased(msg.sender, processedCount, totalAmount);
        }
    }

    // ---------------- TERMINATE ----------------

    function terminate(uint256 id) external nonReentrant {
        Vest storage v = vests[id];

        require(v.owner != address(0), "NO_VEST");
        require(msg.sender == v.owner, "NOT_OWNER");
        require(!v.terminated, "TERMINATED");

        (uint256 period, uint256 totalPeriods, uint256 minTerminatePeriods) = _planConfig(v.plan);

        require(
            block.timestamp >= v.startAt + (minTerminatePeriods * period),
            "LESS_THAN_MIN_PERIODS"
        );

        require(
            block.timestamp < v.startAt + (totalPeriods * period),
            "TERMINATE_WINDOW_CLOSED"
        );

        // --------- Checks done, now compute ---------

        uint256 amountDue = dueAmount(id);

        uint256 newReleasedAmount = v.releasedAmount + amountDue;
        uint256 refundableToOwner = v.principal - newReleasedAmount;

        // --------- Effects (state updates first) ---------

        v.releasedAmount = newReleasedAmount;
        v.terminated = true;

        uint256 totalDeduction = amountDue + refundableToOwner;

        require(totalPrincipal >= totalDeduction, "TVL_UNDERFLOW");
        totalPrincipal -= totalDeduction;

        // --------- Interactions (transfers last) ---------

        if (amountDue > 0) {
            token.safeTransfer(v.beneficiary, amountDue);
        }

        if (refundableToOwner > 0) {
            token.safeTransfer(v.owner, refundableToOwner);
        }

        emit Terminated(id, amountDue, refundableToOwner);
    }
}
