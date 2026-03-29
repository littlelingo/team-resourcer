# Research: Import Salary Should Not Create History

## Problem

When importing members with a salary column, the system creates a `member_history` row for every new member's salary. This is incorrect because:

- The imported salary is a **current snapshot**, not a salary-change event
- The `effective_date` is set to `date.today()`, misrepresenting when the salary was actually set
- It creates spurious `"Imported"` entries that pollute the history timeline
- It conflicts with the dedicated financial history import (feature 021) which handles actual history records

## Current State

### The problematic function

`backend/app/services/import_commit.py`, lines 87-112:

```python
async def _append_history_if_changed(db, member, field, new_value, is_new):
    ...
    existing = getattr(member, field, None)
    if is_new or existing != new_decimal:   # <-- line 103: is_new causes spurious writes
        entry = MemberHistory(...)
        db.add(entry)
```

### Call site

`backend/app/services/import_commit.py`, line 325 inside `_commit_members`:

```python
for fin_field in _FINANCIAL_FIELDS:
    val = data.get(fin_field)
    if val is not None and val != "":
        await _append_history_if_changed(db, member, fin_field, val, is_new)
        setattr(member, fin_field, Decimal(str(val)))
```

### `_FINANCIAL_FIELDS` affects: `salary`, `bonus`, `pto_used`

### Other paths (NOT affected)

- `member_service.create_member` (lines 116-119) — UI form creation, writes history intentionally. Leave as-is.
- `member_service.update_member` (lines 141-143) — UI form update, writes history on change. Correct behavior.
- `_commit_financial_history` (line 342) — dedicated history import. Separate path, unaffected.

## Proposed Fix

**Option 1 (simplest)**: Change line 103 from:
```python
if is_new or existing != new_decimal:
```
to:
```python
if existing is not None and existing != new_decimal:
```

This means history is only written when an existing member's value actually changes. New members (where `existing` is `None`) get their scalar set but no history entry.

**Option 2**: Pass `is_new=False` unconditionally at line 325, or skip the `_append_history_if_changed` call for new members.

Option 1 is a one-line change with clearest semantics.

## Dependencies & Risks

- `_append_history_if_changed` is only called from `_commit_members` — no other callers. Low blast radius.
- The `setattr` on line 326 still sets the current salary value regardless. The fix only prevents the history row.
- Existing spurious `"Imported"` history entries in databases are not cleaned up by this fix (forward-looking only).

## Known Errors (from `.context/errors/INDEX.md`)

- **ERR-018**: `_append_history_if_changed` previously had bare `except: pass` swallowing Decimal errors. Fixed in feature 010.
- **ERR-019**: `"$75,000"` format strings failed Decimal conversion. Fixed in feature 027 via `import_amount_utils.py`.

## Test Coverage Gap

`test_import_commit.py` has zero tests for salary/history. Three tests needed:

1. Import **new member with salary** -> assert NO `member_history` row created
2. Import **existing member with different salary** -> assert `member_history` row IS created
3. Import **existing member with same salary** -> assert NO `member_history` row created
