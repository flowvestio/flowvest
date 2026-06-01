// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FlowvestSavingV1_1 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public owner;

    uint256 public constant USDC_DECIMALS = 1e6;

    // ---------------- PARAMETERS ----------------

    uint256 public constant MIN_GOAL = 200 * USDC_DECIMALS;
    uint256 public constant MIN_DURATION = 90 days;

    // 120% cap expressed as bps (12000 = 120%)
    uint256 public constant MAX_FUNDING_BPS = 12_000;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // maxPrincipal caps the goal amount per plan
    uint256 public maxPrincipal;
    uint256 public tvlCap;
    uint256 public maxDuration;

    uint256 public constant ABSOLUTE_MAX_PRINCIPAL = 200_000 * USDC_DECIMALS;
    uint256 public constant ABSOLUTE_TVL_CAP = 6_000_000 * USDC_DECIMALS;
    uint256 public constant ABSOLUTE_MAX_DURATION = 1825 days;

    // Tracks current funds held (accounting-based TVL)
    uint256 public totalPrincipal;
    uint256 public planCount;

    struct Plan {
        address owner;
        uint256 goal;
        uint256 saved;
        uint256 startAt;
        uint256 unlockAt;
        bool claimed;
    }

    mapping(uint256 => Plan) public plans;

    // ---------------- EVENTS ----------------

    event PlanCreated(uint256 indexed id, address indexed user, uint256 goal, uint256 startAt, uint256 unlockAt, uint256 duration);
    event Deposited(uint256 indexed id, address indexed from, uint256 requestedAmount, uint256 receivedAmount);
    event Claimed(uint256 indexed id, uint256 amount);

    event OwnershipTransferred(address indexed prev, address indexed next);
    event TvlCapIncreased(uint256 oldValue, uint256 newValue);
    event MaxPrincipalIncreased(uint256 oldValue, uint256 newValue);
    event MaxDurationIncreased(uint256 oldValue, uint256 newValue);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(
        address token_,
        address owner_,
        uint256 initialMaxPrincipal_,
        uint256 initialTvlCap_,
        uint256 initialMaxDuration_
    ) {
        require(token_ != address(0), "ZERO_TOKEN");
        require(owner_ != address(0), "ZERO_OWNER");

        // Enforce USDC-like decimals (6)
        require(IERC20Metadata(token_).decimals() == 6, "NOT_USDC_DECIMALS");

        require(initialMaxPrincipal_ >= MIN_GOAL, "MAX_TOO_LOW");
        require(initialMaxPrincipal_ <= ABSOLUTE_MAX_PRINCIPAL, "MAX_TOO_HIGH");

        require(initialTvlCap_ >= initialMaxPrincipal_, "TVL_TOO_LOW");
        require(initialTvlCap_ <= ABSOLUTE_TVL_CAP, "TVL_TOO_HIGH");

        require(initialMaxDuration_ >= MIN_DURATION, "DURATION_TOO_SHORT");
        require(initialMaxDuration_ <= ABSOLUTE_MAX_DURATION, "DURATION_TOO_LONG");

        token = IERC20(token_);
        owner = owner_;

        maxPrincipal = initialMaxPrincipal_;
        tvlCap = initialTvlCap_;
        maxDuration = initialMaxDuration_;

        emit OwnershipTransferred(address(0), owner_);
    }

    // ---------------- ADMIN ----------------

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function increaseTvlCap(uint256 newCap) external onlyOwner {
        require(newCap > tvlCap, "NOT_INCREASE");
        require(newCap <= ABSOLUTE_TVL_CAP, "TOO_HIGH");
        emit TvlCapIncreased(tvlCap, newCap);
        tvlCap = newCap;
    }

    function increaseMaxPrincipal(uint256 newMax) external onlyOwner {
        require(newMax > maxPrincipal, "NOT_INCREASE");
        require(newMax <= ABSOLUTE_MAX_PRINCIPAL, "TOO_HIGH");
        emit MaxPrincipalIncreased(maxPrincipal, newMax);
        maxPrincipal = newMax;
    }

    function increaseMaxDuration(uint256 newMax) external onlyOwner {
        require(newMax > maxDuration, "NOT_INCREASE");
        require(newMax <= ABSOLUTE_MAX_DURATION, "TOO_LONG");
        emit MaxDurationIncreased(maxDuration, newMax);
        maxDuration = newMax;
    }

    // ---------------- CREATE ----------------

    function createPlan(uint256 goal, uint256 duration) external returns (uint256 id) {
        require(goal >= MIN_GOAL, "GOAL_TOO_LOW");
        require(goal <= maxPrincipal, "GOAL_TOO_HIGH");

        require(duration >= MIN_DURATION, "DURATION_TOO_SHORT");
        require(duration <= maxDuration, "DURATION_TOO_LONG");

        uint256 startAt = block.timestamp;
        uint256 unlockAt = startAt + duration;

        id = ++planCount;

        plans[id] = Plan({
            owner: msg.sender,
            goal: goal,
            saved: 0,
            startAt: startAt,
            unlockAt: unlockAt,
            claimed: false
        });

        emit PlanCreated(id, msg.sender, goal, startAt, unlockAt, duration);
    }

    // ---------------- DEPOSIT ----------------

    function deposit(uint256 id, uint256 amount, bool confirmDonate) external nonReentrant {
    Plan storage p = plans[id];

    require(p.owner != address(0), "NO_PLAN");
    require(msg.sender == p.owner || confirmDonate, "NOT_OWNER_CONFIRM_REQUIRED");
    require(!p.claimed, "CLAIMED");
    require(block.timestamp < p.unlockAt, "ALREADY_UNLOCKED");
    require(amount > 0, "ZERO_AMOUNT");

    uint256 maxAllowed = (p.goal * MAX_FUNDING_BPS) / BPS_DENOMINATOR;

    require(p.saved + amount <= maxAllowed, "EXCEEDS_GOAL_LIMIT");
    require(totalPrincipal + amount <= tvlCap, "TVL_FULL");

    uint256 balBefore = IERC20(address(token)).balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 received = IERC20(address(token)).balanceOf(address(this)) - balBefore;

    require(received > 0, "NO_RECEIVE");

    p.saved += received;
    totalPrincipal += received;

    emit Deposited(id, msg.sender, amount, received);
    }

    // ---------------- CLAIM ----------------

    function claim(uint256 id) external nonReentrant {
        Plan storage p = plans[id];

        require(p.owner == msg.sender, "NOT_OWNER");
        require(!p.claimed, "ALREADY_CLAIMED");
        require(block.timestamp >= p.unlockAt, "NOT_UNLOCKED");

        uint256 amount = p.saved;
        require(amount > 0, "NOTHING");

        p.claimed = true;
        totalPrincipal -= amount;

        token.safeTransfer(msg.sender, amount);

        emit Claimed(id, amount);
    }

    // ---------------- VIEW ----------------

    function canClaim(uint256 id) external view returns (bool) {
        Plan memory p = plans[id];
        return (
            p.owner != address(0) &&
            !p.claimed &&
            block.timestamp >= p.unlockAt &&
            p.saved > 0
        );
    }

    function maxDeposit(uint256 id) external view returns (uint256) {
        Plan memory p = plans[id];
        if (p.owner == address(0) || p.claimed || block.timestamp >= p.unlockAt) return 0;

        uint256 maxAllowed = (p.goal * MAX_FUNDING_BPS) / BPS_DENOMINATOR;
        if (p.saved >= maxAllowed) return 0;

        uint256 planRoom = maxAllowed - p.saved;
        uint256 tvlRoom = tvlCap > totalPrincipal ? tvlCap - totalPrincipal : 0;
        return planRoom < tvlRoom ? planRoom : tvlRoom;
    }

    function remaining(uint256 id) external view returns (uint256) {
        Plan memory p = plans[id];
        if (p.saved >= p.goal) return 0;
        return p.goal - p.saved;
    }
}
