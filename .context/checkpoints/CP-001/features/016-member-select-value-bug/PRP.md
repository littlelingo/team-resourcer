# PRP: Fix Select.Item Empty Value Error on Members Page

## Status: APPROVED
## Complexity: LOW
## Testing Strategy: implement-then-test

## Problem

Opening the Add Member dialog on the Members page throws a console error:
> Uncaught Error: A `<Select.Item />` must have a value prop that is not an empty string.

Root cause: `SelectField.tsx` line 43 renders a "None" clear option with `value=""`, which Radix UI Select v2 rejects (empty string is reserved for "no selection").

## Solution

Use a sentinel value (`__none__`) for the "None" item and translate it back to `""` in `onValueChange`. This matches the existing pattern in `TeamFormDialog.tsx` line 255.

## Implementation Steps

### Step 1: Fix SelectField.tsx

**File:** `frontend/src/components/shared/SelectField.tsx`

Changes:
1. Add a `NONE_VALUE` constant: `const NONE_VALUE = '__none__'`
2. Line 15: Change `value={value || ''}` to `value={value || NONE_VALUE}`
3. Line 15: Change `onValueChange={onChange}` to `onValueChange={(v) => onChange(v === NONE_VALUE ? '' : v)}`
4. Line 43: Change `value=""` to `value={NONE_VALUE}`

No other files need changes — all three `MemberFormDialog` select fields consume `SelectField` and will be fixed automatically.

## Validation Criteria

1. Open Members page, click "Add Member" — no console error
2. Open each dropdown (Functional Area, Team, Supervisor) — no console error
3. Select "None" in any dropdown — field clears correctly, form submits with null/undefined for that field
4. Select a value, then change to "None" — field clears correctly
5. Edit an existing member — pre-populated values display correctly
6. Submit form with all fields filled — member created/updated correctly

## Risks

- **Low.** Single file, ~4 line changes. Sentinel pattern already validated in `TeamFormDialog`.
