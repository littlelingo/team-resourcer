# PRP: Add "Employee Id" Label to Detail View Badge

## Status: COMPLETE

## Context

The member detail views (slide-out sheet and tree panel) show the employee ID as a bare number in a badge pill. Users can't tell what the number represents. Need to add "Employee Id" text inside the badge, in front of the value.

## Testing Strategy: implement-then-test

## Changes

### 1. `frontend/src/components/members/MemberDetailSheet.tsx` (line 94-96)

Add "Employee Id " text before `{member.employee_id}` inside the badge span.

### 2. `frontend/src/components/trees/panels/MemberDetailPanel.tsx` (line 78-80)

Same change — identical markup in the tree panel detail view.

## Verification

- Rebuild frontend and visually confirm badge shows "Employee Id 182"
- Run `cd frontend && npx vitest run` — no regressions
