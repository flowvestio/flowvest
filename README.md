# Flowvest V1 (Base Sepolia) — Prototype

Flowvest is a simple family vesting / revocable trust-like tool built on Web3.
This repo contains a static frontend (no build step) and optional backend helpers.

## Frontend
Location: `frontend/`

### Run locally
Just open:
- `frontend/index.html`

Or serve via nginx / any static server.

### Config
Edit:
- `frontend/assets/app/config.js`

Typical fields:
- CHAIN_ID / RPC / EXPLORER
- FLOW (contract address)
- USDC (token address)
- CREATOR_ADDR (owner/creator address, used only to show creator actions UI)

## Backend (optional)
Location: `backend/`

Used for:
- syncing vests into MySQL
- serving API endpoints to frontend

⚠️ Never commit real `.env` or credentials.

## Security notes
- Contract addresses are public (safe to commit).
- Do NOT commit private keys, server SSH keys, DB passwords.
