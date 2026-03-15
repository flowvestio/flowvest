Flowvest Protocol Design Principles

1.Simplicity First

Flowvest prioritizes simple and predictable behavior over complex features.

The protocol avoids unnecessary complexity such as:

•	multi-asset vaults

•	complex reward logic

•	upgradeable governance layers

Each vault is designed to be easy to reason about and easy to audit.

---


2.One Vault = One Token

Each Flowvest contract manages a single token only.

Example future structure:

```
代码
FlowvestUSDC_Base
FlowvestUSDT_Base
FlowvestUSDC_Arbitrum
```
Reasons:

•	avoids token-specific edge cases

•	simplifies accounting

•	improves security and auditability

•	isolates risk per asset

---


3.Deterministic Vesting

Flowvest vesting schedules are fully deterministic.

Key properties:

```
代码
principal = monthlyAmount × duration
```
This design avoids rounding issues and ensures:

•	predictable payouts

•	no leftover dust tokens

•	clean accounting

---

	
4.State Derived From Data

Vest status is derived dynamically, not stored.

Example logic:

```
代码
terminated → Terminated
released ≥ principal → Completed
now < startAt → Pending
otherwise → Active
```

This avoids:
	•	stale state flags
	•	inconsistent contract state
	•	manual status updates

---

	
5.Permissionless Release

Anyone can call:

```
代码
release(vestId)
```

This ensures:

•	beneficiaries do not depend on specific UI

•	automation bots can release funds

•	funds cannot become stuck due to inactivity

---


6 Explicit Termination Window

Terminate is only allowed:

```
代码
after period 3
before vest completion
```


And only when:

```
代码
duration ≥ 4
```
  
  This ensures:
  
•	short vests remain simple

•	longer vests maintain owner recovery options

---

	
7.Beneficiary Recovery Mechanism

To prevent permanent loss of funds due to incorrect beneficiary addresses, Flowvest introduces a two-step beneficiary change mechanism:

```
代码
owner propose
↓
48h cooldown
↓
new beneficiary accept
```

Additional safeguards:

•	one pending change at a time

•	maximum one proposal every 7 days
	 
•	proposals allowed only when dueAmount = 0
	
This preserves both security and recoverability.

---


8.Accurate TVL Accounting

Flowvest tracks current locked capital, not historical deposits.

```
代码
totalPrincipal = current locked funds
```

TVL updates on:

•	createVest

•	release

•	terminate

This ensures protocol metrics remain accurate.

---

9.Reentrancy Protection

All state-changing functions are protected using:

```
代码
ReentrancyGuard
```

Additionally:

•	state updates occur before token transfers

•	external calls are minimized

---


10.Frontend Independence

The protocol does not rely on the frontend for critical functionality.

Core operations such as:

```
代码
release
terminate
```


remain callable directly on-chain.

This ensures the protocol remains usable even if:

•	the frontend is unavailable
	
•	external indexers fail

---

	
11.Address Discoverability
	

Flowvest ensures users can always locate their vest positions.

The explorer supports:

```
代码
Owner Created Vests
Beneficiary Vests
```

Users only need their wallet address to locate all associated vests.

---



12.Minimal Governance Surface

Flowvest avoids complex governance controls.

Key parameters are intentionally fixed where possible to reduce:

•	governance risk

•	upgrade risk

•	administrative abuse
	
Flowvest Design Philosophy 
	
```
代码
Flowvest is designed to be:
Simple
Deterministic
Permissionless
Recoverable
Auditable
```



