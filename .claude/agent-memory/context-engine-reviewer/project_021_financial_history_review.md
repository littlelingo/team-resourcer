---
name: project_021_financial_history_review
description: 021-financial-history-import (salary/bonus/PTO import, _commit_financial_history): key findings from review on 2026-03-27
type: project
---

Key findings from feature 021 review:

**Critical:**
1. `PreviewStep.tsx` has an exhaustive `if/elif` on `entityType` for cache invalidation — the three history types fall through with NO cache invalidation. After a successful history import, `memberKeys` should be invalidated so member detail views reflect the updated scalar.
2. Empty `employee_id` edge case: when `required_fields={"employee_id"}` causes the row to be an error row (filtered into `error_rows` before commit), an empty `emp_id` will NOT reach `_commit_financial_history`. However the in-function guard `if emp_id not in emp_lookup:` uses the empty string `""` as key — if the required field check somehow passes (e.g., whitespace-only), `""` would trigger the error path cleanly. Not a bug but worth noting the double-guard.
3. No test file `backend/tests/services/test_import_financial_history.py` was created. PRP required 9 integration tests. This is a critical gap per implement-then-test strategy.

**Warnings:**
1. `affected` dict tracks `(eff_date, amount)` tuples. When multiple rows for the same `emp_id` and same `eff_date` are in the same batch, `matching[-1]` picks the LAST imported value. This is deterministic but the choice is arbitrary — same-date multiple rows isn't validated/warned against.
2. `MemberHistory.field` column is `String(20)`. The values "salary", "bonus", "pto_used" (8 chars) are fine, but this is a soft constraint to watch if field names grow.
3. Scalar update pass uses `matching[-1]` which picks the last inserted value for a given date — not the highest/latest by any business rule. Silently arbitrary.

**Not a bug (confirmed correct):**
- `dedup_field=None` guard in both `apply_mapping` and `commit_import` — correctly implemented per PRP risk #1
- `amount → MemberHistory.value` bridging is correct
- `field_name="pto_used"` for pto_history dispatch is correct
- `error_rows` mutation pattern matches `_commit_members` pattern
- `skipped_count = len(error_rows) + dedup_skipped` correctly counts history error rows

**Why:** To help future reviewer know: cache invalidation gap in PreviewStep is the most impactful issue. Missing tests are the most prominent process gap.
**How to apply:** Flag PreviewStep cache invalidation and missing test file as blockers in any future 021-related review.
