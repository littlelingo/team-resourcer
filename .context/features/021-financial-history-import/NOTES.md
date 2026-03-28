# 021 — Financial History Import (Salary + Bonus)

## Goal
Allow importing salary history and bonus history as separate import types (not part of member import). Each row has an `employee_id` to match against existing members. Unmatched rows are collected and displayed in a status/results modal after import.

## Current State

### Import System
- **4-step wizard**: Source → Map Columns → Preview → Results
- **5 entity types**: member, program, area, team, agency
- **Entity selection**: `ImportWizard` receives `entityType` prop; no in-wizard selector
- **Results step**: `ResultStep.tsx` already shows created/updated/skipped counts + error accordion with `error_rows`
- **Backend flow**: upload → session (in-memory, 30-min TTL) → mapping/validation → commit → CommitResult

### Key Backend Files
| File | Role |
|------|------|
| `import_mapper.py` | `ENTITY_CONFIGS` dict, `apply_mapping()`, row validation |
| `import_commit.py` | `commit_import()` dispatch, entity-specific `_commit_*` functions |
| `import_parser.py` | CSV/XLSX parsing |
| `import_session.py` | In-memory session store |
| `import_router.py` | `/api/import/{upload,preview,commit}` |
| `import_schemas.py` | `EntityType` enum, `CommitResult`, `MappedRow` |

### Key Frontend Files
| File | Role |
|------|------|
| `ImportWizard.tsx` | Wizard shell, 4-step state machine |
| `SourceStep.tsx` | File upload + Google Sheets |
| `MapColumnsStep.tsx` | Column mapping, `*_TARGET_FIELDS` constants |
| `PreviewStep.tsx` | Preview + commit trigger |
| `ResultStep.tsx` | Summary cards + error accordion |
| `importApi.ts` | API functions + TS types |

### Financial History Model
- **Single EAV table**: `member_history` with `field` discriminator ("salary", "bonus", "pto_used")
- **Schema**: `member_uuid` FK, `field` varchar(20), `value` numeric(12,2), `effective_date` date, `notes` text
- **Current import behavior**: `_append_history_if_changed()` fires during member import when salary/bonus changes; `effective_date` is always `date.today()`, `notes="Imported"`
- **`TeamMember` scalar fields**: `salary`, `bonus`, `pto_used` store current snapshot

### employee_id
- `String(50)`, `UNIQUE NOT NULL` constraint on `team_members` table
- Import dedup uses `employee_id` as the key
- Lookup: `select(TeamMember).where(TeamMember.employee_id == emp_id)`

## What Needs to Be Built

### New Entity Types
Two new import entity types: `salary_history` and `bonus_history`

### Target Fields for Each
- `employee_id` (required) — matches against existing member
- `effective_date` (required) — the date the salary/bonus took effect
- `value` / `amount` (required) — the salary or bonus amount
- `notes` (optional) — free text notes

### Backend Changes
1. **`import_mapper.py`**: Add `ENTITY_CONFIGS["salary_history"]` and `ENTITY_CONFIGS["bonus_history"]` with target_fields, required_fields, validators
2. **`import_schemas.py`**: Add `salary_history` and `bonus_history` to `EntityType` enum
3. **`import_commit.py`**: Add `_commit_salary_history()` and `_commit_bonus_history()` functions that:
   - Look up member by `employee_id`
   - If no match: add to `error_rows` with message "No member found with employee_id X"
   - If match: create `MemberHistory` record with `field="salary"` (or `"bonus"`), `value`, `effective_date`, `notes`
   - Also update the member's scalar `salary`/`bonus` field if the imported record's `effective_date` is >= the latest existing history entry (i.e., this is the current value)
4. **`import_router.py`**: No changes needed — commit dispatch already routes by entity_type

### Frontend Changes
5. **`MapColumnsStep.tsx`**: Add `SALARY_HISTORY_TARGET_FIELDS` and `BONUS_HISTORY_TARGET_FIELDS` constants
6. **`ImportWizard.tsx` / page integration**: Allow selecting salary_history / bonus_history as entity types — either from the Members page with a dropdown or as separate import buttons
7. **`ResultStep.tsx`**: Already shows error_rows — the unmatched employee_id rows will naturally appear here. May want to enhance the error message display.

### Error Reporting for Unmatched employee_ids
- The existing `CommitResult.error_rows` mechanism handles this perfectly
- Each unmatched row becomes an error_row with a descriptive message
- `ResultStep.tsx` already renders these in an expandable accordion
- No new modal needed — the existing results step IS the status modal

## Risks
- **Updating scalar salary/bonus on member**: Need to determine if the imported value should update the member's current salary. Should only update if `effective_date` is the most recent.
- **Duplicate history entries**: Need dedup strategy — same employee_id + effective_date + value should probably skip rather than create duplicate.
- **Date parsing**: `effective_date` comes from CSV as string — need validation in mapper.

## Open Questions
1. Should importing salary history also update the member's current `salary` scalar field? (If the imported effective_date is the most recent)
2. Should these be accessible from the Members page as a dropdown option, or as separate import buttons?
3. What about `pto_used` history — should that be a third import type, or just salary and bonus for now?
