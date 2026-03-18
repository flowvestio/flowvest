# Flowvest Permission Model

## 1.Overview

Flowvest is designed so that user funds are controlled by immutable vesting rules, not by any administrator.

Some protocol parameters may be adjustable during the early stages of the protocol, but these controls must never allow direct access to user funds.

--- 

## 2.Permission Layers

Flowvest contains three distinct permission layers.

```
Users
│
├── Owner
│   ├ create vest
│   ├ terminate vest
│   └ propose beneficiary change
│
├── Beneficiary
│   ├ claim funds
│   └ accept beneficiary change
│
└── Protocol Multisig
    ├ adjust protocol caps
    ├ adjust per-vest limits
    └ manage protocol-level parameters

```
 ## 3.Owner Permissions

The Owner is the creator of an individual vest schedule.

The Owner may:

-	create vest schedules

-	terminate a vest within the allowed window

-	propose a beneficiary change

The Owner may not:

-	withdraw locked beneficiary funds outside protocol rules

-	bypass the vest release schedule

-	directly replace the beneficiary without acceptance

--- 

## 4.Beneficiary Permissions

The Beneficiary is the recipient of released funds.

The Beneficiary may:

-	claim released funds

-	accept a proposed beneficiary change if they are the new address

The Beneficiary may not:

-	modify vest rules

-	terminate the vest

-	change owner-controlled settings

--- 

## 5.Protocol Multisig Permissions

During the early stages of Flowvest, certain protocol-

level parameters may be managed by a protocol multisig.

The protocol multisig may manage:

-	protocol TVL cap

-	per-vest principal limit

-	protocol treasury address

-	other non-custodial protocol parameters

The protocol multisig may not:

-	access user locked principal

-	release funds arbitrarily

-	modify existing vest schedules

-	replace owners or beneficiaries

-	bypass vest logic

--- 

## 6.Why Multisig Instead of a Single Owner

A multisig is used to avoid single-key control.

This improves security by reducing the risk of:

-	key compromise

-	unilateral administrative actions

-	accidental parameter changes

-	loss of trust from users

The recommended setup is:

```
2-of-3 multisig

```
This means:

-	3 authorized signer addresses exist

-	any 2 of them must approve a transaction

--- 	

## 7.User Fund Safety Model

User funds are never held by the protocol multisig.

Funds are only moved according to vest rules:

-	vest creation locks principal

-	release sends unlocked funds to the beneficiary

-	termination refunds only the unreleased remainder to the owner

At no point may the multisig extract user funds from active vests.

--- 

## 8.Recommended Governance Path

Flowvest may follow a progressive decentralization model.

Phase 1 — Early Protocol

-	protocol multisig controls limited parameters

-	user funds remain protected by vest rules

-	parameter changes are visible on-chain

Phase 2 — Mature Protocol

-	multisig permissions become increasingly restricted

-	caps may become increase-only

-	protocol logic stabilizes

Phase 3 — Fully Mature

-	multisig permissions may be removed or minimized

-	governance may move to DAO or immutable settings

--- 

## 9.Trust Assumptions

Flowvest users should trust that:

-	the vest contract enforces release logic

-	the multisig cannot seize user funds

-	all protocol changes are transparent and on-chain

Flowvest is designed so that administrative trust is minimized and limited to protocol-level guardrails.

--- 

## 10.Visual Permission Diagram

```
                     ┌──────────────────────┐
                     │  Protocol Multisig   │
                     │----------------------│
                     │ set TVL cap          │
                     │ set max per vest     │
                     │ set treasury address │
                     └──────────┬───────────┘
                                │
                                │ protocol-level only
                                ▼
                     ┌──────────────────────┐
                     │   Flowvest Contract  │
                     └──────────┬───────────┘
                                │
          ┌─────────────────────┴─────────────────────┐
          │                                           │
          ▼                                           ▼
 ┌──────────────────┐                        ┌──────────────────┐
 │      Owner       │                        │   Beneficiary    │
 │------------------│                        │------------------│
 │ create vest      │                        │ claim funds      │
 │ terminate vest   │                        │ accept change    │
 │ propose change   │                        └──────────────────┘
 └──────────────────┘
 
```
## 11.Core Principle

The protocol multisig may manage parameters, but it must never control user funds.

This separation is fundamental to Flowvest’s trust model.

--- 

## 12.One-Line Summary
Owners control their own vest schedules.

Beneficiaries control their own claims.

The protocol multisig controls only protocol-level limits, never user funds.