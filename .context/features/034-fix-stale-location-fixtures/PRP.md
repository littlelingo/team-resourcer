# PRP: Fix Stale Location Test Fixtures

## Status: COMPLETE
## Complexity: LOW
## Testing Strategy: implement-then-test

## Context

Feature 020 split `location` into `city` + `state`, but `valid_members.csv` and `valid_members.xlsx` test fixtures weren't updated. The 4 tests using these fixtures with pass-through column maps failed because the import mapper rejects `location` as an unknown target field.

## Changes

- Replaced `location` column with `city` + `state` in `valid_members.csv`
- Regenerated `valid_members.xlsx` from updated CSV
- No test code changes needed — assertions only check counts, not field values

## Validation

All 170 tests pass (previously 4 failures).
