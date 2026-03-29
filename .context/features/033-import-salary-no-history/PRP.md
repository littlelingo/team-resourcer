# PRP: Import Salary No History

## Status: APPROVED
## Complexity: LOW
## Testing Strategy: implement-then-test

## Context

When importing members with salary/bonus/pto_used, `_append_history_if_changed()` in `import_commit.py` creates a `member_history` row for every new member. The `is_new` branch treats imported values as change events, but they're current snapshots. This pollutes the history timeline with spurious "Imported" entries.

## Requirements

- Importing a new member with salary sets the scalar value but creates NO history entry
- Importing an existing member with a changed salary creates a history entry (existing behavior, preserved)
- Importing an existing member with the same salary creates NO history entry (existing behavior, preserved)
- The dedicated financial history import path (`_commit_financial_history`) is unaffected

## Implementation Steps

### Step 1 — Fix `_append_history_if_changed`

**File**: `backend/app/services/import_commit.py`

- Remove `is_new` parameter from function signature
- Update docstring to reflect new semantics
- Change condition from `if is_new or existing != new_decimal` to `if existing is not None and existing != new_decimal`

### Step 2 — Update call site

**File**: `backend/app/services/import_commit.py`

- Remove `is_new` argument from call at line 325

### Step 3 — Add integration tests

**File**: `backend/tests/integration/test_import_commit.py`

- Add `MemberHistory` and `Decimal` imports
- Test 1: new member with salary → no history row
- Test 2: existing member with changed salary → history row created
- Test 3: existing member with same salary → no history row

## Files Modified

| File | Change |
|------|--------|
| `backend/app/services/import_commit.py` | Fix condition, update docstring, remove `is_new` param + arg |
| `backend/tests/integration/test_import_commit.py` | Add imports + 3 test functions |

## Validation

All 12 tests in `test_import_commit.py` pass (9 existing + 3 new).
