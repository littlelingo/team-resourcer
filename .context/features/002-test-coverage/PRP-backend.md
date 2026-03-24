---
feature: 002-test-coverage
phase: backend
status: DRAFT
testing: test-first (we ARE writing tests)
complexity: HIGH
---

# PRP: Backend Test Coverage

## 1. Overview

The pytest stack (`pytest==8.3.4`, `pytest-asyncio==0.24.0`, `httpx==0.28.1`) is fully installed and `asyncio_mode = "auto"` is already set in `pyproject.toml`, but `backend/tests/` does not exist at all. This PRP creates the full test suite: infrastructure, CSV/XLSX fixture files, pure-Python unit tests for the import pipeline, and integration tests for every API route and service with domain complexity (cycle detection, two-pass upsert, tree builds, history auto-capture).

## 2. Requirements

### Must Have
- [ ] `aiosqlite` added to `backend/requirements.txt`
- [ ] `backend/tests/conftest.py` with async SQLite engine, per-test session fixture, FastAPI `AsyncClient` with `get_db` overridden, and entity-creation helper fixtures
- [ ] Fixture CSV/XLSX files covering valid, invalid, duplicate, and empty data
- [ ] Unit tests for `import_parser`, `import_session`, `import_mapper` (zero DB dependency)
- [ ] Integration tests for all 7 router groups and `tree_service`, `import_commit`
- [ ] All tests pass under `docker compose exec backend pytest -v`
- [ ] Service layer coverage >= 80%

### Nice to Have
- [ ] `pytest-cov` coverage report configured

### Out of Scope
- Frontend tests (separate PRP)
- `import_sheets.py` (requires live Google API credential mocking — deferred)
- Load/performance testing

---

## 3. Technical Approach

**Architecture Impact**: Test-only additions. No production code changes. `get_db` is overridden via `app.dependency_overrides` — the production engine never initialises during tests.

**Key Decisions**:
- Use `aiosqlite` in-memory SQLite over a test Postgres instance: zero infrastructure, fastest feedback loop, no `docker-compose.test.yml` needed.
- SQLite does not support `UUID` dialect type as used by `asyncpg`/Postgres. The `TeamMember.uuid` column uses `UUID(as_uuid=True)` from `sqlalchemy.dialects.postgresql`. Override the column type at the engine level using `create_async_engine("sqlite+aiosqlite:///:memory:", ...)` with the `connect_args={"check_same_thread": False}` kwarg, and use `sqlalchemy.event.listen` to emit `PRAGMA foreign_keys=ON`. SQLAlchemy's DDL for SQLite will render `UUID` as `VARCHAR(36)` automatically when targeting a non-Postgres dialect.
- The `_sessions` dict in `import_session.py` is module-level global state. Tests that manipulate sessions must call `delete_session()` in teardown (or manipulate `_sessions` directly via `import app.services.import_session as sess_mod; sess_mod._sessions.clear()`).
- `asyncio_mode = "auto"` in `pyproject.toml` means all `async def test_*` functions are awaited without any `@pytest.mark.asyncio` decorator. Do NOT add the decorator — it causes a warning with this setting.
- `httpx.AsyncClient` with `app=app, base_url="http://test"` is the correct pattern for FastAPI + asyncio tests. Do NOT use `TestClient` (synchronous) — all routes are async.

**File Manifest**:

| File | Action | Description |
|------|--------|-------------|
| `backend/requirements.txt` | MODIFY | Add `aiosqlite>=0.20` |
| `backend/tests/__init__.py` | CREATE | Empty marker file |
| `backend/tests/conftest.py` | CREATE | Engine, session, client, entity helper fixtures |
| `backend/tests/fixtures/valid_members.csv` | CREATE | 5 rows, all TARGET_FIELDS columns |
| `backend/tests/fixtures/invalid_members.csv` | CREATE | Missing name, bad email, non-numeric salary |
| `backend/tests/fixtures/duplicate_ids.csv` | CREATE | Two rows with identical `employee_id` |
| `backend/tests/fixtures/valid_members.xlsx` | CREATE | Same data as `valid_members.csv`, Excel format |
| `backend/tests/unit/__init__.py` | CREATE | Empty marker |
| `backend/tests/unit/test_import_parser.py` | CREATE | Unit tests for `parse_upload()` |
| `backend/tests/unit/test_import_session.py` | CREATE | Unit tests for session lifecycle |
| `backend/tests/unit/test_import_mapper.py` | CREATE | Unit tests for `apply_mapping()` validation rules |
| `backend/tests/integration/__init__.py` | CREATE | Empty marker |
| `backend/tests/integration/test_members_routes.py` | CREATE | Full members CRUD + image upload + history |
| `backend/tests/integration/test_areas_routes.py` | CREATE | Areas CRUD |
| `backend/tests/integration/test_teams_routes.py` | CREATE | Teams CRUD + area ownership enforcement |
| `backend/tests/integration/test_programs_routes.py` | CREATE | Programs CRUD + assign/unassign + tree |
| `backend/tests/integration/test_org_routes.py` | CREATE | Org tree, set_supervisor, cycle → 400 |
| `backend/tests/integration/test_history_routes.py` | CREATE | History retrieval + field filter |
| `backend/tests/integration/test_tree_service.py` | CREATE | Direct service calls: org/program/area trees |
| `backend/tests/integration/test_import_routes.py` | CREATE | Full 4-step wizard via HTTP |
| `backend/tests/integration/test_import_commit.py` | CREATE | upsert, get_or_create, supervisor two-pass, cycle skip |

---

## 4. Implementation Steps

### Step 1 — Add `aiosqlite` to requirements

**File**: `backend/requirements.txt`

Append `aiosqlite>=0.20` after the existing `asyncpg` line. No other changes.

**Verify**: `docker compose exec backend pip show aiosqlite` exits 0.

---

### Step 2 — Create test package markers

**Files**:
- `backend/tests/__init__.py` — empty
- `backend/tests/unit/__init__.py` — empty
- `backend/tests/integration/__init__.py` — empty

---

### Step 3 — Create `backend/tests/conftest.py`

This is the most important file. Get it right before writing a single test.

```
Imports needed:
  import pytest
  from httpx import AsyncClient, ASGITransport
  from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
  from sqlalchemy import event
  from app.main import app
  from app.core.database import Base, get_db
  from app.models.functional_area import FunctionalArea
  from app.models.team import Team
  from app.models.team_member import TeamMember
  from app.models.program import Program
```

**Engine fixture** — module-scoped so tables are created once per session:

```
Fixture name: engine
Scope: session (pytest fixture scope)
Body:
  engine = create_async_engine(
      "sqlite+aiosqlite:///:memory:",
      connect_args={"check_same_thread": False},
  )
  # Enable FK enforcement in SQLite
  @event.listens_for(engine.sync_engine, "connect")
  def set_sqlite_pragma(conn, _):
      conn.execute("PRAGMA foreign_keys=ON")

  async with engine.begin() as conn:
      await conn.run_sync(Base.metadata.create_all)
  yield engine
  async with engine.begin() as conn:
      await conn.run_sync(Base.metadata.drop_all)
  await engine.dispose()
```

**Session fixture** — function-scoped, rolls back after each test:

```
Fixture name: db_session
Scope: function
Depends on: engine
Body:
  AsyncTestSession = async_sessionmaker(engine, expire_on_commit=False)
  async with AsyncTestSession() as session:
      async with session.begin():
          yield session
          await session.rollback()
```

**Client fixture** — function-scoped, overrides `get_db`:

```
Fixture name: client
Scope: function
Depends on: db_session
Body:
  async def override_get_db():
      yield db_session

  app.dependency_overrides[get_db] = override_get_db
  async with AsyncClient(
      transport=ASGITransport(app=app), base_url="http://test"
  ) as ac:
      yield ac
  app.dependency_overrides.clear()
```

**Entity helper fixtures** — function-scoped, use `db_session` directly:

```
Fixture: area(db_session) -> FunctionalArea
  Creates FunctionalArea(name="Engineering"), db.add, await db.flush(), returns it.
  Do NOT commit — the transaction is owned by db_session.

Fixture: team(db_session, area) -> Team
  Creates Team(name="Backend", functional_area_id=area.id), flush, returns it.

Fixture: member(db_session, area) -> TeamMember
  Creates TeamMember(
      employee_id="EMP001",
      name="Alice Smith",
      functional_area_id=area.id,
  ), flush, returns it.

Fixture: program(db_session) -> Program
  Creates Program(name="Alpha"), flush, returns it.
```

**Important**: All helper fixtures call `await db_session.flush()` (not `commit()`) so they remain inside the test transaction that will be rolled back.

**Verify**: Run `docker compose exec backend pytest backend/tests/conftest.py --collect-only` — should show no errors and discover fixtures.

---

### Step 4 — Create CSV/XLSX fixture files

#### `backend/tests/fixtures/valid_members.csv`

```
employee_id,name,title,location,email,phone,slack_handle,salary,bonus,pto_used,functional_area_name,team_name,program_name,supervisor_employee_id,program_role
EMP001,Alice Smith,Engineer,New York,alice@example.com,555-0001,@alice,120000,10000,5.0,Engineering,Backend,Alpha,,
EMP002,Bob Jones,Designer,London,bob@example.com,555-0002,@bob,95000,8000,3.5,Design,UX,Beta,EMP001,
EMP003,Carol White,Manager,Chicago,carol@example.com,555-0003,@carol,140000,15000,2.0,Engineering,Backend,Alpha,,Lead
EMP004,Dave Brown,Analyst,Austin,dave@example.com,555-0004,@dave,85000,5000,8.0,Product,Analytics,Gamma,EMP003,
EMP005,Eve Davis,Engineer,Seattle,eve@example.com,555-0005,@eve,110000,9000,4.5,Engineering,Frontend,Alpha,EMP001,
```

#### `backend/tests/fixtures/invalid_members.csv`

```
employee_id,name,email,salary
EMP010,,alice@example.com,50000
EMP011,Bob Jones,not-an-email,75000
EMP012,Carol White,carol@example.com,not-a-number
,Dave Brown,dave@example.com,60000
```

Row 1: missing name (required field error).
Row 2: invalid email format (error).
Row 3: non-numeric salary (error).
Row 4: missing employee_id (required field error).

#### `backend/tests/fixtures/duplicate_ids.csv`

```
employee_id,name,email
EMP020,Original Person,original@example.com
EMP020,Duplicate Person,duplicate@example.com
EMP021,Unique Person,unique@example.com
```

Row 2 is a duplicate of Row 1 — `apply_mapping` should emit a warning on row 2.

#### `backend/tests/fixtures/valid_members.xlsx`

Create programmatically using `openpyxl` (already in requirements). Write a small script or conftest helper to generate this file once. The easiest approach: write `backend/tests/fixtures/create_fixtures.py` as a standalone script that creates `valid_members.xlsx` with the same 5-row content as `valid_members.csv`, then run it once during setup. Alternatively, create the file directly using Python in the step below.

The implementer should create `valid_members.xlsx` by writing a small one-off Python script:

```
cd backend
python - <<'EOF'
import openpyxl, os
wb = openpyxl.Workbook()
ws = wb.active
rows = [
    ["employee_id","name","title","location","email","phone","slack_handle","salary","bonus","pto_used","functional_area_name","team_name","program_name","supervisor_employee_id","program_role"],
    ["EMP001","Alice Smith","Engineer","New York","alice@example.com","555-0001","@alice",120000,10000,5.0,"Engineering","Backend","Alpha","",""],
    ["EMP002","Bob Jones","Designer","London","bob@example.com","555-0002","@bob",95000,8000,3.5,"Design","UX","Beta","EMP001",""],
    ["EMP003","Carol White","Manager","Chicago","carol@example.com","555-0003","@carol",140000,15000,2.0,"Engineering","Backend","Alpha","","Lead"],
    ["EMP004","Dave Brown","Analyst","Austin","dave@example.com","555-0004","@dave",85000,5000,8.0,"Product","Analytics","Gamma","EMP003",""],
    ["EMP005","Eve Davis","Engineer","Seattle","eve@example.com","555-0005","@eve",110000,9000,4.5,"Engineering","Frontend","Alpha","EMP001",""],
]
for row in rows:
    ws.append(row)
os.makedirs("tests/fixtures", exist_ok=True)
wb.save("tests/fixtures/valid_members.xlsx")
print("Written tests/fixtures/valid_members.xlsx")
EOF
```

Run this inside the `backend/` directory. The resulting file is checked into version control.

**Verify**: `ls -lh backend/tests/fixtures/` shows all 4 files.

---

### Step 5 — Create `backend/tests/unit/test_import_parser.py`

All tests in this file are synchronous (`def test_*`, not `async def`). `parse_upload` has no async code.

**Test functions**:

```
test_parse_csv_valid_returns_headers_and_rows():
  Read backend/tests/fixtures/valid_members.csv as bytes.
  Call parse_upload(file_bytes, "valid_members.csv").
  Assert result.total_row_count == 5.
  Assert result.headers contains "employee_id", "name", "email".
  Assert len(result.preview_rows) == 5.
  Assert result.raw_rows[0]["employee_id"] == "EMP001".

test_parse_csv_preview_capped_at_10():
  Build a CSV in memory with 15 identical rows (employee_id,name header + 15 data rows).
  Call parse_upload(bytes, "big.csv").
  Assert result.total_row_count == 15.
  Assert len(result.preview_rows) == 10.

test_parse_csv_latin1_encoding_fallback():
  Encode string "employee_id,name\nEMP001,Ren\xe9" using latin-1 (not utf-8).
  Call parse_upload(encoded_bytes, "latin.csv").
  Assert result.raw_rows[0]["name"] == "René".

test_parse_xlsx_valid():
  Read backend/tests/fixtures/valid_members.xlsx as bytes.
  Call parse_upload(file_bytes, "valid_members.xlsx").
  Assert result.total_row_count == 5.
  Assert result.raw_rows[0]["employee_id"] == "EMP001".

test_parse_xls_raises():
  Call parse_upload(b"dummy", "file.xls").
  Assert ImportParseError is raised.
  Assert "not supported" in str(exc).

test_parse_unsupported_extension_raises():
  Call parse_upload(b"dummy", "file.txt").
  Assert ImportParseError is raised.
  Assert ".txt" in str(exc).

test_parse_empty_csv_returns_zero_rows():
  Call parse_upload(b"employee_id,name\n", "empty.csv").
  Assert result.total_row_count == 0.
  Assert result.headers == ["employee_id", "name"].
```

Import path: `from app.services.import_parser import parse_upload, ImportParseError`

**Verify**: `docker compose exec backend pytest backend/tests/unit/test_import_parser.py -v` — all 7 pass.

---

### Step 6 — Create `backend/tests/unit/test_import_session.py`

All synchronous. The `_sessions` dict is module-level global state and must be cleaned up between tests. Use a `setup_function` / `teardown_function` that calls `import app.services.import_session as sess_mod; sess_mod._sessions.clear()`.

```
Imports:
  import app.services.import_session as sess_mod
  from app.services.import_session import (
      create_session, get_session, delete_session, SessionNotFoundError
  )
  from datetime import UTC, datetime, timedelta
```

```
setup_function(fn):
  sess_mod._sessions.clear()

teardown_function(fn):
  sess_mod._sessions.clear()
```

**Test functions**:

```
test_create_session_returns_string_uuid():
  sid = create_session([{"a": "1"}], ["a"])
  Assert isinstance(sid, str).
  Assert len(sid) == 36  # UUID format.

test_get_session_returns_correct_data():
  sid = create_session([{"employee_id": "E1"}], ["employee_id"])
  session = get_session(sid)
  Assert session.session_id == sid.
  Assert session.raw_rows == [{"employee_id": "E1"}].
  Assert session.headers == ["employee_id"].

test_get_session_unknown_raises():
  Call get_session("nonexistent-id").
  Assert SessionNotFoundError is raised.

test_get_session_expired_raises():
  sid = create_session([], [])
  # Manually backdate the session's created_at to 31 minutes ago.
  sess_mod._sessions[sid].created_at = datetime.now(UTC) - timedelta(minutes=31)
  Call get_session(sid).
  Assert SessionNotFoundError is raised.
  Assert sid not in sess_mod._sessions  # expired session removed from store.

test_delete_session_removes_it():
  sid = create_session([], [])
  delete_session(sid)
  Call get_session(sid).
  Assert SessionNotFoundError is raised.

test_delete_session_noop_if_missing():
  delete_session("ghost-id")  # must not raise.
```

**Verify**: `docker compose exec backend pytest backend/tests/unit/test_import_session.py -v` — all 6 pass.

---

### Step 7 — Create `backend/tests/unit/test_import_mapper.py`

All synchronous. Each test must create a fresh session first (using `create_session`), then call `apply_mapping`. Clean `_sessions` in setup/teardown (same pattern as Step 6).

```
Imports:
  import app.services.import_session as sess_mod
  from app.services.import_session import create_session
  from app.services.import_mapper import apply_mapping, TARGET_FIELDS
  from app.schemas.import_schemas import MappingConfig
```

```
setup_function / teardown_function: sess_mod._sessions.clear()
```

Helper used across tests:
```
def make_config(sid, col_map):
    return MappingConfig(session_id=sid, column_map=col_map)
```

**Test functions**:

```
test_apply_mapping_happy_path_all_valid():
  rows = [{"Col_ID": "EMP001", "Col_Name": "Alice"}]
  sid = create_session(rows, ["Col_ID", "Col_Name"])
  config = make_config(sid, {"Col_ID": "employee_id", "Col_Name": "name"})
  result = apply_mapping(sid, config)
  Assert result.error_count == 0.
  Assert result.warning_count == 0.
  Assert result.rows[0].data["employee_id"] == "EMP001".
  Assert result.rows[0].data["name"] == "Alice".

test_apply_mapping_missing_employee_id_is_error():
  rows = [{"Col_ID": "", "Col_Name": "Alice"}]
  sid = create_session(rows, ["Col_ID", "Col_Name"])
  config = make_config(sid, {"Col_ID": "employee_id", "Col_Name": "name"})
  result = apply_mapping(sid, config)
  Assert result.error_count == 1.
  Assert any("employee_id is missing" in e for e in result.rows[0].errors).

test_apply_mapping_missing_name_is_error():
  rows = [{"Col_ID": "EMP001", "Col_Name": ""}]
  sid = create_session(rows, ["Col_ID", "Col_Name"])
  config = make_config(sid, {"Col_ID": "employee_id", "Col_Name": "name"})
  result = apply_mapping(sid, config)
  Assert result.error_count == 1.
  Assert any("name is missing" in e for e in result.rows[0].errors).

test_apply_mapping_invalid_email_is_error():
  rows = [{"id": "EMP001", "n": "Alice", "e": "not-an-email"}]
  sid = create_session(rows, ["id", "n", "e"])
  config = make_config(sid, {"id": "employee_id", "n": "name", "e": "email"})
  result = apply_mapping(sid, config)
  Assert result.error_count == 1.
  Assert any("Invalid email" in e for e in result.rows[0].errors).

test_apply_mapping_non_numeric_salary_is_error():
  rows = [{"id": "EMP001", "n": "Alice", "s": "not-a-number"}]
  sid = create_session(rows, ["id", "n", "s"])
  config = make_config(sid, {"id": "employee_id", "n": "name", "s": "salary"})
  result = apply_mapping(sid, config)
  Assert result.error_count == 1.
  Assert any("salary" in e and "numeric" in e for e in result.rows[0].errors).

test_apply_mapping_duplicate_employee_id_is_warning():
  rows = [
      {"id": "EMP001", "n": "Alice"},
      {"id": "EMP001", "n": "Duplicate"},
  ]
  sid = create_session(rows, ["id", "n"])
  config = make_config(sid, {"id": "employee_id", "n": "name"})
  result = apply_mapping(sid, config)
  Assert result.warning_count == 1.
  Assert result.error_count == 0.
  Assert any("Duplicate employee_id" in w for w in result.rows[1].warnings).

test_apply_mapping_skipped_column_none_not_in_data():
  rows = [{"id": "EMP001", "n": "Alice", "skip": "ignored"}]
  sid = create_session(rows, ["id", "n", "skip"])
  config = make_config(sid, {"id": "employee_id", "n": "name", "skip": None})
  result = apply_mapping(sid, config)
  Assert "skip" not in result.rows[0].data.

test_apply_mapping_unknown_target_field_raises_value_error():
  rows = [{"id": "EMP001"}]
  sid = create_session(rows, ["id"])
  config = make_config(sid, {"id": "not_a_real_field"})
  Call apply_mapping(sid, config).
  Assert ValueError is raised.
  Assert "Unknown target field" in str(exc).

test_apply_mapping_unknown_session_raises():
  config = make_config("does-not-exist", {"id": "employee_id"})
  Call apply_mapping("does-not-exist", config).
  Assert SessionNotFoundError is raised.

test_apply_mapping_from_csv_fixture():
  Read backend/tests/fixtures/valid_members.csv as bytes.
  Parse with parse_upload.
  sid = create_session(result.raw_rows, result.headers).
  Build config mapping each CSV header to its matching TARGET_FIELD name (1:1 in this fixture).
  result = apply_mapping(sid, config).
  Assert result.error_count == 0.
  Assert len(result.rows) == 5.

test_apply_mapping_from_invalid_csv_fixture():
  Read backend/tests/fixtures/invalid_members.csv as bytes.
  Parse and create session.
  Build mapping config for available columns.
  result = apply_mapping(sid, config).
  Assert result.error_count >= 3  # rows 1,2,3,4 each have at least one error.

test_apply_mapping_from_duplicate_csv_fixture():
  Read backend/tests/fixtures/duplicate_ids.csv.
  Parse and create session.
  result = apply_mapping(sid, config).
  Assert result.warning_count == 1.
  Assert any("EMP020" in w for w in result.rows[1].warnings).
```

**Verify**: `docker compose exec backend pytest backend/tests/unit/test_import_mapper.py -v` — all 12 pass.

---

### Step 8 — Create `backend/tests/integration/test_members_routes.py`

All tests are `async def`. Each test uses the `client` and `area` fixtures from `conftest.py`.

```
Imports:
  import pytest
  from httpx import AsyncClient
  from app.models.functional_area import FunctionalArea
```

**Test functions**:

```
test_list_members_empty(client, area):
  GET /api/members/
  Assert status 200.
  Assert response.json() == [].

test_create_member_returns_201(client, area):
  POST /api/members/ with JSON:
    {"employee_id": "T001", "name": "Test User", "functional_area_id": area.id}
  Assert status 201.
  body = response.json()
  Assert body["employee_id"] == "T001".
  Assert body["name"] == "Test User".
  Assert "uuid" in body.

test_get_member_by_uuid(client, area):
  First POST to create, capture uuid from response.
  GET /api/members/{uuid}.
  Assert status 200.
  Assert body["name"] == "Test User".

test_get_member_not_found(client):
  GET /api/members/00000000-0000-0000-0000-000000000000.
  Assert status 404.

test_update_member(client, area):
  POST to create. Capture uuid.
  PUT /api/members/{uuid} with JSON {"title": "Senior Engineer"}.
  Assert status 200.
  Assert body["title"] == "Senior Engineer".

test_update_member_not_found(client):
  PUT /api/members/00000000-0000-0000-0000-000000000000 with JSON {"title": "X"}.
  Assert status 404.

test_delete_member(client, area):
  POST to create. Capture uuid.
  DELETE /api/members/{uuid}.
  Assert status 204.
  GET /api/members/{uuid}.
  Assert status 404.

test_delete_member_not_found(client):
  DELETE /api/members/00000000-0000-0000-0000-000000000000.
  Assert status 404.

test_create_member_records_history_for_financial_fields(client, area):
  POST /api/members/ with:
    {"employee_id": "T002", "name": "Rich User", "functional_area_id": area.id,
     "salary": 100000, "bonus": 5000}
  Capture uuid.
  GET /api/members/{uuid}/history
  Assert status 200.
  entries = response.json()
  Assert any(e["field"] == "salary" and e["value"] == "100000.00" for e in entries).
  Assert any(e["field"] == "bonus" for e in entries).

test_update_member_records_history_on_salary_change(client, area):
  Create member with salary=100000. Capture uuid.
  PUT /api/members/{uuid} with {"salary": 120000}.
  GET /api/members/{uuid}/history
  history = [e for e in response.json() if e["field"] == "salary"]
  Assert len(history) == 2  # initial + update.
  Assert history[-1]["value"] == "120000.00".

test_list_members_filtered_by_area(client, db_session, area):
  Create a second FunctionalArea(name="Design") in db_session, flush.
  Create member in "Engineering" area.
  Create member in "Design" area.
  GET /api/members/?area_id={area.id}
  Assert len(response.json()) == 1.
  Assert response.json()[0]["employee_id"] == first member's employee_id.

test_upload_image_member_not_found(client):
  POST /api/members/00000000-0000-0000-0000-000000000000/image with a fake PNG file.
  Assert status 404.
```

Note on image upload test: creating a real PNG in memory requires at least a valid PNG header. The simplest approach is to use `PIL.Image` to create a 1x1 image in a `BytesIO` buffer and upload that as multipart `files={"file": ("test.png", buf, "image/png")}`. The test should only assert 404 (member not found) to avoid filesystem side effects.

**Verify**: `docker compose exec backend pytest backend/tests/integration/test_members_routes.py -v`

---

### Step 9 — Create `backend/tests/integration/test_areas_routes.py`

```
test_list_areas_empty(client):
  GET /api/areas/
  Assert status 200, body == [].

test_create_area(client):
  POST /api/areas/ {"name": "Engineering"}
  Assert 201, body["name"] == "Engineering".

test_get_area(client):
  POST to create. GET /api/areas/{id}. Assert 200.

test_get_area_not_found(client):
  GET /api/areas/99999. Assert 404.

test_update_area(client):
  POST to create. PUT /api/areas/{id} {"name": "Renamed"}.
  Assert 200, body["name"] == "Renamed".

test_update_area_not_found(client):
  PUT /api/areas/99999 {"name": "X"}. Assert 404.

test_delete_area(client):
  POST to create. DELETE /api/areas/{id}. Assert 204.
  GET /api/areas/{id}. Assert 404.

test_delete_area_not_found(client):
  DELETE /api/areas/99999. Assert 404.

test_area_tree_not_found(client):
  GET /api/areas/99999/tree. Assert 404.

test_area_tree_returns_area_node(client, area):
  GET /api/areas/{area.id}/tree
  Assert 200.
  body = response.json()
  node_ids = [n["id"] for n in body["nodes"]]
  Assert f"area-{area.id}" in node_ids.
```

**Verify**: `docker compose exec backend pytest backend/tests/integration/test_areas_routes.py -v`

---

### Step 10 — Create `backend/tests/integration/test_teams_routes.py`

The `teams` router is mounted at `/api/areas/{area_id}/teams`. All routes require a valid `area_id`.

```
test_list_teams_empty(client, area):
  GET /api/areas/{area.id}/teams/
  Assert 200, body == [].

test_create_team(client, area):
  POST /api/areas/{area.id}/teams/ {"name": "Backend"}
  Assert 201.
  body["name"] == "Backend".
  body["functional_area_id"] == area.id.

test_get_team(client, area, team):
  GET /api/areas/{area.id}/teams/{team.id}
  Assert 200. body["name"] == "Backend".

test_get_team_wrong_area_returns_404(client, area, team):
  POST a second area ("Design"), capture its id.
  GET /api/areas/{design_area_id}/teams/{team.id}
  Assert 404  # team.functional_area_id != design_area_id.

test_update_team(client, area, team):
  PUT /api/areas/{area.id}/teams/{team.id} {"name": "Updated"}
  Assert 200, body["name"] == "Updated".

test_delete_team(client, area, team):
  DELETE /api/areas/{area.id}/teams/{team.id}
  Assert 204.
  GET /api/areas/{area.id}/teams/{team.id}. Assert 404.

test_add_member_to_team(client, area, team, member):
  POST /api/areas/{area.id}/teams/{team.id}/members {"member_uuid": str(member.uuid)}
  Assert 200, body["ok"] == True.

test_add_member_not_found(client, area, team):
  POST /api/areas/{area.id}/teams/{team.id}/members {"member_uuid": "00000000-0000-0000-0000-000000000000"}
  Assert 404.

test_remove_member_from_team(client, area, team, member):
  First POST to add member. Then:
  DELETE /api/areas/{area.id}/teams/{team.id}/members/{member.uuid}
  Assert 204.

test_remove_member_not_in_team(client, area, team, member):
  DELETE /api/areas/{area.id}/teams/{team.id}/members/{member.uuid}
  Assert 404  # member not in team.
```

**Verify**: `docker compose exec backend pytest backend/tests/integration/test_teams_routes.py -v`

---

### Step 11 — Create `backend/tests/integration/test_programs_routes.py`

```
test_list_programs_empty(client):
  GET /api/programs/. Assert 200, [].

test_create_program(client):
  POST /api/programs/ {"name": "Alpha"}. Assert 201. body["name"] == "Alpha".

test_get_program(client):
  POST to create. GET /api/programs/{id}. Assert 200.

test_get_program_not_found(client):
  GET /api/programs/99999. Assert 404.

test_update_program(client):
  POST. PUT /api/programs/{id} {"name": "Beta"}. Assert 200, body["name"] == "Beta".

test_delete_program(client):
  POST. DELETE /api/programs/{id}. Assert 204. GET. Assert 404.

test_assign_member(client, program, member):
  POST /api/programs/{program.id}/assignments {"member_uuid": str(member.uuid), "role": "Lead"}
  Assert 201.
  body["role"] == "Lead".

test_assign_member_program_not_found(client, member):
  POST /api/programs/99999/assignments {"member_uuid": str(member.uuid)}.
  Assert 404.

test_unassign_member(client, program, member):
  POST to assign. Then:
  DELETE /api/programs/{program.id}/assignments/{member.uuid}
  Assert 204.

test_unassign_not_found(client, program, member):
  DELETE /api/programs/{program.id}/assignments/{member.uuid}
  Assert 404  # not assigned.

test_get_program_members(client, program, member):
  POST to assign member. GET /api/programs/{program.id}/members.
  Assert 200. len(body) == 1. body[0]["uuid"] == str(member.uuid).

test_program_tree_not_found(client):
  GET /api/programs/99999/tree. Assert 404.

test_program_tree_returns_program_node(client, program, member):
  Assign member to program.
  GET /api/programs/{program.id}/tree.
  Assert 200.
  node_ids = [n["id"] for n in body["nodes"]].
  Assert f"program-{program.id}" in node_ids.
  Assert f"member-{member.uuid}" in node_ids.
  Assert len(body["edges"]) == 1.
```

**Verify**: `docker compose exec backend pytest backend/tests/integration/test_programs_routes.py -v`

---

### Step 12 — Create `backend/tests/integration/test_org_routes.py`

```
test_org_tree_empty(client):
  GET /api/org/tree. Assert 200. body["nodes"] == []. body["edges"] == [].

test_org_tree_with_members(client, area, db_session):
  Create two members (Alice, Bob) in db_session, flush.
  Set Bob.supervisor_id = Alice.uuid, flush.
  GET /api/org/tree.
  node_ids = [n["id"] for n in body["nodes"]].
  Assert f"member-{alice.uuid}" in node_ids.
  Assert f"member-{bob.uuid}" in node_ids.
  Assert len(body["edges"]) == 1.
  edge = body["edges"][0].
  Assert edge["source"] == f"member-{alice.uuid}".
  Assert edge["target"] == f"member-{bob.uuid}".

test_set_supervisor_success(client, area, db_session):
  Create Alice and Bob. Flush.
  PUT /api/org/members/{bob.uuid}/supervisor {"supervisor_id": str(alice.uuid)}.
  Assert 200. body["supervisor_id"] == str(alice.uuid).

test_set_supervisor_to_null(client, area, db_session):
  Create Alice and Bob. Set Bob.supervisor_id = Alice.uuid. Flush.
  PUT /api/org/members/{bob.uuid}/supervisor {"supervisor_id": null}.
  Assert 200. body["supervisor_id"] == None.

test_set_supervisor_self_reference_returns_400(client, area, db_session):
  Create Alice. Flush.
  PUT /api/org/members/{alice.uuid}/supervisor {"supervisor_id": str(alice.uuid)}.
  Assert 400.
  Assert "own supervisor" in body["detail"] (case-insensitive).

test_set_supervisor_cycle_returns_400(client, area, db_session):
  Create Alice and Bob. Flush.
  Set Alice.supervisor_id = Bob.uuid. Flush.  (Alice reports to Bob)
  Now attempt PUT /api/org/members/{bob.uuid}/supervisor {"supervisor_id": str(alice.uuid)}.
  Assert 400.  (would create B → A → B cycle)
  Assert "circular" in body["detail"].

test_set_supervisor_member_not_found(client):
  PUT /api/org/members/00000000-0000-0000-0000-000000000000/supervisor {"supervisor_id": null}.
  Assert 404.
```

**Verify**: `docker compose exec backend pytest backend/tests/integration/test_org_routes.py -v`

---

### Step 13 — Create `backend/tests/integration/test_history_routes.py`

```
test_get_history_empty(client, area, db_session):
  Create a member in db_session. Flush.
  GET /api/members/{member.uuid}/history
  Assert 200, [].

test_get_history_returns_entries(client, area, db_session):
  Create member in db_session. Flush.
  Create two MemberHistory entries: one "salary", one "bonus". Flush.
  GET /api/members/{member.uuid}/history
  Assert 200. len(body) == 2.

test_get_history_filtered_by_field(client, area, db_session):
  Create member. Flush.
  Create MemberHistory(field="salary", ...) and MemberHistory(field="bonus", ...). Flush.
  GET /api/members/{member.uuid}/history?field=salary
  Assert 200. len(body) == 1. body[0]["field"] == "salary".

test_get_history_invalid_field_filter(client, area, member):
  GET /api/members/{member.uuid}/history?field=nonexistent_field
  Assert 422  # FastAPI enum validation rejects unknown field value.
```

For the `MemberHistory` model import: `from app.models.member_history import MemberHistory`.
The `MemberHistory` schema requires: `member_uuid`, `field` (one of "salary", "bonus", "pto_used"), `value` (Decimal), `effective_date` (date).

**Verify**: `docker compose exec backend pytest backend/tests/integration/test_history_routes.py -v`

---

### Step 14 — Create `backend/tests/integration/test_tree_service.py`

These tests call service functions directly (not via HTTP) to test tree shape logic in isolation.

```
Imports:
  from app.services.tree_service import build_org_tree, build_program_tree, build_area_tree
  from app.models.team_member import TeamMember
  from app.models.program import Program
  from app.models.program_assignment import ProgramAssignment
  from app.models.functional_area import FunctionalArea
  from app.models.team import Team
```

```
test_build_org_tree_empty(db_session):
  result = await build_org_tree(db_session)
  Assert result.nodes == []. result.edges == [].

test_build_org_tree_single_member(db_session, area, member):
  result = await build_org_tree(db_session)
  Assert len(result.nodes) == 1.
  Assert result.nodes[0]["id"] == f"member-{member.uuid}".
  Assert result.edges == [].

test_build_org_tree_supervisor_edge(db_session, area):
  Create Alice and Bob. Set bob.supervisor_id = alice.uuid. Flush.
  result = await build_org_tree(db_session).
  Assert len(result.nodes) == 2.
  Assert len(result.edges) == 1.
  edge = result.edges[0].
  Assert edge.source == f"member-{alice.uuid}".
  Assert edge.target == f"member-{bob.uuid}".

test_build_program_tree_not_found(db_session):
  result = await build_program_tree(db_session, 99999)
  Assert result is None.

test_build_program_tree_with_members(db_session, area, member, program):
  Create ProgramAssignment(member_uuid=member.uuid, program_id=program.id, role="Lead"). Flush.
  result = await build_program_tree(db_session, program.id).
  node_ids = [n.id for n in result.nodes].
  Assert f"program-{program.id}" in node_ids.
  Assert f"member-{member.uuid}" in node_ids.
  Assert len(result.edges) == 1.

test_build_area_tree_not_found(db_session):
  result = await build_area_tree(db_session, 99999)
  Assert result is None.

test_build_area_tree_structure(db_session, area, team, member):
  # team and member fixtures already set area relationship.
  # Set member.team_id = team.id, flush.
  member.team_id = team.id
  await db_session.flush()
  result = await build_area_tree(db_session, area.id).
  node_ids = [n.id for n in result.nodes].
  Assert f"area-{area.id}" in node_ids.
  Assert f"team-{team.id}" in node_ids.
  Assert f"member-{member.uuid}" in node_ids.
  # Edge: area -> team, team -> member
  edge_sources = [e.source for e in result.edges].
  Assert f"area-{area.id}" in edge_sources.
  Assert f"team-{team.id}" in edge_sources.

test_build_area_tree_member_without_team_links_to_area(db_session, area, member):
  # member has no team_id (fixture default).
  result = await build_area_tree(db_session, area.id).
  area_edges = [e for e in result.edges if e.source == f"area-{area.id}"]
  Assert any(e.target == f"member-{member.uuid}" for e in area_edges).
```

**Verify**: `docker compose exec backend pytest backend/tests/integration/test_tree_service.py -v`

---

### Step 15 — Create `backend/tests/integration/test_import_routes.py`

Tests the full 4-step wizard via HTTP. Sessions are real (in-memory dict). Since these tests call `POST /api/import/commit` which does `db.commit()`, the test DB session cannot roll back cleanly around the commit. Use `db_session` only for setup and post-commit verification — the `client` fixture handles the dependency override.

```
Imports:
  import io, csv
  from pathlib import Path

FIXTURES = Path(__file__).parent.parent / "fixtures"
```

```
test_upload_csv_returns_session_id(client):
  csv_bytes = (FIXTURES / "valid_members.csv").read_bytes()
  POST /api/import/upload with files={"file": ("valid_members.csv", csv_bytes, "text/csv")}
  Assert 200.
  body = response.json().
  Assert "session_id" in body.
  Assert body["total_row_count"] == 5.
  Assert "employee_id" in body["headers"].

test_upload_xlsx_returns_session_id(client):
  xlsx_bytes = (FIXTURES / "valid_members.xlsx").read_bytes()
  POST /api/import/upload with files={"file": ("valid_members.xlsx", xlsx_bytes, ...)}
  Assert 200. body["total_row_count"] == 5.

test_upload_xls_returns_422(client):
  POST /api/import/upload with files={"file": ("file.xls", b"dummy", "application/octet-stream")}
  Assert 422.

test_upload_oversized_file_returns_413(client):
  Generate 11 MB of bytes (b"x" * 11 * 1024 * 1024).
  POST /api/import/upload with files={"file": ("big.csv", big_bytes, "text/csv")}
  Assert 413.

test_preview_returns_mapped_rows(client):
  Upload valid_members.csv. Capture session_id and headers.
  Build column_map = {h: h for h in headers} (1:1 mapping since CSV headers == target fields).
  POST /api/import/preview {"session_id": sid, "column_map": column_map}
  Assert 200. body["error_count"] == 0. len(body["rows"]) == 5.

test_preview_session_not_found_returns_404(client):
  POST /api/import/preview {"session_id": "fake-id", "column_map": {}}
  Assert 404.

test_preview_unknown_target_field_returns_422(client):
  Upload valid_members.csv. Capture sid.
  POST /api/import/preview {"session_id": sid, "column_map": {"employee_id": "totally_fake_field"}}
  Assert 422.

test_commit_creates_members(client):
  Upload valid_members.csv. Capture sid.
  Build 1:1 column_map.
  POST /api/import/commit {"session_id": sid, "column_map": column_map}
  Assert 200. body["created_count"] == 5. body["skipped_count"] == 0.

test_commit_session_not_found_returns_404(client):
  POST /api/import/commit {"session_id": "no-such-session", "column_map": {}}
  Assert 404.

test_commit_then_session_deleted(client):
  Upload valid_members.csv. Capture sid and headers.
  Commit.
  POST /api/import/preview {"session_id": sid, "column_map": {h: h for h in headers}}
  Assert 404  # session was deleted by commit.
```

**Verify**: `docker compose exec backend pytest backend/tests/integration/test_import_routes.py -v`

---

### Step 16 — Create `backend/tests/integration/test_import_commit.py`

Tests `commit_import()` directly as an async function using `db_session`. This is the most complex test file — it verifies upsert, `get_or_create` helpers, two-pass supervisor resolution, and cycle skipping.

```
Imports:
  import app.services.import_session as sess_mod
  from app.services.import_commit import commit_import
  from app.services.import_session import create_session
  from app.schemas.import_schemas import MappingConfig
  from app.models.team_member import TeamMember
  from app.models.functional_area import FunctionalArea
  from app.models.team import Team
  from app.models.program import Program
  from sqlalchemy import select

setup_function / teardown_function: sess_mod._sessions.clear()
```

Helper:
```
def make_commit_config(sid, col_map):
    return MappingConfig(session_id=sid, column_map=col_map)
```

All tests are `async def`. After calling `commit_import(...)`, query the `db_session` directly to verify DB state. Because `commit_import` calls `await db.commit()` internally, the test transaction wrapping in `conftest.py` will be broken. Adjust the `db_session` fixture for this file: use `async with session.begin() as txn:` with `savepoint=True` or simply accept that these tests do NOT roll back — instead rely on test isolation by using unique `employee_id` values per test.

**Practical isolation approach**: Each test generates unique `employee_id` values prefixed with the test name (e.g., `"CI_UPSERT_001"`) so there are no conflicts between test runs. Since `aiosqlite:///:memory:` is session-scoped in the engine fixture and these tests commit, the final state persists across tests in this module. Use distinct IDs to avoid collisions.

```
test_commit_creates_new_member(db_session):
  rows = [{"id": "CI_NEW_001", "nm": "New Person"}]
  sid = create_session(rows, ["id", "nm"])
  config = make_commit_config(sid, {"id": "employee_id", "nm": "name"})
  result = await commit_import(sid, config, db_session)
  Assert result.created_count == 1.
  Assert result.updated_count == 0.
  Assert result.skipped_count == 0.
  # Verify DB
  row = (await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_NEW_001"))).scalar_one_or_none()
  Assert row is not None.
  Assert row.name == "New Person".

test_commit_updates_existing_member(db_session, area):
  # Pre-create member
  member = TeamMember(employee_id="CI_UPD_001", name="Old Name", functional_area_id=area.id)
  db_session.add(member); await db_session.flush()
  rows = [{"id": "CI_UPD_001", "nm": "New Name"}]
  sid = create_session(rows, ["id", "nm"])
  config = make_commit_config(sid, {"id": "employee_id", "nm": "name"})
  result = await commit_import(sid, config, db_session)
  Assert result.created_count == 0.
  Assert result.updated_count == 1.
  updated = (await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_UPD_001"))).scalar_one()
  Assert updated.name == "New Name".

test_commit_get_or_create_functional_area(db_session):
  rows = [{"id": "CI_FA_001", "nm": "Person", "fa": "NewArea"}]
  sid = create_session(rows, ["id", "nm", "fa"])
  config = make_commit_config(sid, {"id": "employee_id", "nm": "name", "fa": "functional_area_name"})
  await commit_import(sid, config, db_session)
  area = (await db_session.execute(select(FunctionalArea).where(FunctionalArea.name == "NewArea"))).scalar_one_or_none()
  Assert area is not None.

test_commit_get_or_create_team_scoped_by_area(db_session):
  rows = [{"id": "CI_TM_001", "nm": "Person", "fa": "AreaX", "tm": "TeamX"}]
  sid = create_session(rows, ["id", "nm", "fa", "tm"])
  config = make_commit_config(sid, {"id": "employee_id", "nm": "name", "fa": "functional_area_name", "tm": "team_name"})
  await commit_import(sid, config, db_session)
  team = (await db_session.execute(select(Team).where(Team.name == "TeamX"))).scalar_one_or_none()
  Assert team is not None.
  area = (await db_session.execute(select(FunctionalArea).where(FunctionalArea.name == "AreaX"))).scalar_one()
  Assert team.functional_area_id == area.id.

test_commit_supervisor_two_pass_resolved(db_session):
  rows = [
      {"id": "CI_SUP_001", "nm": "Alice"},
      {"id": "CI_SUP_002", "nm": "Bob", "sup": "CI_SUP_001"},
  ]
  sid = create_session(rows, ["id", "nm", "sup"])
  config = make_commit_config(sid, {"id": "employee_id", "nm": "name", "sup": "supervisor_employee_id"})
  await commit_import(sid, config, db_session)
  alice = (await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_SUP_001"))).scalar_one()
  bob = (await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_SUP_002"))).scalar_one()
  Assert bob.supervisor_id == alice.uuid.

test_commit_supervisor_cycle_skipped(db_session):
  # A supervises B, B supervises A — both supplied in same import batch.
  rows = [
      {"id": "CI_CYC_001", "nm": "Alice", "sup": "CI_CYC_002"},
      {"id": "CI_CYC_002", "nm": "Bob", "sup": "CI_CYC_001"},
  ]
  sid = create_session(rows, ["id", "nm", "sup"])
  config = make_commit_config(sid, {"id": "employee_id", "nm": "name", "sup": "supervisor_employee_id"})
  result = await commit_import(sid, config, db_session)
  # At most one of the two supervisor assignments survives; the cycle-causing one is skipped.
  alice = (await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_CYC_001"))).scalar_one()
  bob = (await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_CYC_002"))).scalar_one()
  # Exactly one of them must have supervisor_id set; the other must be None.
  # (The cycle detection skips the second link.)
  Assert (alice.supervisor_id is None) != (bob.supervisor_id is None), \
      "exactly one supervisor link should survive the cycle detection"

test_commit_duplicate_employee_id_first_wins(db_session):
  rows = [
      {"id": "CI_DUP_001", "nm": "First"},
      {"id": "CI_DUP_001", "nm": "Second"},
  ]
  sid = create_session(rows, ["id", "nm"])
  config = make_commit_config(sid, {"id": "employee_id", "nm": "name"})
  result = await commit_import(sid, config, db_session)
  Assert result.created_count == 1.
  member = (await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_DUP_001"))).scalar_one()
  Assert member.name == "First".

test_commit_session_deleted_after_commit(db_session):
  rows = [{"id": "CI_DEL_001", "nm": "Gone"}]
  sid = create_session(rows, ["id", "nm"])
  config = make_commit_config(sid, {"id": "employee_id", "nm": "name"})
  await commit_import(sid, config, db_session)
  Assert sid not in sess_mod._sessions.

test_commit_skips_error_rows(db_session):
  rows = [
      {"id": "CI_ERR_001", "nm": "Valid"},
      {"id": "", "nm": "Invalid"},  # missing employee_id → error
  ]
  sid = create_session(rows, ["id", "nm"])
  config = make_commit_config(sid, {"id": "employee_id", "nm": "name"})
  result = await commit_import(sid, config, db_session)
  Assert result.created_count == 1.
  Assert result.skipped_count == 1.
```

**Verify**: `docker compose exec backend pytest backend/tests/integration/test_import_commit.py -v`

---

### Step 17 — Final run and coverage check

```bash
docker compose exec backend pytest -v
docker compose exec backend pytest --tb=short -q
```

For coverage report (add `pytest-cov` if not installed, or run without if it is):

```bash
docker compose exec backend pytest --cov=app --cov-report=term-missing -q
```

Target: >= 80% on the `app/services/` module tree.

---

## 5. Validation Checklist

- [ ] `docker compose exec backend pip show aiosqlite` — exits 0
- [ ] `docker compose exec backend pytest backend/tests/unit/ -v` — all unit tests pass (0 failures)
- [ ] `docker compose exec backend pytest backend/tests/integration/ -v` — all integration tests pass (0 failures)
- [ ] `docker compose exec backend pytest -v` — full suite passes
- [ ] `docker compose exec backend pytest --cov=app --cov-report=term-missing -q` — `app/services/` coverage >= 80%
- [ ] No `DeprecationWarning: PytestUnraisableExceptionWarning` about unclosed DB connections
- [ ] `docker compose exec backend ruff check tests/` — lint clean
- [ ] `docker compose exec backend mypy app/` — type check clean (tests directory excluded from strict mypy by default)

---

## 6. Risks

| Risk | Mitigation |
|------|------------|
| `UUID(as_uuid=True)` from `sqlalchemy.dialects.postgresql` causes DDL errors on SQLite | SQLAlchemy renders `UUID` as `VARCHAR(36)` for non-Postgres dialects when using `create_all`. Verify by running `create_all` in conftest and inspecting no `OperationalError`. If it fails, add `TypeDecorator` for UUID as a fallback (see SQLAlchemy docs on custom type compilation). |
| `commit_import` calls `await db.commit()` inside the service — breaks conftest rollback pattern | Use unique `employee_id` prefixes per test in `test_import_commit.py` instead of relying on rollback. Accept that this module accumulates state in the in-memory DB across tests in the same session. |
| `_sessions` global dict leaks between tests in same process | Always call `sess_mod._sessions.clear()` in `setup_function` and `teardown_function` in every unit test module that touches sessions. |
| `asyncio_mode = "auto"` conflicts with explicit `@pytest.mark.asyncio` | Do NOT add `@pytest.mark.asyncio` to any test. The `asyncio_mode = "auto"` in `pyproject.toml` handles all async tests. |
| `Team.lead_id` circular FK (`use_alter=True`) may fail on SQLite DDL | SQLite silently ignores `ALTER TABLE ADD FOREIGN KEY` and `use_alter=True`. Tables still create successfully; FK is simply unenforced. Functional tests for team lead are unaffected. |
| `httpx.AsyncClient` vs `TestClient` | All route tests use `AsyncClient(transport=ASGITransport(app=app), ...)`. Do NOT use `from fastapi.testclient import TestClient` — it is synchronous and will deadlock with `asyncio_mode = "auto"`. |
| `app.mount("/uploads", StaticFiles(...))` in `main.py` will fail if `settings.upload_dir` does not exist during test startup | Add `os.makedirs(settings.upload_dir, exist_ok=True)` — already present in `main.py`. SQLite test env inherits `settings.upload_dir` value. Ensure directory exists before test suite runs (`/tmp/uploads` or equivalent). If `settings.upload_dir` points to a non-writable path in CI, override via environment variable before running pytest. |
| `lifespan` in `main.py` starts `cleanup_task` on app startup | `AsyncClient` with `ASGITransport` triggers the lifespan. `start_cleanup_task()` calls `asyncio.create_task()` which requires a running event loop. This is fine under `asyncio_mode = "auto"`. The task is cancelled on shutdown. |

---

## 7. Metrics

<!-- Auto-populated by /validate after completion -->
