Flowvest Whitepaper (V1)

Introduction

Flowvest is a deterministic on-chain payment scheduling protocol built on Base.

It allows users to create fixed-term stablecoin vesting schedules with clear rules, predictable release periods, and optional early termination logic.

The protocol focuses on simplicity, transparency, and user-controlled execution through wallet signatures.

Flowvest V1 introduces a minimal architecture designed to validate the core concept of programmable stablecoin distribution.

---

## Problem

Many real-world financial commitments require structured payments over time.

Examples include:

- structured support payments
- staged settlement agreements
- private financial commitments
- long-term payment plans

Traditional solutions rely on trust between parties or centralized escrow systems.

These approaches introduce risks such as:

- delayed payments
- lack of transparency
- custody risks
- enforcement difficulties

Blockchain smart contracts enable deterministic execution of predefined rules, reducing reliance on trust.

---

## Solution

Flowvest introduces a minimal on-chain payment scheduling system.

Users can create vesting schedules that release stablecoins across fixed time periods.

Each vest defines:

- beneficiary address
- start timestamp
- monthly release amount
- total vest duration

The protocol ensures funds can only be released when the schedule permits.

All actions require wallet signatures from the user.

Flowvest does not custody private keys and does not control user funds.

---

## How It Works

The Flowvest V1 flow consists of four steps:

1. Approve

The owner approves the Flowvest contract to spend USDC.

2. Create Vest

The owner creates a vest specifying:

- beneficiary
- start time
- monthly release amount

3. Release

When a release period becomes available, the beneficiary can claim the releasable amount.

4. Terminate (Optional)

After a defined minimum period, the owner may terminate the vest early.

Termination stops future releases.

---

## V1 Design Principles

Flowvest V1 was designed with the following principles:

Minimalism

The system intentionally avoids complex logic to reduce risk.

Deterministic execution

All release schedules are derived from contract rules and timestamps.

User control

Every action requires explicit wallet signatures.

Transparency

All vest states are visible on-chain.

---

## V1 Parameters

Flowvest V1 includes the following configuration parameters:

| Parameter | Description |
|--------|-------------|
| PERIOD | Length of each vesting period |
| TOTAL | Total number of periods |
| MIN_PRINCIPAL | Minimum vest size |
| TVL_CAP | Maximum protocol total value locked |
| START_DELAY | Delay before vest begins |

These parameters are fixed in the V1 contract.

---

## Supported Assets

Flowvest V1 supports a single stablecoin:

USDC

This design simplifies accounting, reduces integration complexity, and improves user understanding.

Future versions may support additional ERC-20 tokens.

---

## System Architecture

Flowvest consists of four main components:

1. Smart Contract

Handles vest creation, release logic, and termination rules.

2. Frontend Application

Provides the user interface for wallet interaction and transaction execution.

3. Indexer Service

Tracks contract state changes and stores indexed data.

4. API Layer

Serves vest information to the frontend.

---

## Security Model

Flowvest is designed to minimize attack surfaces.

Key security principles include:

- no custody of user funds
- wallet signature required for all actions
- deterministic release calculations
- transparent on-chain state

Users remain responsible for managing their private keys.

---

## Limitations of V1

Flowvest V1 intentionally limits functionality to reduce complexity.

Known limitations include:

- single token support
- manual release execution
- limited vest management interface
- minimal analytics tools

These limitations allow the protocol to remain simple and auditable.

---

## Future Development

Future versions of Flowvest may introduce:

- multi-token vesting
- automated release execution
- vest management dashboards
- analytics and reporting tools
- notification systems
- advanced vest configurations

Development priorities will focus on maintaining deterministic behavior and minimizing complexity.

---

## Disclaimer

Flowvest is a deterministic payment scheduling tool.

It is not:

- an investment product
- a yield platform
- a custody service

Users maintain full control of their wallets and interact with the protocol at their own risk.

---

## Version

Flowvest V1  
Initial Release
