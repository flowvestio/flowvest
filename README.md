# Flowvest

![Status](https://img.shields.io/badge/status-public%20beta-blue)
![Network](https://img.shields.io/badge/network-Base-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Programmable stablecoin vesting on-chain.**

Save for yourself. Vest for others.

Flowvest is a non-custodial protocol built on Base that helps users lock USDC over time using deterministic smart contracts.

Whether you’re saving for your future self or scheduling payments to someone else, Flowvest keeps funds locked by code — not by promises.

---

## Core Products

Save

Lock USDC for yourself and release it gradually over time.

Ideal for:

* long-term saving
* budgeting
* self-discipline
* delayed spending

Vest

Create a vesting schedule for another wallet.

Ideal for:

* family support
* allowances
* contributor payments
* milestone-based payouts
* payroll distribution

---

## Links

* **App:** [https://app.flowvest.io](https://app.flowvest.io)
* **Explorer:** [https://scan.flowvest.io](https://scan.flowvest.io)
* **Network:** Base Mainnet
* **Asset:** USDC
---

## Why Flowvest
* Non-custodial
* No yield
* No lending
* No rehypothecation
* Transparent on-chain records
* Deterministic release schedules

Funds remain governed entirely by smart contract rules.

---
## How It Works

1. Connect wallet
Any Base-compatible wallet. No signup, no email.
2. Set the schedule
Choose amount, duration, and recipient (or yourself).
3. Wait for unlock
Funds unlock on time. Nothing else needed.

---

## V1.1

Current configuration:

* **Token:** USDC
* **Network:** Base Mainnet
## Available Plans

### Monthly Plan
- Every 30 days
- 3 releases
- ~3 months

### Biweekly Plan
- Every 14 days
- 6 releases
- ~3 months
* **Period Length:** 30 days
* **Min Principal:** 200 USDC
* **Max Principal:** 3,000 USDC
* **Protocol TVL Cap:** 20,000 USDC

---



## Architecture

High‑level protocol flow:

```
User → dApp → Wallet → Smart Contract → Events → Indexer → Explorer
```

This repository includes:

* smart contracts
* Flowvest dApp frontend

Explorer and indexing infrastructure are maintained separately.

---

## Documentation

* [Protocol Design Principles](docs/07-design-principles.md)

---

## Roadmap

Flowvest will evolve gradually as the protocol matures. Early releases prioritize reliability, transparency, and predictable on‑chain behavior.


### V1.1 — Mainnet (Current Release)

* Base mainnet deployment
* USDC support
* stabilized UI and infrastructure

### V2 — Protocol Expansion

Planned direction:

* flexible vest durations
* improved vest management
* protocol fee model
* additional stablecoins

### Future Direction

Long‑term exploration areas include:

* multi‑chain deployments
* additional stablecoin integrations
* savings-style vaults

---

## Security Notes

Flowvest is non‑custodial. Users should always:

* verify beneficiary addresses carefully
* review wallet prompts before confirming
* confirm transactions on-chain

---

## Changelog

For release history, see **CHANGELOG.md**.

---

## License

MIT

