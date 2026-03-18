# Flowvest V2 Protocol Rules
---
## 1. Overview

Flowvest is an on-chain protocol for scheduling stablecoin payments over time.

A user (Owner) locks stablecoins in a vesting schedule.
Funds are released periodically to the Beneficiary.

Flowvest is designed to support simple, transparent, and programmable payment agreements.

Typical use cases include:

-	family support payments

-	freelancer retainers

-	milestone payments

-	personal financial agreements

---

## 2. Roles

Each vest schedule involves two roles.

Owner

The Owner creates the vest and locks the funds.

The Owner can:

-	create vest schedules

-	terminate a vest

-	propose a beneficiary change

---

Beneficiary

The Beneficiary receives the released funds.

The Beneficiary can:

-	claim released funds

-	accept beneficiary change proposals

---

## 3. Vest Parameters

Each vest schedule contains the following parameters.

```
Owner
Beneficiary
Start time
Monthly amount
Total periods
Total principal
Released amount
```
### 3.1 Supported Token

V2 supports:

```
USDC
```
Each vault supports a single token.

Future versions may deploy additional vaults for:

-	USDT

-	DAI

### 3.2 Principal Limits

```
Minimum principal: 200 USDC
Maximum principal: 30000 USDC（per vest）
```
Users may create multiple vest schedules if larger amounts are required.

### 3.3 Vest Duration

```
Minimum duration: 4 months
Maximum duration: 60 months
```
Each period represents one vest release interval.

### 3.4 Monthly Amount

The monthly amount is calculated as:

```
monthlyAmount = principal / months
```
Example:

```
monthlyAmount = 100 USDC
months = 6

principal = 600 USDC
```
## 4 . Vest Creation


To create a vest schedule the Owner must:

1.	approve USDC
2.	call createVest

The contract locks the total principal immediately.

### 4.1 Start Time

The Owner chooses the vest start time.

```
startAt >= current time
```
### 4.2 Locked Funds

All funds are locked in the contract.

Funds remain locked until:

-	released to the Beneficiary

-	refunded during termination

## 5. Create Vest Fee

### 5.1. Fee Rate

When creating a vest schedule, the Owner pays a protocol fee.

```
Protocol fee = 0.5% of principal

```
Example:

```
principal = 1000 USDC
fee = 5 USDC

```
### 5.2. Fee Charged At Creation

The fee is charged when calling:

```
createVest()

```
Implementation logic:

```
principal = monthlyAmount × months
fee = principal × 0.5%

```
The Owner transfers:

```
principal + fee

```
The contract locks:

```
principal

```
The protocol receives:

```
fee

```
### 5.3. Fee Example

Example vest:

```
monthlyAmount = 100 USDC
months = 12

principal = 1200 USDC
fee = 6 USDC

```
User approves:

```
1206 USDC

```
Contract stores:

```
principal = 1200 USDC
protocolFee = 6 USDC

```
### 5.4. Fee Purpose

The protocol charges a fixed percentage fee upon vest creation. 

This includes:

-	explorer services

-	indexer infrastructure

-	keeper automation

-	protocol maintenance

The fee also discourages spam vest creation.

### 5.5. Fee Characteristics

The creation fee is:

```
non-refundable

```
The fee is charged regardless of future vest termination.

This ensures predictable protocol revenue and avoids accounting complexity.

### 5.6. Fee Receiver

The fee is transferred to the protocol treasury.

Example:

```
protocolTreasury
```

This address may later be controlled by:

-	protocol governance

-	DAO treasury

-	multisig

### 5.7. Fee Transparency

The UI must clearly display the fee before vest creation.

```
Example UI:
Principal Locked
1200 USDC

Protocol Fee
6 USDC

Total Required
1206 USDC
```
This ensures users understand the cost before signing the transaction.

---


### 6. Fund Release

Funds are released gradually according to the vest schedule.

Release is calculated as:

```
released = periods_elapsed × monthlyAmount

```
### 6.1 Claiming Funds

Released funds must be claimed.

Anyone can trigger the release transaction.

If no claim is executed, funds remain claimable and do not expire.

```
release(vestId)
```
This design allows:
		
-	Beneficiary claim

-	Owner claim

-	automated keeper claim
	
### 6.2 Automatic Release

Flowvest may run a keeper service that automatically triggers releases.

However the protocol does not depend on any centralized service.

---

### 7. Vest Termination

The Owner can terminate a vest schedule early.

###7.1 Termination Window

Termination is allowed only within the following window.

```
Termination is allowed only after at least 3 periods have elapsed,
and strictly before the vest reaches its final period.

```
Example:

```
12 month vest

Termination allowed:
from month 3 up to (but not including) completion

```
### 7.2 Termination Behavior

When a vest is terminated:

1.	any claimable funds are released to the Beneficiary

2.	remaining locked funds are refunded to the Owner

---

### 8. Beneficiary Change

Flowvest allows the Owner to propose a new beneficiary.

This feature is designed for exceptional cases only.

Examples:

-	wrong address entered

-	wallet lost

-	recipient address migration

---

### 8.1 Proposal Requirements

The Owner may propose a beneficiary change only if:

```
dueAmount == 0
This prevents disputes over partially claimable funds during beneficiary transitions.
no pending proposal exists
7 day interval since last change

```
### 8.2 Security Delay

After a proposal is created:

```
48 hour cooldown

```
This delay allows the current beneficiary time to react.

### 8.3 Acceptance Requirement

The new beneficiary must confirm the change.

```
acceptBeneficiaryChange()

```

The beneficiary is updated only after acceptance.

---
## 9. Beneficiary Change Fee

To prevent frequent beneficiary modifications, Flowvest introduces a small administrative fee.

### 9.1 First Change

```
First completed beneficiary change: FREE

```
This allows users to correct mistakes.

### 9.2 Subsequent Changes

```
Second and later beneficiary changes: 2 USDC fee

```
The fee is charged when the proposal is created.

### 9.3 Fee Policy

The fee is:

```
non-refundable

```
This applies even if the proposal is later cancelled.

### 9.4 Fee Purpose

The fee exists to discourage frequent beneficiary modifications and maintain the integrity of vest schedules.

Beneficiary changes should remain exceptional administrative actions.

---

## 10. Cancelling a Beneficiary Proposal

The Owner may cancel a pending beneficiary change proposal.

```
cancelBeneficiaryChange()

```
If the proposal is cancelled:

-	the pending change is removed

-	any fee already paid is not refunded

---

## 11. Transparency

All vest schedules are fully transparent on-chain.

Users can inspect:

-	vest parameters

-	claim history

-	termination history

-	beneficiary changes

The Flowvest Explorer provides an interface to view these records.

---

## 12. Security Philosophy

Flowvest prioritizes:

```
simplicity
transparency
predictability

```

The protocol intentionally avoids complex mechanisms such as:

-	token streaming

-	rebase accounting

-	off-chain payment systems

The goal is to provide a minimal and reliable primitive for programmable payments.

---
## 13. Future Extensions

Future versions of Flowvest may introduce:

-	multi-token vaults

-	additional networks

-	keeper incentive mechanisms

-	vest NFTs

-	DAO vesting modules

These features will be introduced gradually while preserving the protocol’s core simplicity.


## 14. Fee Summary

```
Create Vest              → 0.5% of principal
Beneficiary Change       → First change free, then 2 USDC
Claim / Release          → Free
Terminate                → Free

```








