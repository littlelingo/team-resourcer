# PRP: Member Card Employee ID Label

## Status: COMPLETE
## Complexity: LOW
## Testing Strategy: implement-then-test

## Context

The member card did not display the employee ID. Users had to open the detail sheet to see it. Added a `Hash` icon + value row following the same pattern as the location row.

## Changes

- Added `Hash` icon import from lucide-react
- Added employee ID row after location, guarded by `member.employee_id`
- Added test asserting employee ID renders on the card

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/members/MemberCard.tsx` | Add `Hash` import + employee ID row |
| `frontend/src/components/members/__tests__/MemberCard.test.tsx` | Add test for employee_id rendering |

## Validation

All 13 MemberCard tests pass.
