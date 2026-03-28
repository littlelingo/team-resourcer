---
name: research_import_and_history
description: Deep research (2026-03-27) on the import wizard architecture, financial history models, and employee_id dedup mechanics
type: project
---

## Import System Architecture

### API Routes — `backend/app/api/routes/import_router.py`
Prefix: `/api/import`

| Endpoint | Method | Purpose |
|---|---|---|
| `/upload` | POST | Multipart file → parse → create session → return session_id + headers + 10-row preview |
| `/google-sheets` | POST | Sheet URL/ID → fetch via import_sheets → same session response |
| `/preview` | POST | `MappingConfig` → apply mapping + validate → return up to 50 `MappedRow` results |
| `/commit` | POST | `MappingConfig` → re-apply mapping → upsert to DB → return `CommitResult` |

Session is destroyed after `/commit`.

### Backend Services

- `import_parser.py` — Parses `.csv` (utf-8-sig fallback latin-1) and `.xlsx` (pandas/openpyxl). Returns `ParseResult` with `raw_rows`, `headers`, `preview_rows[:10]`, `total_row_count`.
- `import_session.py` — In-memory dict `_sessions`. TTL = 30 min. Background cleanup task every 5 min. `SessionNotFoundError` on miss/expiry.
- `import_mapper.py` — `apply_mapping()`: reads session raw rows, applies `column_map`, validates required/numeric/entity-specific fields, deduplicates by `dedup_field`. Returns `MappedPreviewResult`.
- `import_commit.py` — `commit_import()`: calls `apply_mapping()` again, splits valid/error rows, deduplicates, dispatches to entity-specific `_commit_*` function, calls `db.commit()`, deletes session. Returns `CommitResult(created_count, updated_count, skipped_count, error_rows)`.
- `import_supervisor.py` — Second-pass supervisor resolution with cycle detection. Called inside `_commit_members()`.

### `ENTITY_CONFIGS` in `import_mapper.py` (line 41)

| entity_type | target_fields | required_fields | dedup_field | numeric_fields |
|---|---|---|---|---|
| `member` | employee_id, first/last_name, hire_date, title, city, state, email, phone, slack_handle, salary, bonus, pto_used, functional_area_name, team_name, program_name, supervisor_employee_id, program_role | employee_id, first_name, last_name | employee_id | salary, bonus, pto_used |
| `program` | name, description, agency_name | name | name | — |
| `area` | name, description | name | name | — |
| `team` | name, functional_area_name, description | name | name | — |
| `agency` | name, description | name | name | — |

### Commit flow for members (`_commit_members`, line 237)
1. For each row: resolve functional_area (get-or-create), team (get-or-create), program (get-or-create)
2. Lookup `TeamMember` by `employee_id` (upsert key)
3. If new: create with employee_id, first_name, last_name, functional_area_id
4. Patch scalar fields (first_name, last_name, title, city, state, email, phone, slack_handle, hire_date, functional_area_id, team_id)
5. For each of `salary`, `bonus`, `pto_used`: call `_append_history_if_changed()` then set scalar on member
6. Upsert program assignment if program present
7. Second pass: resolve supervisor FKs with cycle detection

### Commit flow for non-member entities
All are simple upsert-by-name with optional FK resolution. Programs do a lookup-only (no create) for `agency_name`. Teams auto-create an "Unassigned" area if none given.

---

## Financial / Salary / Bonus History Models

### `member_history` table — `backend/app/models/member_history.py`
- PK: `id` (int, autoincrement)
- `member_uuid` — FK → `team_members.uuid`, indexed
- `field` — String(20): one of `"salary"`, `"bonus"`, `"pto_used"`
- `value` — Numeric(12,2)
- `effective_date` — Date
- `notes` — Text, nullable
- `created_at` — DateTime with timezone

This is a **single unified history table** for all three financial fields, distinguished by the `field` column (EAV-lite pattern). There are no separate `SalaryHistory` or `BonusHistory` tables.

### Scalar fields on `team_members`
`salary`, `bonus`, and `pto_used` also exist as `Numeric(12,2)` columns on `team_members` itself (the "current" value snapshot).

### History service — `backend/app/services/history_service.py`
- `create_history_entry(db, member_uuid, field, value, effective_date, notes)` — direct insert
- `get_member_history(db, member_uuid, field=None)` — returns history ordered by effective_date desc, created_at desc

### History API route — `backend/app/api/routes/history.py`
`GET /` with query params `member_uuid` (required) and `field` (optional `HistoryFieldEnum`). Returns `list[MemberHistoryResponse]`.

### Schema — `backend/app/schemas/member_history.py`
- `HistoryFieldEnum`: `salary`, `bonus`, `pto_used`
- `MemberHistoryResponse`: id, member_uuid, field, value, effective_date, notes, created_at

History is populated automatically on import whenever a financial field changes or member is new (`_append_history_if_changed`, line 87 of `import_commit.py`).

---

## employee_id as dedup/lookup key

- Constraint: `UNIQUE` index on `team_members.employee_id` (String(50), NOT NULL). Created in initial migration `452ccece7038`.
- Import uses it as the upsert key: `select(TeamMember).where(TeamMember.employee_id == emp_id)`
- Within a single import batch, in-file duplicates on `employee_id` get a warning at preview stage (first occurrence wins, rest skipped)
- `employee_id_to_uuid` dict built during commit for supervisor second-pass resolution

---

## Frontend Import Components

All live in `frontend/src/components/import/`.

| File | Role |
|---|---|
| `ImportWizard.tsx` | Shell with 4-step state machine: `source → map → preview → result`. Accepts `entityType` prop (default `'member'`). Renders `StepIndicator`. |
| `SourceStep.tsx` | Tab UI: file drag-drop/browse OR Google Sheets URL. Calls `uploadFile()` / `fetchGoogleSheet()`. No entity knowledge. |
| `MapColumnsStep.tsx` | Table of source headers → target field selects. Auto-suggests by label/value fuzzy match. Required-field gate before Preview button. Exports all `*_TARGET_FIELDS` arrays. |
| `PreviewStep.tsx` | Paginated table (20 rows/page, max 50 from API). Green/red status per row. Tooltip errors. Commit button disabled if 0 importable rows. Invalidates relevant query keys on success. |
| `ResultStep.tsx` | Summary cards (created/updated/skipped). Accordion for error rows with row#, errors, data. "Import Again" resets to start; "Go to Members" link. |

### Entity type selection
`ImportWizard` receives `entityType` as a prop — callers decide. No entity selector inside the wizard itself. Usage:
- `/import` route (`ImportPage.tsx`) — always `entityType="member"` (default)
- AgenciesPage, TeamsPage, FunctionalAreasPage, ProgramsPage — each open a dialog/sheet with the wizard pre-configured for their entity type

### Frontend types — `frontend/src/api/importApi.ts`
`EntityType = 'member' | 'program' | 'area' | 'team' | 'agency'`
`MappingConfig.entity_type` is optional (defaults to `'member'` on backend).

### `PROGRAM_TARGET_FIELDS` in `MapColumnsStep.tsx` (line 34) is missing `agency_name`
The backend `ENTITY_CONFIGS["program"].target_fields` includes `agency_name` but `PROGRAM_TARGET_FIELDS` on the frontend only has `name` and `description`. This is a gap — users cannot map the agency column for programs via the wizard.

---

## Migrations (no history-specific migration)
`member_history` table was created in the **initial schema migration** (`452ccece7038_initial_schema.py`). No separate salary/bonus history migration exists; it was designed in from day one.
