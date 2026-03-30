# PRP: Defensive Formatting Pattern

## Status: COMPLETE
## Complexity: LOW
## Testing Strategy: implement-then-test

## Context

The `formatCurrency(value) ?? value` defensive fallback was used in the history timeline but missing from the Compensation section. The hire date was displayed as a raw ISO string. Applied consistent defensive formatting across all display values.

## Changes

- Added `??` fallback to `formatCurrency(member.salary)`, `formatCurrency(member.bonus)`, `formatNumber(member.pto_used)` in Compensation section
- Formatted `hire_date` with `toLocaleDateString()` (matching history date pattern)
- Documented the defensive formatting pattern in `.context/patterns/CODE_PATTERNS.md`

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/members/MemberDetailSheet.tsx` | 4 lines: 3 `??` fallbacks + hire date formatting |
| `.context/patterns/CODE_PATTERNS.md` | Added Defensive Formatting section |

## Validation

All 131 frontend tests pass.
