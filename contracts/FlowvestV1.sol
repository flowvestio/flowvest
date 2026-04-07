// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FlowvestV1 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    uint256 public constant USDC_DECIMALS = 1e6;

    // Mainnet: fixed 30-day interval per period
    uint256 public constant PERIOD = 30 days;
    uint256 public constant TOTAL_MONTHS = 3;

    // Early Access limits
    uint256 public constant MIN_PRINCIPAL = 200 * USDC_DECIMALS;
    uint256 public constant MAX_PRINCIPAL = 3_000 * USDC_DECIMALS;
    uint256 public constant TVL_CAP = 20_000 * USDC_DECIMALS;

    // Termination allowed after >= 2 periods, but before full completion
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
        require(beneficiary_ != address(token), "BENEFICIARY_IS_TOKEN");
        require(beneficiary_ != address(this), "BENEFICIARY_IS_CONTRACT");
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

        token.safeTransferFrom(msg.sender, address(this), principal);
        totalPrincipal += principal;

        emit VestCreated(id, msg.sender, beneficiary_, startAt_, monthlyAmount_, principal);
    }

    // ---------------- VIEW ----------------

    function dueMonths(uint256 id) public view returns (uint256) {
        Vest memory v = vests[id];
        if (v.owner == address(0)) return 0;
        if (v.terminated) return 0;
        if (block.timestamp < v.startAt) return 0;

        uint256 elapsed = block.timestamp - v.startAt;
        uint256 monthsElapsed = elapsed / PERIOD;

        if (monthsElapsed > TOTAL_MONTHS) {
            monthsElapsed = TOTAL_MONTHS;
        }

        return monthsElapsed;
    }

    function dueAmount(uint256 id) public view returns (uint256) {
        Vest memory v = vests[id];
        if (v.owner == address(0)) return 0;
        if (v.terminated) return 0;

        uint256 vested = dueMonths(id) * v.monthlyAmount;
        if (vested <= v.releasedAmount) return 0;

        return vested - v.releasedAmount;
    }

    function isCompleted(uint256 id) public view returns (bool) {
        Vest memory v = vests[id];
        if (v.owner == address(0)) return false;
        if (v.terminated) return false;

        return block.timestamp >= v.startAt + TOTAL_MONTHS * PERIOD;
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

    // ---------------- TERMINATE ----------------
    // Rule:
    // - only owner can terminate
    // - must wait >= MIN_TERMINATE_PERIODS * PERIOD
    // - must be before vest fully completes
    // - pay due to beneficiary
    // - refund remaining to owner

    function terminate(uint256 id) external nonReentrant {
        Vest storage v = vests[id];

        require(v.owner != address(0), "NO_VEST");
        require(msg.sender == v.owner, "NOT_OWNER");
        require(!v.terminated, "TERMINATED");

        require(
            block.timestamp >= v.startAt + MIN_TERMINATE_PERIODS * PERIOD,
            "LESS_THAN_MIN_PERIODS"
        );

        require(
            block.timestamp < v.startAt + TOTAL_MONTHS * PERIOD,
            "TERMINATE_WINDOW_CLOSED"
        );

        uint256 amountDue = dueAmount(id);

        if (amountDue > 0) {
            v.releasedAmount += amountDue;

            require(totalPrincipal >= amountDue, "TVL_UNDERFLOW");
            totalPrincipal -= amountDue;

            token.safeTransfer(v.beneficiary, amountDue);
        }

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
