# Flowvest

Flowvest is a simple USDC vesting protocol deployed on Base.

It allows a creator (owner) to lock USDC into a time-based vesting schedule for a beneficiary.  
Funds are released periodically and can optionally be terminated by the creator after a minimum period.

The design focuses on simplicity, transparency, and minimal trust assumptions.

---

## Features

- USDC based vesting
- Fixed 3-period release schedule
- Monthly unlock model
- Beneficiary claimable funds
- Creator revocable vesting
- Minimal smart contract design
- Base network deployment

---

## How It Works

### Vest Creation (Owner)

1. Connect wallet  
2. Approve USDC  
3. Create vest  

The contract locks the principal amount and starts the vesting schedule.

Example:

monthly = 100 USDC  
total periods = 3  
total principal = 300 USDC  

---

### Claiming (Beneficiary)

The beneficiary can claim released funds each period.

period 1 → claim available  
period 2 → claim available  
period 3 → final claim  

---

### Termination (Owner)

The owner may terminate the vest **after the minimum vesting period**.

Terminate allowed after period 2

Unreleased funds return to the owner.

---

## Contract Rules

| Parameter | Value |
|-----------|------|
| Periods | 3 |
| Period Length | 30 days |
| Token | USDC |
| Network | Base |
| Terminate Allowed | After period 2 |

---

## Architecture

User (Wallet)

↓  

app.flowvest.io  
Frontend DApp  

↓  

api.flowvest.io  
Vest API / Indexer  

↓  

Base Network  
Flowvest Contract  

The frontend interacts directly with the smart contract while the backend API provides indexed vest data for faster UI rendering.

---

## Smart Contract

Network:

Base

Token:

USDC

Main functions:

createVest()  
release()  
terminate()  

---

## Security Design

Flowvest V1 intentionally keeps the contract minimal.

Security properties:

- No upgradeable proxy
- No admin withdraw
- No hidden owner privileges
- Funds locked in contract
- Public on-chain state

All vesting logic is transparent and verifiable on-chain.

---

## API

Example endpoint:

GET /api/vests/latest

Returns latest vest records for UI display.

Example response:

[
  {
    "vest_id": 8,
    "owner": "0xbf70...",
    "beneficiary": "0x5547...",
    "monthly": "73",
    "start_at": 1772462290
  }
]

---

## Development

Repository structure:

contracts/  
frontend/  
backend/  
scanner/  

---

## License

MIT License

---

## Roadmap

### V1

- Basic vesting contract
- USDC support
- Base network deployment

### V2 (Future)

Potential improvements:

- dynamic vest schedules
- multiple token support
- protocol fee model
- analytics dashboard

---

## Disclaimer

This software is experimental.

Use at your own risk.

Always verify contract interactions before sending funds.
