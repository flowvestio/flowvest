# Flowvest Architecture

Flowvest consists of three main components:

---

## 1. Smart Contracts

- Vest creation
- Fund locking
- Release logic
- Termination
- Beneficiary change

Contracts are deployed on Base.

---

## 2. Frontend (App)

- Wallet connection
- Vest creation UI
- Claim interface
- Owner vest management

The frontend is a static web application interacting directly with contracts.

---

## 3. Off-chain Services

- Explorer (scan.flowvest.io)
- Indexer (for vest data)
- Optional keeper (auto release)

These services improve usability but are not required for protocol correctness.

---

## Design Principle

The protocol is designed to be:

- non-custodial
- transparent
- minimal

All critical logic exists on-chain.