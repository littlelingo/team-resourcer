---
feature: 001-team-resourcer-app
phase: 4 - Data Import
status: COMPLETE
testing: implement-then-test
complexity: MEDIUM
depends_on: PRP-phase3
---

# PRP: Phase 4 — Data Import (File Upload + Google Sheets)

## Overview

Phase 4 adds bulk data ingestion to team-resourcer via two paths: direct file upload (CSV / Excel) and Google Sheets pull. Both paths share a common four-step wizard — upload/connect, column mapping, preview & validate, commit — backed by a unified import service layer. The import surface is additive: no existing Phase 1–3 code is removed; only new routers, services, and frontend pages are created.

---

## Steps

### Step 1 — Backend: Python dependencies

Add to `backend/requirements.txt`:

```
pandas>=2.2
openpyxl>=3.1          # pandas Excel engine
google-api-python-client>=2.120
google-auth>=2.29
google-auth-httplib2>=0.2
```

No migration is needed; the import pipeline is stateless between the upload/preview calls. The only DB writes happen at commit time using the existing ORM models from Phase 1.

Verify: `pip install -r backend/requirements.txt` completes without conflict inside the Docker build context.

---

### Step 2 — Backend: import router skeleton

Create `backend/app/routers/import_router.py`.

Define four route handlers (bodies filled in subsequent steps):

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/import/upload` | Accept multipart file, return headers + preview rows |
| `POST` | `/api/import/google-sheets` | Accept sheet URL/ID, return headers + preview rows |
| `POST` | `/api/import/preview` | Accept mapping config + raw rows, return validated preview |
| `POST` | `/api/import/commit` | Accept validated rows, write to DB, return summary |

Register the router in `backend/app/main.py`:

```python
from app.routers.import_router import router as import_router
app.include_router(import_router, prefix="/api/import", tags=["import"])
```

Verify: `GET /openapi.json` lists all four `/api/import/*` paths.

---

### Step 3 — Backend: file parsing service

Create `backend/app/services/import_parser.py`.

#### Responsibilities

- `parse_upload(file_bytes: bytes, filename: str) -> ParseResult`
  - Detect format by file extension (`.csv` → `csv.DictReader`; `.xlsx` → `pandas.read_excel` with `openpyxl` engine).
  - Return `ParseResult(headers: list[str], preview_rows: list[dict], total_row_count: int, raw_rows: list[dict])`.
  - `preview_rows` = first 10 rows of `raw_rows`.
  - Raise `ImportParseError` (custom exception, subclass of `ValueError`) with a human-readable message for unsupported extensions or malformed files.

#### ParseResult schema (Pydantic, defined in `backend/app/schemas/import_schemas.py`)

```
ParseResult
  headers: list[str]
  preview_rows: list[dict[str, Any]]   # first 10
  total_row_count: int
  raw_rows: list[dict[str, Any]]       # all rows, held server-side via session token
```

Because raw rows can be large, do not return them to the client. Store them temporarily (see Step 5: session cache).

Verify: unit tests in `backend/tests/test_import_parser.py` confirm CSV and Excel files parse correctly, unsupported extensions raise `ImportParseError`, and empty files return zero rows without crashing.

---

### Step 4 — Backend: Google Sheets fetch service

Create `backend/app/services/import_sheets.py`.

#### Responsibilities

- `fetch_sheet(sheet_url_or_id: str) -> ParseResult`
  - Extract sheet ID from URL using regex: `r'/spreadsheets/d/([a-zA-Z0-9_-]+)'`; if no match, treat the input as a bare ID.
  - Authenticate with `google.oauth2.service_account.Credentials.from_service_account_file()` using path from env var `GOOGLE_SERVICE_ACCOUNT_FILE`, or from JSON content in env var `GOOGLE_SERVICE_ACCOUNT_JSON` (base64-encoded).
  - Call Sheets API v4 `spreadsheets.values.get` for range `A1:ZZ` (or the sheet's used range via `spreadsheets.get` metadata first).
  - First row = headers; remaining rows = data rows. Return same `ParseResult` shape as `parse_upload`.
  - Raise `ImportSheetsError` (custom exception) for auth failures, missing credentials, or sheet-not-found (HTTP 404 from Sheets API).

#### Environment variables (document in `docker-compose.yml` under `backend` service)

```yaml
GOOGLE_SERVICE_ACCOUNT_FILE: /run/secrets/gcp-service-account   # path to mounted file
GOOGLE_SERVICE_ACCOUNT_JSON: ""                                  # base64 JSON alternative
```

Verify: unit test in `backend/tests/test_import_sheets.py` mocks the Sheets API client and asserts correct header/row extraction. Auth failure raises `ImportSheetsError`.

---

### Step 5 — Backend: import session cache

Create `backend/app/services/import_session.py`.

The four-step flow requires raw rows to survive across HTTP calls (upload → preview → commit) without the client re-sending potentially large payloads. Use an in-process dict keyed by a UUID session token. This is acceptable because the app is single-user with no horizontal scaling requirement.

```
ImportSession
  session_id: str           # UUID4
  raw_rows: list[dict]      # all rows from parse step
  headers: list[str]
  created_at: datetime      # for TTL cleanup
```

Functions:
- `create_session(raw_rows, headers) -> str` — store and return `session_id`
- `get_session(session_id: str) -> ImportSession` — raise `SessionNotFoundError` if missing or expired
- `delete_session(session_id: str) -> None`
- Sessions expire after 30 minutes. A background cleanup task (FastAPI `lifespan` or `asyncio` periodic coroutine) removes stale sessions every 5 minutes.

The `session_id` is returned to the client after the upload/fetch step and passed back in subsequent calls.

Verify: `test_import_session.py` asserts session create/get/delete lifecycle and that expired sessions raise `SessionNotFoundError`.

---

### Step 6 — Backend: column mapping and validation service

Create `backend/app/services/import_mapper.py`.

#### Target field registry

Define the canonical set of importable fields in `backend/app/services/import_mapper.py`:

```python
TARGET_FIELDS = {
    # TeamMember scalar fields
    "employee_id", "name", "title", "location", "email",
    "phone", "slack_handle", "salary", "bonus", "pto_used",
    # FK-via-name fields (resolved to IDs at commit time)
    "functional_area_name", "team_name", "program_name",
    "supervisor_employee_id",
    # Optional: program assignment role
    "program_role",
}

REQUIRED_FIELDS = {"employee_id", "name"}   # minimum for a valid import row
```

#### `MappingConfig` schema (`backend/app/schemas/import_schemas.py`)

```
MappingConfig
  session_id: str
  column_map: dict[str, str | None]   # source header → target field or null (skip)
```

#### `apply_mapping(session_id, mapping_config) -> MappedPreviewResult`

- Load raw rows from session.
- For each row, apply `column_map` to produce a dict keyed by target field names.
- Run validation per row (see below).
- Return `MappedPreviewResult(rows: list[MappedRow], error_count: int, warning_count: int)`.

#### `MappedRow` schema

```
MappedRow
  index: int                        # 1-based row number from source file
  data: dict[str, Any]              # mapped field values
  errors: list[str]                 # blocking — row will not be imported
  warnings: list[str]               # non-blocking — row imported with caveat
```

#### Validation rules

| Rule | Severity |
|------|----------|
| `employee_id` missing or blank | error |
| `name` missing or blank | error |
| `email` present but not valid format (`\S+@\S+\.\S+`) | error |
| `salary`, `bonus`, `pto_used` present but not numeric | error |
| `employee_id` duplicated within the import batch | warning (first occurrence wins) |
| Unknown target field name in `column_map` values | error raised at mapping config validation time, not per-row |

Verify: `test_import_mapper.py` covers all validation rules including duplicate `employee_id` within batch and invalid email.

---

### Step 7 — Backend: commit service

Create `backend/app/services/import_commit.py`.

#### `commit_import(session_id, column_map, db_session) -> CommitResult`

Internally calls `apply_mapping` first. Rows with errors are skipped; rows with only warnings are imported.

For each valid row:

1. **Resolve FK-via-name fields** — look up or create `FunctionalArea`, `Team`, `Program` by name using `get_or_create` helpers. These are committed atomically with the member row in the same transaction. `Team.functional_area_id` is set only if `functional_area_name` is also present in the row.

2. **Upsert TeamMember** — match on `employee_id`:
   - If not found: `INSERT` new member.
   - If found: `UPDATE` all provided scalar fields (only fields present in `column_map` and non-null are updated — do not overwrite existing data with blank).

3. **History records** — if `salary`, `bonus`, or `pto_used` differ from the existing member's stored value (or if this is a new member), append a `MemberHistory` record with `effective_date = today` and `notes = "Imported"`.

4. **ProgramAssignment** — upsert join row for `(member_uuid, program_id)`. If `program_role` is in the map, set it. Do not duplicate if assignment already exists.

5. **Supervisor resolution** — `supervisor_employee_id` is resolved after all members are upserted in the batch (two-pass: first pass upserts all members, second pass sets `supervisor_id` FKs).

#### `CommitResult` schema

```
CommitResult
  created_count: int
  updated_count: int
  skipped_count: int      # rows with errors
  error_rows: list[MappedRow]   # the skipped rows with their errors
```

After commit, delete the session via `import_session.delete_session`.

Verify: integration tests in `backend/tests/test_import_commit.py` against a real test database (consistent with project's implement-then-test strategy). Cover: new member creation, update of existing member, salary history append, program creation, supervisor two-pass resolution, rows-with-errors are skipped.

---

### Step 8 — Backend: wire up route handlers

Fill in the four handlers in `backend/app/routers/import_router.py`:

**`POST /api/import/upload`**
- Accept `UploadFile` (FastAPI multipart).
- Call `import_parser.parse_upload(await file.read(), file.filename)`.
- Store rows in `import_session.create_session(...)`.
- Return `UploadResponse(session_id, headers, preview_rows, total_row_count)`.
- On `ImportParseError`: return HTTP 422 with `{"detail": str(e)}`.

**`POST /api/import/google-sheets`**
- Accept body `{"sheet_url_or_id": str}`.
- Call `import_sheets.fetch_sheet(...)`.
- Same session creation and response shape as upload.
- On `ImportSheetsError`: return HTTP 422 with `{"detail": str(e)}`.

**`POST /api/import/preview`**
- Accept body `MappingConfig`.
- Call `import_mapper.apply_mapping(...)`.
- Return `MappedPreviewResult` (first 50 rows maximum in the response to keep payload small; full error count still reported).
- On `SessionNotFoundError`: return HTTP 404.

**`POST /api/import/commit`**
- Accept body `MappingConfig`.
- Call `import_commit.commit_import(session_id, column_map, db)` with injected DB session.
- Return `CommitResult`.
- On `SessionNotFoundError`: return HTTP 404.

Verify: manual test via `curl` or Bruno hitting all four endpoints in sequence with a sample CSV.

---

### Step 9 — Frontend: ImportWizard page

Create `frontend/src/pages/ImportPage.tsx`.

Register the route in the existing router (path `/import`). Add an "Import" link to the top-level nav.

The page renders `<ImportWizard />` (see Step 10) full-width inside the existing layout shell.

Verify: navigating to `/import` renders without console errors; nav link is visible on all existing pages.

---

### Step 10 — Frontend: wizard component

Create `frontend/src/components/import/ImportWizard.tsx`.

The wizard manages a local state machine with four steps. Use a top-level step indicator component (shadcn/ui `Steps` pattern or a simple custom indicator using `Progress`).

```
type WizardStep = "source" | "map" | "preview" | "result"

interface WizardState {
  step: WizardStep
  sessionId: string | null
  headers: string[]
  previewRows: Record<string, unknown>[]
  totalRowCount: number
  columnMap: Record<string, string | null>
  mappedPreview: MappedPreviewResult | null
  commitResult: CommitResult | null
}
```

Step transitions:
- `source` → `map`: on successful upload or Sheets fetch (session returned)
- `map` → `preview`: on "Preview" button click, calls `/api/import/preview`
- `preview` → `result`: on "Import" button click, calls `/api/import/commit`
- Any step → `source`: "Start Over" resets state, no API call needed (session will expire)

Verify: state machine transitions are exercised manually; back/start-over navigation doesn't break subsequent imports.

---

### Step 11 — Frontend: step 1 — SourceStep

Create `frontend/src/components/import/SourceStep.tsx`.

Two tabs (shadcn/ui `Tabs`):

**File Upload tab**
- shadcn/ui `<Input type="file" accept=".csv,.xlsx" />` inside a drag-drop zone (use `onDragOver`/`onDrop` native events; no extra library needed).
- On file selected: call `POST /api/import/upload` via TanStack Query `useMutation`. Show upload progress via `XMLHttpRequest` or Fetch `ReadableStream` (display a determinate `Progress` bar if file > 100 KB, indeterminate spinner otherwise).
- On success: call `onSuccess(sessionId, headers, previewRows, totalRowCount)` prop to advance wizard.
- On error: display error message from `detail` field inline below the dropzone.

**Google Sheets tab**
- Text input for sheet URL or sheet ID.
- "Fetch Sheet" button: call `POST /api/import/google-sheets` via `useMutation`.
- Same success/error handling as file upload.
- Show a helper note: "Paste the full Google Sheets URL or just the sheet ID."

Verify: uploading a test CSV advances to the map step; uploading an unsupported file type shows the backend error inline.

---

### Step 12 — Frontend: step 2 — MapColumnsStep

Create `frontend/src/components/import/MapColumnsStep.tsx`.

Receives `headers: string[]` as prop. For each header, renders one row:

```
[Source column name]    →    [Dropdown: target field or "Skip"]
```

Target field dropdown options (human-readable labels mapping to `TARGET_FIELDS` values):

| Label | Value |
|-------|-------|
| Skip this column | `null` |
| Employee ID | `employee_id` |
| Full Name | `name` |
| Job Title | `title` |
| Location | `location` |
| Email | `email` |
| Phone | `phone` |
| Slack Handle | `slack_handle` |
| Salary | `salary` |
| Bonus | `bonus` |
| PTO Used | `pto_used` |
| Functional Area | `functional_area_name` |
| Team | `team_name` |
| Program | `program_name` |
| Program Role | `program_role` |
| Supervisor Employee ID | `supervisor_employee_id` |

Auto-suggest: on mount, compare each header (case-insensitive, strip whitespace) against the label set and pre-select the closest match. Use simple string equality first; fall back to `includes` match.

"Preview" button disabled until at least `employee_id` and `name` are mapped. Show an inline message: "Map at least Employee ID and Name to continue."

Verify: auto-suggest correctly maps obvious headers ("Employee ID", "Email", "Name") on mount. The "Preview" button is disabled when required fields are not mapped.

---

### Step 13 — Frontend: step 3 — PreviewStep

Create `frontend/src/components/import/PreviewStep.tsx`.

Receives `MappedPreviewResult` as prop.

- Summary bar: "X rows ready, Y rows have errors" using shadcn/ui `Alert` variants.
- Table (shadcn/ui `Table`) with one row per mapped row. Columns = all target fields that appear in at least one row.
- Cell rendering:
  - Green background (`bg-green-50`) if the cell is valid.
  - Red background (`bg-red-50`) if the cell has an error; show error text in a tooltip on hover.
- Rows with errors: dim the row (opacity-50) and show a red icon in a status column.
- Pagination: show 20 rows per page if total > 20.
- "Import X rows" button (disabled if all rows have errors). Button label shows count of importable rows.
- "Back to Mapping" link to return to step 2 without losing the current `columnMap`.

Verify: a CSV with known validation errors (missing name, invalid email) shows red cells for the affected rows.

---

### Step 14 — Frontend: step 4 — ResultStep

Create `frontend/src/components/import/ResultStep.tsx`.

Receives `CommitResult` as prop.

Display a summary card:
- "X members created" (shadcn/ui `Badge` variant success)
- "Y members updated" (Badge variant secondary)
- "Z rows skipped due to errors" (Badge variant destructive, shown only if > 0)

If `error_rows` is non-empty, show a collapsed `Accordion` item "View skipped rows" that renders a small table of the skipped rows and their errors.

"Import Again" button resets the wizard to step 1.
"Go to Members" link navigates to `/members`.

Verify: after a successful commit, the members list at `/members` reflects the imported data.

---

### Step 15 — Frontend: API client types

Create `frontend/src/api/importApi.ts`.

Define TypeScript types mirroring backend schemas:

```ts
interface UploadResponse {
  session_id: string
  headers: string[]
  preview_rows: Record<string, unknown>[]
  total_row_count: number
}

interface MappingConfig {
  session_id: string
  column_map: Record<string, string | null>
}

interface MappedRow {
  index: number
  data: Record<string, unknown>
  errors: string[]
  warnings: string[]
}

interface MappedPreviewResult {
  rows: MappedRow[]
  error_count: number
  warning_count: number
}

interface CommitResult {
  created_count: number
  updated_count: number
  skipped_count: number
  error_rows: MappedRow[]
}
```

Export four async functions wrapping `fetch`:
- `uploadFile(file: File): Promise<UploadResponse>`
- `fetchGoogleSheet(sheetUrlOrId: string): Promise<UploadResponse>`
- `previewMapping(config: MappingConfig): Promise<MappedPreviewResult>`
- `commitImport(config: MappingConfig): Promise<CommitResult>`

All functions throw with the `detail` string from the backend on non-2xx responses.

Verify: TypeScript compilation passes with `tsc --noEmit`.

---

### Step 16 — Docker Compose: Google credentials secret

In `docker-compose.yml`, under the `backend` service, add:

```yaml
volumes:
  - ${GOOGLE_SERVICE_ACCOUNT_FILE:-/dev/null}:/run/secrets/gcp-service-account:ro
environment:
  GOOGLE_SERVICE_ACCOUNT_FILE: /run/secrets/gcp-service-account
  GOOGLE_SERVICE_ACCOUNT_JSON: ${GOOGLE_SERVICE_ACCOUNT_JSON:-}
```

Add a comment block above these lines:

```yaml
# Google Sheets import (optional).
# Set GOOGLE_SERVICE_ACCOUNT_FILE to the path of your service account JSON file
# OR set GOOGLE_SERVICE_ACCOUNT_JSON to the base64-encoded JSON content.
# If neither is set, Google Sheets import will return a 422 error with instructions.
```

`import_sheets.fetch_sheet` must detect missing credentials and raise `ImportSheetsError("Google credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_JSON.")` rather than crashing with a Python exception.

Verify: with no credentials configured, hitting `POST /api/import/google-sheets` returns HTTP 422 with the instructional message.

---

### Step 17 — Tests

Path: `backend/tests/` (implement-then-test).

| Test file | Coverage |
|-----------|----------|
| `test_import_parser.py` | CSV parse, Excel parse, unsupported extension, empty file |
| `test_import_sheets.py` | Mocked Sheets API: correct header/row extraction, missing credentials error, invalid sheet ID error |
| `test_import_session.py` | Create/get/delete lifecycle, expired session raises error |
| `test_import_mapper.py` | All validation rules, duplicate employee_id warning, unknown target field error, auto-mapping logic |
| `test_import_commit.py` | New member created, existing member updated, salary history appended, program created, supervisor two-pass, error rows skipped, session deleted after commit |
| `test_import_router.py` | HTTP-level: 422 on bad file, 404 on missing session, full happy-path sequence |

Run command: `pytest backend/tests/ -v`

---

## File Manifest

### Backend — new files

| Path | Action | Description |
|------|--------|-------------|
| `backend/app/routers/import_router.py` | CREATE | Four import route handlers |
| `backend/app/schemas/import_schemas.py` | CREATE | Pydantic schemas: ParseResult, MappingConfig, MappedRow, MappedPreviewResult, CommitResult, UploadResponse |
| `backend/app/services/import_parser.py` | CREATE | CSV + Excel file parsing; raises ImportParseError |
| `backend/app/services/import_sheets.py` | CREATE | Google Sheets API fetch; raises ImportSheetsError |
| `backend/app/services/import_session.py` | CREATE | In-process session cache with TTL cleanup |
| `backend/app/services/import_mapper.py` | CREATE | Column mapping application, TARGET_FIELDS registry, per-row validation |
| `backend/app/services/import_commit.py` | CREATE | Bulk upsert, FK resolution, history records, two-pass supervisor |
| `backend/tests/test_import_parser.py` | CREATE | Parser unit tests |
| `backend/tests/test_import_sheets.py` | CREATE | Sheets fetch unit tests (mocked API) |
| `backend/tests/test_import_session.py` | CREATE | Session cache unit tests |
| `backend/tests/test_import_mapper.py` | CREATE | Mapper + validation unit tests |
| `backend/tests/test_import_commit.py` | CREATE | Commit integration tests (real test DB) |
| `backend/tests/test_import_router.py` | CREATE | Router HTTP-level tests |

### Backend — modified files

| Path | Action | Description |
|------|--------|-------------|
| `backend/requirements.txt` | MODIFY | Add pandas, openpyxl, google-api-python-client, google-auth, google-auth-httplib2 |
| `backend/app/main.py` | MODIFY | Register import_router with prefix `/api/import` |

### Frontend — new files

| Path | Action | Description |
|------|--------|-------------|
| `frontend/src/pages/ImportPage.tsx` | CREATE | Page wrapper; registers at route `/import` |
| `frontend/src/components/import/ImportWizard.tsx` | CREATE | Step state machine and step indicator |
| `frontend/src/components/import/SourceStep.tsx` | CREATE | File upload + Google Sheets tab UI |
| `frontend/src/components/import/MapColumnsStep.tsx` | CREATE | Column mapping dropdowns with auto-suggest |
| `frontend/src/components/import/PreviewStep.tsx` | CREATE | Validation table with color-coded cells |
| `frontend/src/components/import/ResultStep.tsx` | CREATE | Import summary + skipped rows accordion |
| `frontend/src/api/importApi.ts` | CREATE | TypeScript API client + types for all four endpoints |

### Frontend — modified files

| Path | Action | Description |
|------|--------|-------------|
| `frontend/src/router.tsx` (or equivalent router config) | MODIFY | Add `/import` route pointing to `ImportPage` |
| `frontend/src/components/layout/Nav.tsx` (or equivalent) | MODIFY | Add "Import" nav link |

### Infrastructure — modified files

| Path | Action | Description |
|------|--------|-------------|
| `docker-compose.yml` | MODIFY | Add Google credentials volume mount + env vars with inline setup comment |

---

## Validation Criteria

- [ ] `pytest backend/tests/ -v` — all tests pass with no failures
- [ ] `tsc --noEmit` in `frontend/` — no TypeScript errors
- [ ] `GET /openapi.json` lists all four `/api/import/*` routes with correct request/response schemas
- [ ] Manual: upload a CSV with 20 rows → map columns → preview shows all rows → commit → member count in `/members` increases by expected number
- [ ] Manual: upload a CSV with rows missing `employee_id` → preview shows those rows in red → commit skips them → `skipped_count` in result matches
- [ ] Manual: re-import the same CSV → `updated_count` matches previously created members, `created_count` is 0
- [ ] Manual: salary value differs on re-import → `MemberHistory` record appended with `effective_date = today`
- [ ] Manual: Google Sheets import with no credentials configured returns HTTP 422 with setup instructions (not a 500)
- [ ] Manual: "Import" nav link is visible and navigates to `/import` from all existing pages
- [ ] Docker Compose `docker compose up --build` completes without error after requirements change

---

## Testing Plan

Strategy: **implement-then-test** (per project default in `CLAUDE.md`).

Write all service and router code first, then add tests once the implementation compiles and does a basic manual happy-path. Tests should be added in this order to build coverage bottom-up:

1. `test_import_parser.py` — no DB dependency, fast feedback on file parsing
2. `test_import_session.py` — no DB dependency
3. `test_import_mapper.py` — no DB dependency, covers the most business logic
4. `test_import_sheets.py` — mock the Sheets API client entirely; no real credentials needed
5. `test_import_commit.py` — requires test DB; use the same fixture pattern as Phase 1 integration tests
6. `test_import_router.py` — end-to-end HTTP tests using FastAPI `TestClient`; requires test DB

Test data fixtures to create:
- `backend/tests/fixtures/sample_valid.csv` — 5 rows, all fields, no errors
- `backend/tests/fixtures/sample_errors.csv` — 3 rows: one valid, one missing name, one invalid email
- `backend/tests/fixtures/sample_valid.xlsx` — same structure as `sample_valid.csv` but Excel format

---

## Risks

| Risk | Mitigation |
|------|------------|
| Google service account setup is unfamiliar to operator | Detect missing credentials early and return a descriptive 422 with exact env var names; add inline `docker-compose.yml` comment; document steps in a `docs/google-sheets-setup.md` file |
| Large Excel files cause memory pressure | pandas `read_excel` loads entire file into memory; accept this for now (single-user app); document a row limit warning in the UI if `total_row_count > 5000` |
| Session cache lost on backend restart mid-wizard | Single-user app; restart during a 4-step wizard is rare. Session TTL makes this self-healing. Document as a known limitation. |
| Supervisor two-pass resolution fails for circular references | Detect and skip circular supervisor chains (A → B → A) during commit; add to error rows with message "Circular supervisor reference detected" |
| Column auto-suggest mismatches on unusual header names | Auto-suggest is advisory; user can always override. Make dropdowns clearly editable. |
| `openpyxl` vs `xlrd` engine confusion for `.xls` (old Excel) | Only support `.xlsx` (openpyxl). Return `ImportParseError` for `.xls` with message: "Old Excel format (.xls) is not supported. Please save as .xlsx." |
