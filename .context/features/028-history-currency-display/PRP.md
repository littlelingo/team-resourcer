---
feature: 028-history-currency-display
phase: bugfix
status: APPROVED
testing: implement-then-test
complexity: LOW
depends_on: []
---

# PRP 028 — History Currency Display Fix

## Overview

The member detail sheet history timeline renders financial values as raw decimal strings
(`120000.00`) rather than formatted currency (`$120,000.00`). The fix has two parts:

1. Extract the two local format helpers from `MemberDetailSheet.tsx` into a shared
   `frontend/src/lib/format-utils.ts` module.
2. Apply those helpers to the history section's `entry.value` render based on `entry.field`.

No backend changes are required. The research notes confirm deduplication already works
correctly in `backend/app/services/import_commit.py` for both import paths.

---

## Steps

### Step 1 — Create `frontend/src/lib/format-utils.ts`

Create a new file that exports the two formatting functions currently private to
`MemberDetailSheet.tsx` (lines 17–29).

**File to create:** `frontend/src/lib/format-utils.ts`

The file must export:

- `formatCurrency(value: string | null | undefined): string | null`
  - Returns `null` when `value` is falsy
  - Parses via `parseFloat`; returns the original `value` string unchanged if `isNaN`
  - Formats using `new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)`

- `formatNumber(value: string | null | undefined): string | null`
  - Returns `null` when `value` is falsy
  - Parses via `parseFloat`; returns the original `value` string unchanged if `isNaN`
  - Returns `num.toString()` — strips trailing decimal zeros (e.g. `"40.00"` → `"40"`)

Both function bodies must be identical to the originals in `MemberDetailSheet.tsx` — do
not alter their logic during extraction.

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend
npx tsc --noEmit
```
TypeScript must compile without errors after this step alone.

---

### Step 2 — Update `MemberDetailSheet.tsx`

**File to edit:** `frontend/src/components/members/MemberDetailSheet.tsx`

**2a. Replace local helper declarations with an import.**

Remove lines 17–29 (the two `function formatCurrency` / `function formatNumber` declarations)
and add an import from the new utility:

```
import { formatCurrency, formatNumber } from '@/lib/format-utils'
```

Place this import after the existing `import { getInitials } from '@/lib/member-utils'` line
(currently line 7).

**2b. Fix the history timeline render.**

Locate the `<span>` on line 257 inside the history `sortedHistory.map` block
(currently `<span className="font-normal">{entry.value}</span>`).

Replace `{entry.value}` with a conditional expression that dispatches on `entry.field`:

- `entry.field === 'salary'` or `entry.field === 'bonus'` → `formatCurrency(entry.value)`
- `entry.field === 'pto_used'` → `` `${formatNumber(entry.value)} hrs` ``
- any other field → `entry.value` (passthrough, unchanged)

The `<span>` element itself and its `className` must not change.

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend
npx tsc --noEmit
```
TypeScript must compile without errors. The two helper functions must no longer exist as
module-level declarations in `MemberDetailSheet.tsx`.

---

### Step 3 — Add tests for `format-utils`

**File to create:** `frontend/src/lib/__tests__/format-utils.test.ts`

Follow the same pattern as `frontend/src/lib/__tests__/member-utils.test.ts` — plain
`describe` + `it` blocks using `expect`, no MSW or React Testing Library needed.

Required test cases for `formatCurrency`:

| Input | Expected output |
|-------|----------------|
| `"120000.00"` | `"$120,000.00"` |
| `"15000.50"` | `"$15,000.50"` |
| `"0.00"` | `"$0.00"` |
| `"abc"` (non-numeric) | `"abc"` (passthrough) |
| `null` | `null` |
| `undefined` | `null` |
| `""` (empty string) | `null` |

Required test cases for `formatNumber`:

| Input | Expected output |
|-------|----------------|
| `"40.00"` | `"40"` |
| `"40.50"` | `"40.5"` |
| `"0.00"` | `"0"` |
| `"abc"` (non-numeric) | `"abc"` (passthrough) |
| `null` | `null` |
| `undefined` | `null` |
| `""` (empty string) | `null` |

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend
npx vitest run src/lib/__tests__/format-utils.test.ts
```
All cases must pass. Zero skipped.

---

### Step 4 — Verify no regressions

Run the full frontend test suite to confirm nothing is broken by the extraction.

```bash
cd /Users/clint/Workspace/team-resourcer/frontend
npx vitest run
```

All previously passing tests must still pass. Pay particular attention to:
- `frontend/src/components/members/__tests__/MemberCard.test.tsx` — no direct dependency,
  but lives alongside the edited component
- `frontend/src/lib/__tests__/member-utils.test.ts` — adjacent lib file, sanity check

---

## File Manifest

| Action | Path |
|--------|------|
| CREATE | `frontend/src/lib/format-utils.ts` |
| CREATE | `frontend/src/lib/__tests__/format-utils.test.ts` |
| EDIT   | `frontend/src/components/members/MemberDetailSheet.tsx` |

No other files require changes. The backend is not touched.

---

## Testing Plan

**Strategy:** implement-then-test (project default per CLAUDE.md)

1. Implement Steps 1 and 2 first (extraction + render fix).
2. Then write the unit tests in Step 3.
3. Confirm end-to-end with Step 4 regression run.

There are no integration tests or API mocks needed — `formatCurrency` and `formatNumber`
are pure functions.

---

## Validation Criteria

- `npx tsc --noEmit` passes after Step 1 and after Step 2.
- `npx vitest run src/lib/__tests__/format-utils.test.ts` reports all cases passing.
- `npx vitest run` shows zero new failures.
- `MemberDetailSheet.tsx` contains no top-level `function formatCurrency` or
  `function formatNumber` declarations.
- Visually: history entries for `salary` and `bonus` display as `$120,000.00`; `pto_used`
  displays as `40 hrs`.

---

## Risks

- **`Intl.NumberFormat` locale in test environment.** Vitest runs in a jsdom environment.
  The `en-US` locale formatting (`$120,000.00`) must match what jsdom's `Intl` produces.
  If the CI runner's locale produces a different decimal/grouping separator, the currency
  test assertions will fail. Use exact string literals in tests matching `en-US` output
  (`$120,000.00`) and confirm locally first. This is unlikely to be an issue in Node 18+
  but worth noting.

- **`formatNumber` strips trailing zeros.** `"40.00"` → `"40"`, not `"40.0"` or `"40.00"`.
  This is intentional (matches current `num.toString()` behavior). The ` hrs` suffix test
  assertions should reflect this: `"40 hrs"`, not `"40.00 hrs"`.

- **Other `entry.field` values.** The field names `salary`, `bonus`, and `pto_used` are
  the only financial fields written by `import_commit.py`. Any other field (e.g. a future
  `title` or `team` history entry) will fall through to the raw passthrough branch. The
  conditional must use strict equality (`===`) — do not use a regex or includes check.

---

## Rollback Plan

All changes are frontend-only and isolated to two new files plus one component edit. To
roll back: delete `frontend/src/lib/format-utils.ts` and
`frontend/src/lib/__tests__/format-utils.test.ts`, then restore the original
`MemberDetailSheet.tsx` (re-add the two local helper functions, revert the import line,
revert the `<span>` render expression).
