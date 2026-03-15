# Flowvest

![Status](https://img.shields.io/badge/status-public%20beta-blue)
![Network](https://img.shields.io/badge/network-Base-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Programmable stablecoin vesting on-chain.**

Flowvest is a lightweight protocol that allows users to schedule stablecoin payments over time using deterministic vesting smart contracts.

---

## Status

Flowvest V1 is currently in **Public Beta** on **Base Sepolia**.

Please use small USDC test amounts and review transactions carefully.

---

## Links

* **App:** [https://app.flowvest.io](https://app.flowvest.io)
* **Explorer:** [https://scan.flowvest.io](https://scan.flowvest.io)
* **Network:** Base Sepolia
* **Asset:** Test USDC

---

## What Flowvest Does

Flowvest enables users to create simple on-chain payment schedules using stablecoins.

Typical use cases include:

* scheduled payments
* milestone-based payouts
* contributor vesting
* personal time‑locked savings

All vest schedules are transparent and verifiable on-chain.

---

## How It Works

1. Connect wallet
2. Approve USDC
3. Create a vest schedule
4. Funds unlock over time
5. Beneficiary claims available amounts
6. Owner may terminate within the allowed window

---

## V1 Parameters

Current Public Beta configuration:

* **Token:** USDC
* **Network:** Base Sepolia
* **Periods:** 3
* **Period Length:** 60 seconds (test month)
* **Min Principal:** 200 USDC
* **Max Principal:** 10,000 USDC
* **Protocol TVL Cap:** 200,000 USDC

---

## Termination Rule

Termination is allowed:

* after period 2 begins
* before period 3 completes

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

* [Protocol Design Principles](docs/protocol-design-principles.md)

---

## Roadmap

Flowvest will evolve gradually as the protocol matures. Early releases prioritize reliability, transparency, and predictable on‑chain behavior.

### V1 — Public Beta (Current Phase)

* Base Sepolia deployment
* USDC vesting schedules
* Claim and terminate flows
* Explorer + API support

### V1 — Mainnet

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

