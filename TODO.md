# Long-Term Loan + Guarantor TODO

Use this checklist to implement one task at a time, in strict order.

## Baseline (Already Done)

- [x] 1. Confirm and freeze base business rules (coverage, decline behavior, approval thresholds, credit reservation timing). See `docs/long-term-loan-business-rules.md`.
- [x] 2. Update base loan schema (`loanType`, `selectedMonths`, `termsAccepted`, guarantor summary fields). Migration: `scripts/migrate-loan-schema-v2.js`.

## Clarification

- Tasks 1 and 2 do not need to be redone.
- New requirements (guarantor repayment waterfall) are handled as additive tasks below.

## Progressive Implementation Sequence

- [x] 3. Update rules spec addendum for guarantor repayment waterfall (interest first, then guarantor principal recovery, then borrower principal). See `docs/long-term-loan-business-rules.md` section 13.
- [x] 4. Create `loan_guarantors` collection with waterfall-ready fields (created as `69a7e1830037f8deafd3`):
  - `loanId`, `borrowerId`, `guarantorId`
  - `guaranteeType` (`amount`/`percent`)
  - `guaranteedPercent`, `guaranteedAmount`
  - `approvedAmount`, `securedOutstanding`
  - `status`, `comment`, timestamps
- [x] 5. Add schema migration v3 for additional waterfall aggregate fields (`securedOriginalTotal`, `securedOutstandingTotal`, `guarantorPrincipalRecoveredTotal`, `borrowerPrincipalRecoveredTotal`, `repaymentAllocationStatus`, allocation timestamps). Migration: `scripts/migrate-loan-schema-v3.js`.
- [x] 6. Extend Financial Configuration model with long-term settings (`longTermInterestRate`, `longTermMaxRepaymentMonths`). Applied via `scripts/migrate-financial-config-schema-v2.js` and defaults updated in `src/lib/financialConfig.js`.
- [x] 7. Update Financial Configuration UI for long-term settings (validation + persistence).
- [x] 8. Update member application UI:
  - `Loan Type` selector
  - dynamic repayment months by type
  - terms checkbox/content
  - guarantor capture as amount/percent
- [x] 9. Implement Appwrite Function `longterm-loan-submit` (server validation + create loan + create guarantor requests).
- [x] 10. Wire frontend loan submit to `longterm-loan-submit` (no direct workflow-critical writes from client).
- [x] 11. Add guarantor requests UI on member dashboard (approve/decline).
- [x] 12. Implement Appwrite Function `guarantor-response` (identity check + status update + recompute coverage safely).
- [x] 13. Wire guarantor approve/decline UI to `guarantor-response`.
- [x] 14. Add borrower-side tracking of guarantor approvals and guaranteed coverage.
- [x] 15. Implement Appwrite Function `loan-final-approval` (admin-only final validation + disbursement + repayment plan generation).
- [x] 16. Wire admin final approval UI to `loan-final-approval` and block direct client-side status mutation.
- [x] 17. Implement server-side repayment allocation waterfall:
  - split payment into interest/principal
  - allocate principal to guarantors pro-rata by remaining `securedOutstanding`
  - restore guarantor eligibility progressively
  - once guarantors are fully settled, reduce borrower principal normally
- [x] 18. Update reports/ledger views for long-term + guarantor settlement progress.
- [x] 19. Add tests for waterfall repayment cases (single guarantor, equal split, unequal split, partial settlement).
- [x] 20. Final migration verification + end-to-end tests for all flows.
  - Automation added: `npm run verify:longterm-rollout` (runs migrations, schema checks, waterfall tests, and E2E flow verification).

## Appwrite Functions Scope

- Server-side only:
  - Loan workflow validation and state transitions.
  - Guarantor approval/decline state changes.
  - Final approval checks, disbursement, and repayment schedule creation.
  - Permission-sensitive checks (admin/guarantor/borrower role enforcement).
- Frontend only:
  - Forms, tables, and status displays.
  - Calling functions and rendering results/errors.

## Working Rule

- We work in order unless explicitly changed.
- Complete exactly one item per prompt, then tick it off.

---

# Global Interest Mode TODO (All Loans)

Use this checklist for the new requirement: admin can switch interest from flat (original principal) to reducing balance (outstanding principal), and it affects all loans.

- [x] 1. Add financial config support for `interestCalculationMode` (`flat` | `reducing_balance`) in defaults, schema provisioning, migration, and admin configuration UI.
- [x] 2. Update repayment plan generation in `functions/longterm-loan-submit` and `functions/loan-final-approval` to use `interestCalculationMode`.
- [x] 3. Persist loan-level calculation metadata on approval/submission so each loan has an auditable method and schedule basis.
- [x] 4. Update `functions/loan-management` repayment posting (scheduled + early payoff) to compute allocations using loan calculation method correctly.
- [x] 5. Update admin/member loan views and report labels to clearly show calculation method and prevent interpretation errors.
- [x] 6. Add migration/backfill for existing loans/config docs so pre-existing loans remain valid (default to `flat` where missing).
- [x] 7. Add automated tests for both modes (flat and reducing balance), including edge cases.
- [x] 8. Run rollout verification script(s), validate in UI, and document deploy/migration order.

---

# Combined TODO (Auth Sync + Reports + Member Loan Details)

Use this checklist to implement one task at a time, in strict order.

- [x] 1. Define the admin-auth sync action to add to `functions/create-member/main.js` (inputs, admin validation, expected outputs).
- [x] 2. Implement the admin-auth sync action to update Appwrite Auth email/password via `Users` and then sync the `members` document.
- [x] 3. Update admin member edit flow to call the new function for email changes (Auth + DB) instead of direct DB-only updates.
- [x] 4. Add admin password reset UI + wire it to the same function (Auth-only update; no password stored in DB).
- [x] 5. Update report calculations to use `financialConfig.loanEligibilityPercentage` instead of hard-coded 0.8 in member/admin reports.
- [x] 6. Normalize Appwrite relationship IDs in member/admin reports so loan charges/repayments resolve consistently.
- [x] 7. Fetch member loan repayments in `src/components/member/MemberReports.jsx` for detailed reporting.
- [x] 8. Build per-loan datasets in member reports: Loan Summary, Repayment History, Repayment Plan.
- [x] 9. Extend member PDF export with Loan Summary, Repayment History, and Repayment Plan sections (per loan).
- [x] 10. Extend member CSV exports with Loan Summary, Repayment History, and Repayment Plan outputs.
- [x] 11. Add interest mode + applied rate fields to member loan exports (PDF + CSV).
- [x] 12. Align report date-range behavior for “due/overdue” labels to avoid confusion on historical ranges.
- [x] 13. Apply minor reports UX polish (table density, section labels, and export button consistency).

---

# UI/UX + Report PDF Fixes

Use this checklist to implement one task at a time, in strict order.

- [x] 1. Fix KPI/metric card truncation on Member Overview (labels and currency values).
- [x] 2. Fix KPI/metric card truncation on Admin Overview and Admin Reports Snapshot.
- [x] 3. Improve greeting capitalization on Member Overview (e.g., title-case full name).
- [x] 4. Remove redundant "Back to Overview" link on pages already at Overview (member + admin).
- [x] 5. Adjust Reports date-range helper text spacing so it doesn’t crowd the inputs.
- [x] 6. PDF: Widen/reshape Loan Summary table so "Interest Mode" doesn’t wrap awkwardly.
- [x] 7. PDF: Add % symbol to interest rate in Loan Summary table.
- [x] 8. PDF: Ensure completed loans show correct balance (0 or actual outstanding) in report.
- [x] 9. PDF: Add clearer section continuity when tables span pages (e.g., repeat section header or “(cont.)”).

---

# New Requirements TODO (Roles + Batch Savings + Notifications + Member Profile)

Use this checklist to implement one task at a time, in strict order.

- [x] 1. Confirm notification rules:
  - Overdue loan definition: 7-day grace period after scheduled installment date.
  - Missing savings rule: monthly required; paying next month still counts as missing for the original month.
- [x] 2. Update role model to allow dual roles (admin + member):
  - Choose source of truth (Appwrite labels vs `members.roles` array).
  - Ensure both roles can be held simultaneously.
- [x] 3. Add role switcher UI so dual-role users can switch portals.
- [x] 4. Update auth gating to respect multi-role access (admin and member).
- [x] 5. Add Admin "Batch Savings" entry UI:
  - Single date selector.
  - Member list with per-member amount inputs.
- [x] 6. Add Appwrite Function `batchAddSavings` with admin-only validation.
- [x] 7. Wire Admin batch savings UI to the function and handle errors/success.
- [x] 8. Move "Pending Admin Approval" section to top of Admin Loans page.
- [x] 9. Fix Admin Loans portfolio figure truncation (wrap/shrink/responsive).
- [x] 10. Add notification bell in admin header (pending approvals count).
- [ ] 11. Add notification bell in member header (overdue loans + missing savings).
- [x] 12. Member Profile: enable email change (Auth + members collection sync).
- [x] 13. Member Profile: comment out/disable "Change Password" section under Security Settings.
