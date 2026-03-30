# PRP: Display & Edit Program Assignments on Member Detail

## Status: APPROVED

## Context

Users need to see and edit program assignments on member detail views. Backend fully supports many-to-many assignments. Frontend display existed but edit UI was missing.

## Testing Strategy: implement-then-test

## Changes

### Created
- `frontend/src/components/shared/MultiSelectField.tsx` — Checkbox-based multi-select using Radix DropdownMenu

### Modified
- `frontend/src/hooks/usePrograms.ts` — Added `useAssignProgram` and `useUnassignProgram` mutation hooks
- `frontend/src/components/members/useMemberForm.ts` — Added `program_ids` to schema, defaults, reset, and submit with diff logic
- `frontend/src/components/members/MemberFormDialog.tsx` — Added Programs multi-select in organization section

### Already Working (no changes needed)
- `MemberDetailSheet.tsx` — Program badges already render from detail fetch
- `MemberDetailPanel.tsx` — Program badges already render from detail fetch

## Verification

- `cd frontend && npx vitest run` — 135 tests pass
- `npx tsc --noEmit` — no type errors
