Flowvest V1 Launch Checklist

Contract Deployment
	•	Deploy Flowvest contract to Base Mainnet
	•	Verify contract on Basescan
	•	Confirm constructor parameters
	•	Confirm contract owner (if applicable)
	•	Confirm token address (USDC)

Required parameters:
	•	PERIOD
	•	TOTAL
	•	MIN_PRINCIPAL
	•	TVL_CAP
	•	START_DELAY

⸻

Smart Contract Verification
	•	Contract verified on Basescan
	•	ABI available
	•	Source code public
	•	Compiler version correct
	•	Optimizer settings match deployment

⸻

Frontend Configuration

Update config.js

CHAIN_ID = 8453
FLOW_CONTRACT = 
USDC_CONTRACT = 
EXPLORER = https://basescan.org

Checklist:
	•	App connects to Base Mainnet
	•	Explorer links correct
	•	Testnet badge removed / Mainnet badge added
	•	Wallet connect works
	•	Transaction logs visible

⸻

Core Flow Testing

Run at least one full test flow on mainnet using small amount.

Test sequence:
	1.	Connect wallet
	2.	Approve USDC
	3.	Create Vest
	4.	Wait for release period
	5.	Claim release
	6.	Terminate vest (after allowed period)

Checklist:
	•	Approve works
	•	Create vest works
	•	Claim works
	•	Terminate works
	•	VestCount increases correctly
	•	Release amount updates correctly

⸻

Backend / Indexer

Ensure API and indexer are running.

Services:
	•	sync_vests.py
	•	API server
	•	MySQL database

Checklist:
	•	New vest indexed
	•	Released amount updates
	•	Terminated status updates
	•	/api/vests/latest returns correct data
	•	Database auto refresh working

Recommended:

systemctl enable flowvest-sync
systemctl enable flowvest-api

⸻

Website / Landing Page

Domain:

flowvest.io
app.flowvest.io

Checklist:
	•	Landing page loads
	•	Launch App button works
	•	GitHub link correct
	•	Contact email working
	•	Mobile layout ok

⸻

Security Checks

Basic checks before launch:
	•	No private keys stored
	•	All wallet actions require signature
	•	Address inputs validated
	•	Token amount validated
	•	Prevent double-click transaction spam
	•	No sensitive backend endpoints exposed

⸻

Legal / Disclosure

Add clear notice:

Flowvest is a deterministic payment scheduling tool.
	•	Not an investment product
	•	Not custody
	•	No yield guarantees
	•	Users retain control of their wallet

⸻

GitHub Release

Create release tag:

v1.0.0

Checklist:
	•	README updated
	•	License included
	•	Deployment instructions included
	•	Project description updated

⸻

Launch Announcement

Channels:
	•	GitHub
	•	X / Twitter
	•	Community channels

Suggested announcement:

Flowvest V1 is now live on Base.

A simple on-chain tool for deterministic stablecoin vesting and scheduled transfers.

⸻

Optional (Recommended)

Future improvements:
	•	Auto-release automation
	•	Dashboard analytics
	•	Multiple vest management
	•	Email notifications
	•	API improvements

⸻

Version

Flowvest V1
Release: Initial mainnet deployment
:::
