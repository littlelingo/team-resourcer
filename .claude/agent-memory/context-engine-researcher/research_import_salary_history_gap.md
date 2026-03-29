---
name: research_import_salary_history_gap
description: 2026-03-29 research on why member import incorrectly creates salary history for new members; the gap, fix location, and dependencies
type: project
---

## Finding: Member import always writes history for new members

`_append_history_if_changed` in `backend/app/services/import_commit.py` lines 87–112 creates a `MemberHistory` row when `is_new=True` OR when the value has changed from existing. This means importing a new member with a salary column always creates a history entry dated `date.today()` with `notes="Imported"`.

## The Gap

When using the member import to load the current state of a workforce, the salary column represents the *current value only* — not a historical event. Creating a history row for it produces a spurious entry that misrepresents when the salary was set. Users who later import proper salary history via the `salary_history` entity type will then have a duplicate "Imported" entry for the same amount.

## What needs to change

`_append_history_if_changed` is called from `_commit_members` (line 325):

```python
await _append_history_if_changed(db, member, fin_field, val, is_new)
```

The `is_new` flag (line 274) is what causes new-member salary columns to always write history. The fix is to **not write history during a member import for new members** — or more precisely, to treat `salary` on a new member import the same as a scalar field (just set `member.salary` directly) and skip `_append_history_if_changed` entirely for the import path.

## How salary history IS written outside of imports

`backend/app/services/member_service.py`:
- `create_member` (line 107): always creates a history entry for every non-None financial field on creation — same problem conceptually, but that's a UI form path and arguably intentional (user deliberately sets a salary when creating a member manually).
- `update_member` (line 125): writes history only when `incoming != getattr(member, field)` — correct change-detection behavior.

Both use `create_history_entry` from `history_service.py` directly.

## Key file locations

- `backend/app/services/import_commit.py` — `_append_history_if_changed` lines 87–112; call site line 325; `is_new` set at line 274
- `backend/app/services/member_service.py` — `create_member` lines 107–122, `update_member` lines 125–150
- `backend/app/services/history_service.py` — `create_history_entry` lines 15–33
- `backend/tests/integration/test_import_commit.py` — no test covers salary/history creation; all existing tests cover scalar fields, supervisor resolution, dedup, and session cleanup

## Test gap

`test_import_commit.py` has no test case that:
1. Imports a new member with a salary column and asserts history IS NOT created
2. Imports an existing member with a changed salary and asserts history IS created
3. Imports an existing member with the same salary and asserts history is NOT created

These three cases all need tests for the fix.

**Why:** fixing the `is_new` branch without a test leaves the behavior undocumented and reversible.
**How to apply:** any implementation of this fix must add all three test cases to `test_import_commit.py`.
