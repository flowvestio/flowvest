
# Flowvest V2 State Machine
---
## 1. Vest Lifecycle Overview

Each vest moves through a limited set of protocol states.

```
Created
  ↓
Active
  ↓
Completed

```
or

```
Created
  ↓
Active
  ↓
Terminated
```
Beneficiary change is not a separate vest state.
It is treated as a pending sub-state attached to an active vest.

---

## 2. Core Vest States

### 2.1 Created

A vest is created when the Owner calls:

```
createVest()
```
At creation:

-	principal is locked

-	start time is recorded

-	beneficiary is assigned

-	vest is initialized

A vest enters Created immediately after successful creation.

If startAt <= block.timestamp, the vest may immediately be considered Active.


### 2.2 Active

A vest is Active when:

-	it has not been terminated

-	it has not fully completed

-	funds may unlock over time

During Active, the following actions are possible:

-	release()

-	terminate() if within termination window

-	proposeBeneficiaryChange() if allowed



### 2.3 Completed

A vest becomes Completed when:

-	all vest periods have elapsed

-	all principal has been released

At this point:

-	no further termination is allowed

-	no further beneficiary change is allowed

-	claimable amount may still exist until released

If funds remain unreleased, the vest is economically complete but still has outstanding claimable funds.



### 2.4 Terminated

A vest becomes Terminated when the Owner successfully calls:

```
terminate()

```
At termination:

-	claimable funds go to the beneficiary

-	unreleased remainder is refunded to the owner

-	vest stops permanently

No further vest actions are allowed except historical viewing.

---

## 3. Beneficiary Change Sub-State

Beneficiary change is modeled as a temporary pending process during the Active state.

It does not replace the main vest lifecycle.

```
Active
 └── PendingBeneficiaryChange
        ├── Accepted → back to Active
        └── Cancelled → back to Active

```
### 3.1 No Pending Change

Default active state:

```
Active     
```  
No beneficiary proposal exists.
### 3.2 Pending Beneficiary Change

Entered when Owner calls:

```
proposeBeneficiaryChange(newAddress)

```
Requirements:

-	vest is active
	
-	dueAmount == 0

-	no existing pending proposal

-	7 day interval passed

At this point:

-	pendingBeneficiary is set

-	changeProposedAt is recorded

-	48h cooldown begins



### 3.3 Accepted

The pending change is accepted when the new address calls:

```
acceptBeneficiaryChange()

```
Requirements:

-	caller is pendingBeneficiary

-	cooldown has elapsed

Result:

-	beneficiary = pendingBeneficiary

-	pending fields cleared

-	beneficiaryChangeCount += 1

Vest returns to normal Active state.

### 3.4 Cancelled

The pending change is cancelled when Owner calls:

```
cancelBeneficiaryChange()

```
Result:

-	pending fields cleared

-	beneficiary remains unchanged

-	fee is not refunded

Vest returns to normal Active state.


--- 
## 4. Release State Logic

Release does not create a separate state.
It is a repeated action during Active.

```
Active
 ├── release()
 ├── release()
 ├── release()
 └── Completed
 
```
 Important property:
 
```
 unclaimed funds do not expire
 
```
 If release is not triggered in one period, claimable funds accumulate.
 
--- 

## 5. Termination Window Logic

Termination is only valid in a specific portion of Active.

```
Active
 ├── Not terminable yet
 ├── Terminable window
 └── No longer terminable
 
```
 Rule:
 
 termination allowed only after at least 3 periods have elapsed
and strictly before full completion

So the active state can be viewed as:

```
Active
 ├── Early Active
 ├── Terminable Active
 └── Late Active
 
```

 --- 
 
## 6. State Transition Diagram

```
          createVest()
              │
              ▼
           Created
              │
              ▼
            Active
          /    |    \
         /     |     \
  release()  terminate()  proposeBeneficiaryChange()
       |         |                 |
       |         ▼                 ▼
       |     Terminated   PendingBeneficiaryChange
       |                           /      \
       |                          /        \
       |             acceptBeneficiary()   cancelBeneficiaryChange()
       |                        |                    |
       |                        ▼                    ▼
       └────────────────────> Active <──────────────┘
                                |
                                |
                           vest fully elapsed
                                |
                                ▼
                            Completed
                            
```
--- 
## 7. Protocol State Invariants

These invariants should always hold.

### 7.1 Locked Principal Integrity


At all times:
                            
```
releasedAmount + refundableAmount + lockedRemaining = principal
                            
```

No funds may disappear or be double-counted.

### 7.2 Single Pending Beneficiary Change

At most one beneficiary proposal may exist per vest.
                            
```
pendingBeneficiary == address(0)
or
one active pending proposal
                            
```
### 7.3 Beneficiary Change Only While Clean

A beneficiary change can only be proposed when:
                            
```
dueAmount == 0
                            
```
This prevents disputes over partially claimable funds.



### 7.4 Terminated Vests Are Final

Once terminated:

-	no reactivation

-	no beneficiary changes

-	no additional termination


### 7.5 Completed Vests Are Final

Once completed:

-	no termination

-	no beneficiary change

-	no schedule modification

--- 
	
## 8. UI Mapping of States

This is how the UI should interpret vest states.

Created / Active

Show:

-	claimable amount

-	next release time

-	owner controls if applicable

Pending Beneficiary Change

Show:

-	pending badge

-	new proposed beneficiary

-	cooldown countdown

-	accept or cancel action

Completed

Show:

-	completed badge

-	historical details

-	no action buttons

Terminated

Show:

-	terminated badge

-	refund / release outcome

-	no action buttons

--- 

## 9. Explorer Mapping

Explorer should expose:

-	vest status

-	release status

-	termination status

-	beneficiary change status

-	beneficiary change history

Recommended labels:
                            
```
Active
Pending Beneficiary Change
Completed
Terminated
                            
```
--- 

## 10.Recommended Contract Enums

If you want to simplify frontend/explorer logic, you can expose a derived status enum:
                            
```
enum VestStatus {
    Active,
    PendingBeneficiaryChange,
    Completed,
    Terminated
}                            
```
Even if the contract stores raw fields only, the frontend or API can compute this status.














   