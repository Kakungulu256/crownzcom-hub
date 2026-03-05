# Interest Mode Rollout Runbook

This runbook covers rollout of global interest mode (`flat` vs `reducing_balance`) for all loans.

## 1. Safe Deployment Order

1. Confirm environment variables are set (`.env`) for Appwrite endpoint, project, API key, database, and collection IDs.
2. Run schema/config migrations first:
   - `npm run migrate:financial-config-v2`
   - `npm run migrate:financial-config-v3`
   - `npm run migrate:loan-schema-v2`
   - `npm run migrate:loan-schema-v3`
   - `npm run migrate:loan-schema-v4`
3. Deploy Appwrite Functions that use the new mode logic:
   - `longterm-loan-submit`
   - `loan-final-approval`
   - `loan-management`
4. Deploy frontend (admin/member UI updates for mode visibility and labels).
5. Run full verification:
   - `npm run verify:longterm-rollout`

## 2. Validation Status (Current Repo)

Verified on `2026-03-05`:

1. `npm run verify:longterm-rollout` passed (schema checks, waterfall tests, interest-mode tests, E2E flow).
2. `npm run build` passed.

## 3. Manual UI Validation Checklist

1. Admin > Financial Configuration:
   - Switch `Interest Calculation Mode` between `Flat` and `Reducing Balance`.
   - Save and reload page; selected mode remains persisted.
2. Member/Admin loan creation:
   - Create one loan under `Flat` and one under `Reducing Balance`.
   - Confirm repayment schedule values differ as expected and are internally consistent.
3. Loan details/report views:
   - Confirm each loan shows its applied method (loan-level metadata), not only current global config.
   - Confirm labels clearly indicate method to avoid misinterpretation.
4. Repayment posting:
   - Post at least one installment on each mode.
   - Confirm interest/principal split follows the loan's applied method.
5. Early settlement:
   - Trigger early payoff estimate and confirm mode-aware computation.
6. Legacy loans:
   - Confirm pre-existing loans still load with default method (`flat`) and no document-structure errors.

## 4. Rollback Notes

1. Do not remove new attributes if already in use.
2. If rollback is needed, redeploy previous frontend/functions while leaving schema additive changes in place.
3. Set Financial Configuration mode back to `flat` to return to legacy behavior for newly generated schedules.
