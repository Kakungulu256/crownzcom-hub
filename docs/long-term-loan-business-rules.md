# Long-Term Loan + Guarantor Business Rules (Frozen)

Date frozen: 2026-03-03
Addendum date: 2026-03-04
Applies to: long-term loan workflow, guarantor approvals, admin final approval

## 1. Scope

This document freezes the business rules for:
- Long-term loan applications.
- Guarantor-assisted borrowing when requested amount exceeds borrower available credit.
- Guarantor approval/decline workflow.
- Admin final approval gate.

## 2. Definitions

- `availableCredit`: `max(0, (savings * 0.8) - outstandingPrincipal)`.
- `requestedAmount`: loan principal requested by borrower.
- `borrowerCoverage`: amount covered by borrower own available credit.
- `guarantorGap`: `max(0, requestedAmount - borrowerCoverage)`.
- `guarantorCapacity`: guarantor current available credit minus active approved guarantee reservations.
- `securedOutstanding`: guarantor exposure remaining to be recovered from borrower principal repayments.

## 3. Loan Types and Configuration

- Loan types:
  - `short_term`
  - `long_term`
- Short-term behavior remains existing default (2% monthly flat, max 6 months) unless configured otherwise in existing config.
- Long-term uses dedicated financial config values:
  - `longTermInterestRate` (monthly flat %)
  - `longTermMaxRepaymentMonths`
- Borrower must choose repayment months at application time.
- Selected months must be between 1 and configured max for chosen loan type.

## 4. Terms and Conditions Acceptance

- Loan application cannot be submitted unless `termsAccepted = true`.
- Acceptance is required for both short-term and long-term applications.

## 5. Guarantor Requirement Rules

- If `requestedAmount <= borrowerCoverage`, guarantors are optional and not required.
- If `requestedAmount > borrowerCoverage`, guarantors are mandatory.
- Sum of proposed guarantor amounts must be `>= guarantorGap` at submission.
- A guarantor cannot guarantee their own loan.
- Duplicate guarantor entries for the same loan are not allowed.
- Each proposed guarantor amount must be `> 0`.

## 6. Guarantor Approval Threshold

- Loan moves to admin queue only when approved guarantor total is `>= guarantorGap`.
- Threshold is amount-based, not "all guarantors must approve."
- Extra pending guarantor requests may remain pending but do not block admin queue once threshold is met.

## 7. Decline Behavior

- A single decline does not automatically fail the loan if remaining/potential approvals can still cover gap.
- Loan fails guarantor stage only when coverage becomes impossible:
  - `approvedTotal + pendingPotentialTotal < guarantorGap`.
- Failed state is `guarantor_coverage_failed`.
- Borrower must create a new application (or resubmit with new guarantors when edit flow is added).

## 8. Credit Reservation Timing

- No hard reservation at initial submission.
- Hard reservation starts when guarantor approves.
- On each guarantor approval, system re-validates guarantor capacity server-side before accepting approval.
- Approved guaranteed amount is reserved and reduces guarantor effective capacity for new guarantees.
- Reservation is released when:
  - Loan is rejected/cancelled before disbursement.
  - Loan is fully completed/closed.

## 9. Admin Final Approval Gate

- Admin can final-approve only when:
  - Loan status is `pending_admin_approval`.
  - `approvedGuarantorTotal >= guarantorGap`.
  - Required data and terms acceptance are valid.
- At final approval, backend re-checks guarantor reservations and configuration constraints.
- Client-side direct status mutation is not allowed for approval transitions.

## 10. Repayment and Interest Rules

- Repayment schedule and totals are generated using selected loan type configuration.
- Flat monthly interest formula remains:
  - `TotalInterest = Principal * monthlyRate * months`
  - `TotalOwed = Principal + TotalInterest`
  - `Installment = TotalOwed / months`
- Bank/processing charges are added to first installment only (existing behavior).

## 11. Workflow Statuses (Authoritative)

- `pending_guarantor_approval`
- `pending_admin_approval`
- `approved`
- `rejected`
- `cancelled`
- `guarantor_coverage_failed`

## 12. Security and Ownership Rules

- Guarantor can respond only to requests where `guarantorId == currentUser`.
- Borrower can view but cannot modify guarantor decisions.
- Admin-only action: final approval/rejection after guarantor stage.
- All workflow-critical checks and transitions must run in Appwrite Functions.

## 13. Addendum (2026-03-04): Guarantor Repayment Waterfall

This addendum applies to `long_term` loans that use guarantor coverage.

### 13.1 Repayment Allocation Order

For each repayment transaction:
- Step 1: Apply payment to interest due first.
- Step 2: Remaining amount is principal portion.
- Step 3: Principal portion is allocated to guarantors first until guarantor secured exposure is fully settled.
- Step 4: Only after all guarantor secured exposure is settled does principal reduce borrower normal loan principal.

### 13.2 Guarantor Share Basis

- Each guarantor has an approved guaranteed amount at approval time.
- Guarantor principal recovery is allocated pro-rata by each guarantor remaining `securedOutstanding`.
- Example:
  - Guarantor A remaining secured = 400,000
  - Guarantor B remaining secured = 400,000
  - Principal portion in this repayment = 100,000
  - Allocation: A = 50,000, B = 50,000

### 13.3 Eligibility Restoration

- Guarantor available credit/eligibility is restored progressively as that guarantor `securedOutstanding` is reduced.
- Full restoration for a guarantor occurs when their `securedOutstanding` reaches zero.

### 13.4 Settlement Completion Rule

- `totalSecuredOutstanding = 0` is the boundary where repayment allocation switches from guarantor-first principal recovery to borrower principal reduction.
- Interest continues to be applied first in every repayment, including after guarantor exposure is cleared.

### 13.5 Implementation Constraints

- Allocation and updates to guarantor exposure must be server-side authoritative.
- Repayment allocation must be atomic per transaction to avoid partial or conflicting allocations.
