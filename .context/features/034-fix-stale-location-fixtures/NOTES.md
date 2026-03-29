# Research: Fix Stale Location Test Fixtures

## Problem

4 tests fail because `valid_members.csv` still has a `location` column that was split into `city`/`state` in feature 020. The import mapper rejects `location` as an unknown target field.

## Failing Tests

| Test | File | Why |
|------|------|-----|
| `test_preview_returns_mapped_rows` | `tests/integration/test_import_routes.py:62` | preview returns 422, `location` unknown |
| `test_commit_creates_members` | `tests/integration/test_import_routes.py:113` | commit returns 422 |
| `test_commit_then_session_deleted` | `tests/integration/test_import_routes.py:146` | commit fails → session not deleted → follow-up preview returns 200 not 404 |
| `test_apply_mapping_from_csv_fixture` | `tests/unit/test_import_mapper.py:121` | `apply_mapping` raises ValueError |

## Root Cause

All 4 tests use `valid_members.csv` with a pass-through column map (`{h: h for h in headers}`). The CSV header has `location` but `import_mapper.py` lines 54-74 only has `city` and `state` as valid target fields (since feature 020).

## Current CSV Data (location column)

| Row | location |
|-----|----------|
| EMP001 | New York |
| EMP002 | London |
| EMP003 | Chicago |
| EMP004 | Austin |
| EMP005 | Seattle |

## Proposed Fix

**Update `valid_members.csv`**: Replace `location` column with `city` + `state` columns.

| Row | city | state |
|-----|------|-------|
| EMP001 | New York | NY |
| EMP002 | London | (blank) |
| EMP003 | Chicago | IL |
| EMP004 | Austin | TX |
| EMP005 | Seattle | WA |

This is the only change needed — the pass-through map will then send valid `city`/`state` target fields.

## Additional Note

- `valid_members.xlsx` likely has the same stale `location` column. `test_upload_xlsx_returns_session_id` passes because it only checks `total_row_count`, but the xlsx should also be regenerated.
- No other CSV fixtures (`invalid_members.csv`, `duplicate_ids.csv`) are affected.

## Files to Modify

| File | Change |
|------|--------|
| `backend/tests/fixtures/valid_members.csv` | Replace `location` with `city` + `state` |
| `backend/tests/fixtures/valid_members.xlsx` | Regenerate from updated CSV (if possible) |

## Dependencies & Risks

- Low blast radius — only the fixture file changes
- No production code changes needed
- The 3 integration tests may also need assertion updates if they check for `location` in response data
