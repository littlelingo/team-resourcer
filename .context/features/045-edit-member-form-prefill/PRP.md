# PRP: Fix Edit Member Form Showing Blank Values

## Status: COMPLETE

## Context

Edit form dialog opens with blank values because React Hook Form's `defaultValues` only initializes on mount. The always-mounted dialog doesn't re-read member data when re-opened.

## Testing Strategy: implement-then-test

## Changes

### `frontend/src/components/members/useMemberForm.ts`

Added `useEffect` after `isFirstRender` reset that calls `form.reset(memberValues)` when dialog opens. Handles both Edit (with member data) and Add (empty defaults) modes.

## Verification

- `cd frontend && npx vitest run` — 135 tests pass
- Manual: Edit member → form shows data; Add member → form is blank; Edit different member → correct data
