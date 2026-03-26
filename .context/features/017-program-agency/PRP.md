---
feature: 017-program-agency
status: COMPLETE
complexity: MEDIUM
testing_strategy: implement-then-test
created: 2026-03-25
---

# PRP: Agency Entity + Program FK

## Problem Statement

Programs currently have no organizational sponsor. The codebase needs a first-class `Agency` lookup entity (e.g., VA, CMS, SEC) with full CRUD, and `programs.agency_id` FK so each program can be linked to the agency that commissioned it. The form enforces selection on new programs (UX-required), while the DB column is nullable (migration safety for existing rows). On agency deletion, linked programs are set to null rather than blocked.

## Solution Overview

1. Add `agencies` table and `programs.agency_id FK` in a new Alembic migration chained off the initial schema.
2. Mirror `FunctionalArea` for the backend model, schemas, service, and routes.
3. Update `Program` model and schemas to carry the nullable FK and eager-loaded agency relationship.
4. Add seed data (VA, CMS, SEC) before programs in `seed.py`.
5. Add agency import support: standalone `entityType="agency"` (upsert by name) and `agency_name` column in program import (lookup-only, error/skip if not found).
6. Mirror `FunctionalAreasPage` for the full frontend CRUD page.
7. Update `ProgramFormDialog` with a required agency dropdown (zod enforces selection; sentinel `"__none__"` pattern).
8. Add Agency column to `programColumns`.
9. Wire `/agencies` route and sidebar nav item between Programs and Functional Areas.

---

## Implementation Steps

### Step 1 — Database Migration

**File to create:** `backend/alembic/versions/<new_hash>_add_agencies_and_program_agency_fk.py`

The hash can be any 12-char hex string (e.g., `a1b2c3d4e5f6`). Alembic does not auto-generate this file — create it manually with the standard module-level header.

```
revision = 'a1b2c3d4e5f6'
down_revision = '452ccece7038'
branch_labels = None
depends_on = None
```

`upgrade()` must:
1. `op.create_table('agencies', ...)` — columns: `id` (Integer PK autoincrement), `name` (String 255, not null, unique), `description` (Text, nullable), `created_at` (DateTime timezone, server_default `now()`, not null), `updated_at` (same). Add `sa.PrimaryKeyConstraint('id')` and `sa.UniqueConstraint('name')`.
2. `op.add_column('programs', sa.Column('agency_id', sa.Integer(), nullable=True))`
3. `op.create_foreign_key('fk_programs_agency_id', 'programs', 'agencies', ['agency_id'], ['id'], ondelete='SET NULL')`
4. `op.create_index('ix_programs_agency_id', 'programs', ['agency_id'])`

`downgrade()` reverses in order: drop index, drop FK constraint, drop column, drop table.

**Validation:**
```bash
cd backend && docker compose exec backend alembic upgrade head
docker compose exec backend alembic current
# Must show: a1b2c3d4e5f6 (head)
docker compose exec db psql -U postgres -d teamresourcer -c "\d agencies"
docker compose exec db psql -U postgres -d teamresourcer -c "\d programs"
# programs must show agency_id column and fk_programs_agency_id FK
```

---

### Step 2 — Backend Model: Agency

**File to create:** `backend/app/models/agency.py`

Mirror `backend/app/models/functional_area.py` exactly, substituting:
- Class name: `Agency`
- `__tablename__ = "agencies"`
- Remove `teams` and `members` relationships; add instead:
  ```python
  programs: Mapped[list["Program"]] = relationship("Program", back_populates="agency")
  ```
- TYPE_CHECKING import: `from app.models.program import Program`

**File to modify:** `backend/app/models/program.py`

Add to imports:
```python
from sqlalchemy import ForeignKey
```
(ForeignKey is not currently imported — also keep existing `String`, `Text`, `DateTime`, `func` imports.)

Add to TYPE_CHECKING block:
```python
from app.models.agency import Agency
```

Add two mapped columns and the relationship after the existing `assignments` relationship:
```python
agency_id: Mapped[int | None] = mapped_column(ForeignKey("agencies.id"), nullable=True)
agency: Mapped["Agency | None"] = relationship("Agency", back_populates="programs")
```

**File to modify:** `backend/app/models/__init__.py`

Add `Agency` import and export alongside existing entries:
```python
from app.models.agency import Agency
```
Add `"Agency"` to `__all__`.

**Validation:**
```bash
docker compose exec backend python -c "from app.models.agency import Agency; from app.models.program import Program; print('models OK')"
```

---

### Step 3 — Backend Schemas

**File to create:** `backend/app/schemas/agency.py`

Mirror `backend/app/schemas/functional_area.py` exactly:
- `AgencyCreate(BaseModel)`: `name: str`, `description: str | None = None`
- `AgencyUpdate(BaseModel)`: `name: str | None = None`, `description: str | None = None`
- `AgencyResponse(BaseModel)`: `model_config = ConfigDict(from_attributes=True)`, fields `id: int`, `name: str`, `description: str | None`, `created_at: datetime`, `updated_at: datetime`
- `AgencyListResponse(BaseModel)`: `model_config = ConfigDict(from_attributes=True)`, fields `id: int`, `name: str`, `description: str | None`

**File to modify:** `backend/app/schemas/program.py`

Add import at top:
```python
from app.schemas.agency import AgencyListResponse
```

Update `ProgramCreate`: add `agency_id: int | None = None`
Update `ProgramUpdate`: add `agency_id: int | None = None`
Update `ProgramResponse`: add `agency_id: int | None` and `agency: AgencyListResponse | None = None`

`ProgramListResponse` does not need agency — leave unchanged.

**File to modify:** `backend/app/schemas/__init__.py`

Add agency import block before the functional_area block:
```python
from app.schemas.agency import (
    AgencyCreate,
    AgencyListResponse,
    AgencyResponse,
    AgencyUpdate,
)
```
Add all four names to `__all__` under a `# agency` comment group.

**Validation:**
```bash
docker compose exec backend python -c "from app.schemas.agency import AgencyCreate, AgencyResponse, AgencyListResponse, AgencyUpdate; from app.schemas.program import ProgramCreate, ProgramResponse; print('schemas OK')"
```

---

### Step 4 — Backend Service

**File to create:** `backend/app/services/agency_service.py`

Mirror `backend/app/services/area_service.py` exactly, substituting:
- All `area` identifiers → `agency`
- All `FunctionalArea` → `Agency`
- All schema imports → `AgencyCreate`, `AgencyUpdate` from `app.schemas.agency`
- Order-by: `Agency.name`

Functions to implement: `list_agencies`, `get_agency`, `create_agency`, `update_agency`, `delete_agency`. Each mirrors the exact implementation of its area counterpart.

**File to modify:** `backend/app/services/program_service.py`

The existing `list_programs` query does not eager-load `agency`. Without `selectinload`, serializing `ProgramResponse.agency` in async context will raise `sqlalchemy.exc.MissingGreenlet`.

Update `list_programs`:
```python
from sqlalchemy.orm import selectinload  # already imported

result = await db.execute(
    select(Program).options(selectinload(Program.agency)).order_by(Program.name)
)
```

Update `get_program`:
```python
result = await db.execute(
    select(Program)
    .options(selectinload(Program.agency))
    .where(Program.id == program_id)
)
```

No changes needed to `create_program`, `update_program`, or `delete_program` — those return after `refresh()` which does not lazy-load relationships in the response path. However, add `selectinload(Program.agency)` to the re-query after `refresh` in `create_program` and `update_program` if the routes return `ProgramResponse` (which includes `agency`). To do this safely:

- In `create_program`: after `await db.refresh(program)`, replace the `return program` with a fresh `select` that includes `selectinload(Program.agency)` and returns that result.
- In `update_program`: same pattern — after `await db.refresh(program)`, re-query with selectinload before returning.

Reference: `assign_member` in the same file already uses this re-query-after-commit pattern (lines 110-118).

**File to modify:** `backend/app/services/__init__.py`

Add agency import block at top alongside existing service imports:
```python
from app.services.agency_service import (
    create_agency,
    delete_agency,
    get_agency,
    list_agencies,
    update_agency,
)
```
Add all five names to `__all__` under a `# agency` comment group.

**Validation:**
```bash
docker compose exec backend python -c "from app.services.agency_service import list_agencies, create_agency; from app.services.program_service import list_programs, get_program; print('services OK')"
```

---

### Step 5 — Backend Routes

**File to create:** `backend/app/api/routes/agencies.py`

Mirror `backend/app/api/routes/areas.py` with these differences:
- Remove the sub-router include (areas mounts teams; agencies has no sub-router).
- Remove the `/tree` route — no tree view for agencies.
- Route path parameter is `agency_id` (not `area_id`).
- Import agency schemas: `AgencyCreate`, `AgencyListResponse`, `AgencyResponse`, `AgencyUpdate` from `app.schemas`.
- Import agency services: `create_agency`, `delete_agency`, `get_agency`, `list_agencies`, `update_agency` from `app.services`.
- 404 detail strings use `"Agency not found"`.

Endpoints:
- `GET /` → `list[AgencyListResponse]` — calls `list_agencies(db)`
- `GET /{agency_id}` → `AgencyResponse` — calls `get_agency(db, agency_id)`, raises 404 if None
- `POST /` → `AgencyResponse`, status 201 — calls `create_agency(db, data)`
- `PUT /{agency_id}` → `AgencyResponse` — calls `update_agency(db, agency_id, data)`, raises 404 if None
- `DELETE /{agency_id}` → 204 Response — calls `delete_agency(db, agency_id)`, raises 404 if not found

**File to modify:** `backend/app/main.py`

Add import at top alongside existing router imports:
```python
from app.api.routes.agencies import router as agencies_router
```

Add router registration between the programs and areas lines:
```python
app.include_router(agencies_router, prefix="/api/agencies", tags=["agencies"])
```

**Validation:**
```bash
docker compose exec backend python -c "from app.main import app; print('app loaded OK')"
curl -s http://localhost:8000/api/agencies/ | python3 -m json.tool
# Must return empty array []
curl -s -X POST http://localhost:8000/api/agencies/ \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Agency"}' | python3 -m json.tool
# Must return 201 with id, name, timestamps
curl -s http://localhost:8000/api/agencies/ | python3 -m json.tool
# Must return array with one item
```

---

### Step 6 — Backend Seed Data

**File to modify:** `backend/app/seed.py`

Add `Agency` import alongside existing model imports:
```python
from app.models.agency import Agency
```

Insert a new section `# 0. Agencies` before the existing `# 1. Functional Areas` section, after the idempotency check. Use `await db.flush()` after `db.add_all([va, cms, sec])` so IDs are assigned before programs reference them.

```python
# ------------------------------------------------------------------ #
# 0. Agencies
# ------------------------------------------------------------------ #
va = Agency(name="VA", description="Department of Veterans Affairs")
cms = Agency(name="CMS", description="Centers for Medicare & Medicaid Services")
sec = Agency(name="SEC", description="Securities and Exchange Commission")
db.add_all([va, cms, sec])
await db.flush()
print(f"Created Agency: {va.name} (id={va.id})")
print(f"Created Agency: {cms.name} (id={cms.id})")
print(f"Created Agency: {sec.name} (id={sec.id})")
```

The existing `# 4. Programs` section must be updated to reference agency IDs. The existing `await db.commit()` after section 3 (members) means agencies must be created before that commit — the agencies flush above runs within the same transaction before the commit, so `va.id`, `cms.id`, `sec.id` are valid.

Update the Program creation lines in section 4:
```python
alpha = Program(name="Alpha Program", description="First flagship initiative", agency_id=va.id)
beta = Program(name="Beta Program", description="Second growth initiative", agency_id=cms.id)
```

**Validation:**
```bash
make reset-db   # drops and recreates the DB, runs migrations
make seed       # should print "Created Agency: VA (id=...)" etc.
docker compose exec db psql -U postgres -d teamresourcer \
  -c "SELECT id, name FROM agencies;"
# Must show VA, CMS, SEC
docker compose exec db psql -U postgres -d teamresourcer \
  -c "SELECT p.name, a.name AS agency FROM programs p LEFT JOIN agencies a ON a.id = p.agency_id;"
# Must show Alpha/VA and Beta/CMS
```

---

### Step 7 — Backend Import Support

#### 7a — Standalone Agency Import (`entityType="agency"`)

**File to modify:** `backend/app/schemas/import_schemas.py`

Change the `EntityType` Literal to include `"agency"`:
```python
EntityType = Literal["member", "program", "area", "team", "agency"]
```

**File to modify:** `backend/app/services/import_mapper.py`

Add `Agency` import:
```python
from app.models.agency import Agency  # not needed in mapper; no model used here
```
(No model import needed in mapper itself — only `ENTITY_CONFIGS` needs updating.)

Add entry to `ENTITY_CONFIGS` after the `"area"` entry:
```python
"agency": EntityConfig(
    target_fields={"name", "description"},
    required_fields={"name"},
),
```

**File to modify:** `backend/app/services/import_commit.py`

Add `Agency` import:
```python
from app.models.agency import Agency
```

Add `_commit_agencies` function modeled exactly on `_commit_areas` (lines 127-146), substituting `Agency` for `FunctionalArea` and `"agency"` in comments:

```python
async def _commit_agencies(db: AsyncSession, rows: list[MappedRow]) -> tuple[int, int]:
    """Upsert agencies by name. Returns (created, updated)."""
    created = updated = 0
    for row in rows:
        name = str(row.data.get("name", "")).strip()
        if not name:
            continue
        result = await db.execute(select(Agency).where(Agency.name == name))
        agency = result.scalar_one_or_none()
        if agency is None:
            agency = Agency(name=name)
            db.add(agency)
            created += 1
        else:
            updated += 1
        desc = row.data.get("description")
        if desc is not None and desc != "":
            agency.description = str(desc)
        await db.flush()
    return created, updated
```

Update the `commit_import` dispatch block to add an `elif entity_type == "agency":` branch before the `else` (member) branch:
```python
elif entity_type == "agency":
    created, updated = await _commit_agencies(db, deduped_valid)
```

#### 7b — Program Import with `agency_name` Column (lookup-only)

**File to modify:** `backend/app/services/import_mapper.py`

Add `"agency_name"` to `ENTITY_CONFIGS["program"].target_fields`:
```python
"program": EntityConfig(
    target_fields={"name", "description", "agency_name"},
    required_fields={"name"},
),
```

**File to modify:** `backend/app/services/import_commit.py`

Update `_commit_programs` to resolve `agency_name` (lookup-only — skip the row if agency name is provided but not found):

After setting `description`, add:
```python
agency_name = row.data.get("agency_name")
if agency_name:
    agency_result = await db.execute(
        select(Agency).where(Agency.name == str(agency_name).strip())
    )
    found_agency = agency_result.scalar_one_or_none()
    if found_agency is None:
        # Do not create. Leave agency_id unchanged (None for new, existing for updates).
        pass
    else:
        program.agency_id = found_agency.id
```

This logic means: if `agency_name` is present and the agency exists, link it; if not found, silently leave `agency_id` as-is (no error at commit time — validation errors happen at preview/mapping stage if needed). The mapper does not validate agency existence — that is a commit-time resolution the same way member import resolves team names.

**Validation:**
```bash
# Agency standalone import
curl -s http://localhost:8000/api/agencies/ | python3 -m json.tool
# Prepare a CSV with columns: name,description
# VA,Dept of Veterans Affairs
# Upload via /api/import/upload, preview via /api/import/preview with entity_type="agency"
# Commit via /api/import/commit

# Program import with agency_name
# Prepare CSV: name,description,agency_name
# Test Program,A test,VA
# Upload, preview (entity_type="program"), commit
# Verify: GET /api/programs/ shows Test Program with agency.name = "VA"
```

---

### Step 8 — Frontend Types

**File to modify:** `frontend/src/types/index.ts`

Add an `Agency` section before the `Teams` section (after the existing `// ─── Functional Areas` section):

```typescript
// ─── Agencies ────────────────────────────────────────────────────────────────

export interface Agency {
  id: number
  name: string
  description: string | null
}
```

Update the `Program` interface (currently at line 37) to add:
```typescript
agency_id: number | null
agency?: Agency
```

Update `ProgramFormInput` (currently at line 115):
```typescript
export interface ProgramFormInput {
  name: string
  description?: string
  agency_id?: number
}
```

Add `AgencyFormInput` after `ProgramFormInput`:
```typescript
export interface AgencyFormInput {
  name: string
  description?: string
}
```

**Validation:**
```bash
cd frontend && npx tsc --noEmit
# Must pass with no errors
```

---

### Step 9 — Frontend API Hooks

**File to create:** `frontend/src/hooks/useAgencies.ts`

Mirror `frontend/src/hooks/useFunctionalAreas.ts` exactly, substituting:
- `areaKeys` → `agencyKeys`
- Key strings: `"areas"` → `"agencies"`
- Endpoint: `/api/areas/` → `/api/agencies/`
- Types: `FunctionalArea` → `Agency`, `FunctionalAreaFormInput` → `AgencyFormInput`
- Function names: `useFunctionalAreas` → `useAgencies`, `useCreateFunctionalArea` → `useCreateAgency`, `useUpdateFunctionalArea` → `useUpdateAgency`, `useDeleteFunctionalArea` → `useDeleteAgency`

Export all four hooks and `agencyKeys`.

**Validation:**
```bash
cd frontend && npx tsc --noEmit
# Also verify query works at runtime: open browser devtools after wiring the route
```

---

### Step 10 — Frontend AgenciesPage

**File to create:** `frontend/src/pages/AgenciesPage.tsx`

Mirror `frontend/src/pages/FunctionalAreasPage.tsx` exactly, substituting:
- Import `AgencyFormDialog` from `@/components/agencies/AgencyFormDialog`
- Import `getAgencyColumns` from `@/components/agencies/agencyColumns`
- Import `useAgencies`, `useDeleteAgency` from `@/hooks/useAgencies`
- Type `Agency` for state variables
- State variables: `editArea` → `editAgency`, `deleteArea` → `deleteAgency`
- `PageHeader` title: `"Agencies"`
- Button label: `"Add Agency"`
- `DataTable` `emptyMessage`: `"No agencies found. Add one to get started."`
- `ConfirmDialog` title: `"Delete Agency"`, description uses `deleteAgency?.name`
- `ImportWizard` prop: `entityType="agency"`
- `Dialog.Title`: `"Import Agencies"`

**File to create:** `frontend/src/components/agencies/AgencyFormDialog.tsx`

Mirror `frontend/src/components/functional-areas/FunctionalAreaFormDialog.tsx` exactly, substituting:
- Imports: `useCreateAgency`, `useUpdateAgency` from `@/hooks/useAgencies`
- Type: `Agency` instead of `FunctionalArea`
- Interface: `AgencyFormDialogProps` with `agency?: Agency`
- Title: `"Edit Agency"` / `"Add Agency"`
- Input id: `"agency-name"`, `"agency-description"`
- Input placeholder: `"Agency name"`
- Toast messages: `"Agency updated"`, `"Agency created"`
- Submit button: `"Save Changes"` / `"Create Agency"`

**File to create:** `frontend/src/components/agencies/agencyColumns.tsx`

Mirror `frontend/src/components/functional-areas/functionalAreaColumns.tsx` exactly, substituting:
- Interface: `AgencyColumnsOptions` with `onEdit: (agency: Agency) => void`, `onDelete: (agency: Agency) => void`
- Function name: `getAgencyColumns`
- Type parameter: `ColumnDef<Agency>`

**Validation:**
```bash
cd frontend && npx tsc --noEmit
# With backend running, navigate to /agencies in the browser
# Verify: page loads, Add Agency opens dialog, create/edit/delete work, Import wizard opens
```

---

### Step 11 — Frontend ProgramFormDialog Update

**File to modify:** `frontend/src/components/programs/ProgramFormDialog.tsx`

This is the most complex frontend change. The agency dropdown is **required** in the form (must select an agency to submit), but the backend accepts null (for existing programmatic creates).

Add imports:
```typescript
import * as Select from '@radix-ui/react-select'
import { Controller } from 'react-hook-form'
import { ChevronDown, Check } from 'lucide-react'
import { useAgencies } from '@/hooks/useAgencies'
```

Update the zod schema to require `agency_id`:
```typescript
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  agency_id: z.coerce.number().min(1, 'Agency is required'),
})
```

Add `control` to the `useForm` destructure (it is not currently destructured — add it alongside `register`, `handleSubmit`, `reset`, `formState`).

Update `defaultValues`:
```typescript
defaultValues: { name: '', description: '', agency_id: 0 }
```

Update the `useEffect` reset to include:
```typescript
agency_id: program?.agency_id ?? 0,
```

Call `useAgencies()` after the mutation hooks:
```typescript
const agenciesQuery = useAgencies()
```

Update `onSubmit` to include `agency_id` in the payload:
```typescript
const payload = {
  name: values.name,
  description: values.description || undefined,
  agency_id: values.agency_id || undefined,
}
```

Add the agency dropdown field between the Name and Description fields in the JSX. Use `Controller` + `Select.Root` pattern from `TeamFormDialog` (lines 230-277), with these specifics:
- `control` field name: `"agency_id"`
- `Select.Root value`: `String(field.value ?? '')` — coerces number to string for Select
- `onValueChange`: `(val) => field.onChange(val === '__none__' ? 0 : Number(val))`
- Trigger placeholder: `"Select agency"`
- No `"__none__"` / None item — agency is required; the placeholder communicates "not selected"
- Map `agenciesQuery.data?.map((agency) => <Select.Item key={agency.id} value={String(agency.id)}>...)`
- Show `errors.agency_id` error message below the field

The label should be: `Agency <span className="text-red-500">*</span>`

**Validation:**
```bash
cd frontend && npx tsc --noEmit
# With backend running:
# Open Programs page, click Add Program
# Verify: agency dropdown appears populated with VA, CMS, SEC (after seeding)
# Verify: submitting without selecting agency shows validation error
# Verify: selecting agency and submitting creates program with agency shown in table
```

---

### Step 12 — Frontend programColumns Update

**File to modify:** `frontend/src/components/programs/programColumns.tsx`

Add an `Agency` column after the `Description` column and before the `actions` column:

```typescript
{
  id: 'agency',
  header: 'Agency',
  enableSorting: false,
  cell: ({ row }) => (
    <span className="text-slate-500">
      {row.original.agency?.name ?? '—'}
    </span>
  ),
},
```

No import changes needed — `Program` type already has `agency?: Agency` after Step 8.

**Validation:**
```bash
cd frontend && npx tsc --noEmit
# Navigate to /programs — verify "Agency" column appears in the table
# Existing programs (null agency) show "—", seeded programs show "VA" or "CMS"
```

---

### Step 13 — Frontend Routing and Nav

**File to modify:** `frontend/src/App.tsx`

Add import at top alongside existing page imports:
```typescript
import AgenciesPage from '@/pages/AgenciesPage'
```

Add route inside the `<Route element={<AppLayout />}>` block, between the programs and functional-areas routes:
```tsx
<Route path="/agencies" element={<AgenciesPage />} />
```

**File to modify:** `frontend/src/components/layout/AppLayout.tsx`

Add `Building2` to the lucide-react import:
```typescript
import { Users, Briefcase, Layers, Network, GitBranch, Upload, Building2 } from 'lucide-react'
```

Insert into `navItems` array between Programs and Functional Areas:
```typescript
{ label: 'Agencies', icon: Building2, path: '/agencies' },
```

**Validation:**
```bash
cd frontend && npx tsc --noEmit
# Navigate the browser:
# - Sidebar shows "Agencies" between "Programs" and "Functional Areas"
# - /agencies route loads AgenciesPage
# - /programs route still works
```

---

## Validation Criteria (Full End-to-End)

```bash
# 1. Migration applied cleanly
docker compose exec backend alembic upgrade head
docker compose exec backend alembic current
# Expected: a1b2c3d4e5f6 (head)

# 2. Seed runs idempotently
make reset-db && make seed
make seed  # run twice — second run prints "Seed data already present — skipping."

# 3. Agency CRUD API
curl -s http://localhost:8000/api/agencies/ | python3 -m json.tool
# Expected: array with VA, CMS, SEC after seed

curl -s -X POST http://localhost:8000/api/agencies/ \
  -H "Content-Type: application/json" \
  -d '{"name":"FEMA","description":"Federal Emergency Management Agency"}' | python3 -m json.tool
# Expected: 201 with id, name, description, timestamps

AGENCY_ID=$(curl -s http://localhost:8000/api/agencies/ | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
curl -s http://localhost:8000/api/agencies/$AGENCY_ID | python3 -m json.tool
curl -s -X PUT http://localhost:8000/api/agencies/$AGENCY_ID \
  -H "Content-Type: application/json" \
  -d '{"description":"Updated description"}' | python3 -m json.tool
curl -s -X DELETE http://localhost:8000/api/agencies/$AGENCY_ID
# Expected: 204 No Content

# 4. Programs carry agency in list/detail responses
curl -s http://localhost:8000/api/programs/ | python3 -m json.tool
# Expected: each program has agency_id and agency object (or null)

# 5. ON DELETE SET NULL behavior
TEMP_AGENCY_ID=$(curl -s -X POST http://localhost:8000/api/agencies/ \
  -H "Content-Type: application/json" \
  -d '{"name":"TempAgency"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
PROG_ID=$(curl -s -X POST http://localhost:8000/api/programs/ \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Temp Program\",\"agency_id\":$TEMP_AGENCY_ID}" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -s -X DELETE http://localhost:8000/api/agencies/$TEMP_AGENCY_ID
# Expected: 204
curl -s http://localhost:8000/api/programs/$PROG_ID | python3 -m json.tool
# Expected: agency_id is null, agency is null

# 6. Agency import (standalone)
# Prepare test_agencies.csv with header: name,description
# Upload and commit with entity_type="agency" — verify new agency appears

# 7. Program import with agency_name
# Prepare test_programs.csv with header: name,description,agency_name
# Row: "Import Test Program,Desc,VA"
# Upload, map columns, commit with entity_type="program"
# GET /api/programs/ and verify Import Test Program has agency.name = "VA"
# Repeat with agency_name="NonExistentAgency" — program should be created but with agency_id=null

# 8. Frontend type check
cd frontend && npx tsc --noEmit
# Expected: 0 errors

# 9. Frontend smoke test (manual)
# - /agencies: CRUD works, Import wizard with entity_type="agency" works
# - /programs: Agency column shows, Add Program form requires agency selection
# - Sidebar: "Agencies" link between "Programs" and "Functional Areas"
```

---

## Risks

1. **MissingGreenlet on program list/detail** — The most likely runtime failure. `list_programs` and `get_program` must add `selectinload(Program.agency)` before the feature is testable end-to-end. `create_program` and `update_program` also need a re-query-after-commit with selectinload if the programs route returns `ProgramResponse` (which now includes `agency`). Reference pattern: `assign_member` lines 110-118.

2. **Circular import in models** — `Agency` references `Program` (back-populate) and `Program` references `Agency`. Both use `TYPE_CHECKING` guards and string-based `relationship("Agency", ...)` / `relationship("Program", ...)` literals to avoid runtime circular imports. Do not import the actual class at module level.

3. **Migration hash collision** — The manually chosen hash `a1b2c3d4e5f6` must be unique across all files in `backend/alembic/versions/`. Run `grep -r "a1b2c3d4e5f6" backend/alembic/` before creating the file. If another migration with that revision exists, pick a different 12-char hex string.

4. **Select value coercion in ProgramFormDialog** — Radix `Select.Root` passes string values; `agency_id` is an `int` in the zod schema. Use `z.coerce.number()` (same pattern as `TeamFormDialog` uses for `functional_area_id` on line 17). Pass `String(agency.id)` as the item value, and cast back with `Number(val)` in `onValueChange`.

5. **Seed idempotency** — The current guard only checks for `FunctionalArea.name == "Engineering"`. Adding agencies before the functional area seed means agencies run on every seed invocation before the guard fires. The guard fires early enough to prevent duplication — agencies are added inside the same function body that returns early on the guard — so no change to the guard is needed. Verify by running `make seed` twice.

6. **Program import agency_name: error vs. skip** — The user requirement is "error/skip" when `agency_name` is provided but not found. The implementation above silently skips (leaves `agency_id` as null). To surface this as a preview-time error, a custom validator on the `"program"` `EntityConfig` would be needed. That requires a DB lookup at preview time, which is not the current pattern (validators are pure functions with no DB access). The commit-time silent skip is the pragmatic implementation. Document this in a code comment.

7. **`ON DELETE SET NULL` and FK constraint** — The `op.create_foreign_key` call must include `ondelete='SET NULL'` as a keyword argument. Without it, Postgres defaults to `RESTRICT` and deleting an agency that has programs will raise a 500. Verify by testing the delete scenario in validation step 5 above.
