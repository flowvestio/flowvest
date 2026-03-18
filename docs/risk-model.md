# Flowvest Risk Model

Flowvest applies conservative limits to reduce protocol risk.

---

## 1. Per Vest Limits

- Minimum: 200 USDC
- Maximum: 30,000 USDC

This limits the impact of individual mistakes or contract issues.

---

## 2. TVL Cap

The protocol enforces a global TVL cap.

Example:

200,000 USDC

This limits maximum exposure in case of critical failure.

---

## 3. Progressive Scaling

Limits may increase over time as:

- the protocol stabilizes
- usage increases
- audits are completed

---

## 4. No Custody Risk

- Funds are locked in contract
- No admin withdrawal
- Release logic is deterministic

---

## 5. Multisig Constraints

The protocol multisig:

- can adjust limits
- cannot access user funds