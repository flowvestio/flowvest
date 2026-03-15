// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FlowvestV1Beta is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    uint256 public constant USDC_DECIMALS = 1e6;

    // TEST: 60 seconds per "month"
    uint256 public constant PERIOD = 60;
    uint256 public constant TOTAL_MONTHS = 3;

    uint256 public constant MIN_PRINCIPAL = 200 * USDC_DECIMALS;
    uint256 public constant MAX_PRINCIPAL = 10_000 * USDC_DECIMALS;
    uint256 public constant TVL_CAP = 200_000 * USDC_DECIMALS;

    // terminate must be after >= MIN_TERMINATE_PERIODS * PERIOD
    uint256 public constant MIN_TERMINATE_PERIODS = 2;

    // Current locked remaining principal across all active vests
    uint256 public totalPrincipal;

    uint256 public vestCount;

    struct Vest {
        address owner;
        address beneficiary;
        uint256 startAt;
        uint256 monthlyAmount;
        uint256 principal;
        uint256 releasedAmount;
        bool terminated;
    }

    mapping(uint256 => Vest) public vests;

    event VestCreated(
        uint256 indexed id,
        address indexed owner,
        address indexed beneficiary,
        uint256 startAt,
        uint256 monthlyAmount,
        uint256 principal
    );

    event Released(uint256 indexed id, address indexed caller, uint256 amount);

    event Terminated(uint256 indexed id, uint256 paidToBeneficiary, uint256 refundedToOwner);

    constructor(address token_) {
        require(token_ != address(0), "ZERO_TOKEN");
        token = IERC20(token_);
    }

    // ---------------- CREATE ----------------

    function createVest(
        address beneficiary_,
        uint256 startAt_,
        uint256 monthlyAmount_
    ) external nonReentrant returns (uint256 id) {
        require(beneficiary_ != address(0), "ZERO_BENEFICIARY");
        require(startAt_ >= block.timestamp, "START_IN_PAST");
        require(monthlyAmount_ > 0, "MONTHLY_ZERO");
        require(monthlyAmount_ <= MAX_PRINCIPAL / TOTAL_MONTHS, "MONTHLY_TOO_HIGH");
        uint256 principal = monthlyAmount_ * TOTAL_MONTHS;

        require(principal >= MIN_PRINCIPAL, "PRINCIPAL_TOO_SMALL");
        require(principal <= MAX_PRINCIPAL, "PRINCIPAL_TOO_HIGH");
        require(totalPrincipal + principal <= TVL_CAP, "TVL_CAP_REACHED");

        id = ++vestCount;

        vests[id] = Vest({
            owner: msg.sender,
            beneficiary: beneficiary_,
            startAt: startAt_,
            monthlyAmount: monthlyAmount_,
            principal: principal,
            releasedAmount: 0,
            terminated: false
        });

        // Pull funds first; if it reverts, state changes revert too
        token.safeTransferFrom(msg.sender, address(this), principal);

        // TVL accounting: add locked principal after successful transfer
        totalPrincipal += principal;

        emit VestCreated(id, msg.sender, beneficiary_, startAt_, monthlyAmount_, principal);
    }

    // ---------------- VIEW ----------------

    function dueMonths(uint256 id) public view returns (uint256) {
        Vest memory v = vests[id];
        if (v.owner == address(0)) return 0;          // non-existent
        if (v.terminated) return 0;                   // terminated: no more due
        if (block.timestamp < v.startAt) return 0;

        uint256 elapsed = block.timestamp - v.startAt;
        uint256 months = elapsed / PERIOD;

        if (months > TOTAL_MONTHS) months = TOTAL_MONTHS;
        return months;
    }

    function dueAmount(uint256 id) public view returns (uint256) {
        Vest memory v = vests[id];
        if (v.owner == address(0)) return 0;
        if (v.terminated) return 0;

        uint256 vested = dueMonths(id) * v.monthlyAmount;
        if (vested <= v.releasedAmount) return 0;

        return vested - v.releasedAmount;
    }

    // ---------------- RELEASE ----------------

    function release(uint256 id) external nonReentrant {
        Vest storage v = vests[id];
        require(v.owner != address(0), "NO_VEST");
        require(!v.terminated, "TERMINATED");

        uint256 amount = dueAmount(id);
        require(block.timestamp >= v.startAt, "NOT_STARTED");
        require(amount > 0, "NOTHING_DUE");

        v.releasedAmount += amount;

        // reduce locked TVL by released amount
        require(totalPrincipal >= amount, "TVL_UNDERFLOW");
        totalPrincipal -= amount;

        token.safeTransfer(v.beneficiary, amount);

        emit Released(id, msg.sender, amount);
    }
// ---------------- TERMINATE ----------------
// Rule:
// - only owner can terminate
// - must wait >= MIN_TERMINATE_PERIODS
// - must be before vest fully completes
// - pay due to beneficiary
// - refund remaining to owner

function terminate(uint256 id) external nonReentrant {
    Vest storage v = vests[id];

    require(v.owner != address(0), "NO_VEST");
    require(msg.sender == v.owner, "NOT_OWNER");
    require(!v.terminated, "TERMINATED");

    // must wait at least MIN_TERMINATE_PERIODS
    require(
        block.timestamp >= v.startAt + MIN_TERMINATE_PERIODS * PERIOD,
        "LESS_THAN_MIN_PERIODS"
    );

    // terminate must happen before full completion
    require(
        block.timestamp < v.startAt + TOTAL_MONTHS * PERIOD,
        "TERMINATE_WINDOW_CLOSED"
    );

    // 1) pay any due to beneficiary
    uint256 amountDue = dueAmount(id);

    if (amountDue > 0) {
        v.releasedAmount += amountDue;

        require(totalPrincipal >= amountDue, "TVL_UNDERFLOW");
        totalPrincipal -= amountDue;

        token.safeTransfer(v.beneficiary, amountDue);
    }

    // 2) refund remaining to owner
    uint256 remaining = v.principal - v.releasedAmount;

    v.terminated = true;

    if (remaining > 0) {
        require(totalPrincipal >= remaining, "TVL_UNDERFLOW");
        totalPrincipal -= remaining;

        token.safeTransfer(v.owner, remaining);
    }

    emit Terminated(id, amountDue, remaining);
}
}
