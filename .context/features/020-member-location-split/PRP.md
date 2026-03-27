---
feature: 020-member-location-split
status: COMPLETE
complexity: MEDIUM
testing_strategy: implement-then-test
created: 2026-03-27
depends_on: 018-member-name-split
---

# PRP: Member Location Split (city + state)

## Problem Statement

The `TeamMember` entity stores a single `location` VARCHAR(255) column. The import source provides city and state as two separate columns, requiring a string-join workaround today. Splitting storage into `city` and `state` columns enables clean import mapping, and allows display code to compose them with the standard `"City, ST"` pattern while keeping the visual result identical. Neither city nor state should be required — both are nullable.

## Solution Overview

1. Add an Alembic migration that drops `location`, adds `city` (nullable) and `state` (nullable), and migrates existing data by splitting on the last comma in the existing `location` value (if present).
2. Update the `TeamMember` SQLAlchemy model to replace `location` with `city` and `state`.
3. Update all four Pydantic schemas in `team_member.py` to replace `location` with `city` and `state`.
4. Update `import_mapper.py` and `import_commit.py` to replace the `"location"` target field and scalar field with `"city"` and `"state"`.
5. Update the `TeamMemberList` and `MemberFormInput` TypeScript interfaces to replace `location` with `city` and `state`.
6. Update `MemberFormDialog` to replace the single Location input with a City + State row (grid-cols-2), keeping the form layout sensible.
7. Update all display callsites (`MemberCard`, `MemberDetailSheet`, `memberColumns`) to compose city and state into a single display string using `[city, state].filter(Boolean).join(', ')`.
8. Validate end-to-end.

---

## Implementation Steps

### Step 1 — Database Migration

**File to create:** `backend/alembic/versions/[new_revision]_member_location_split.py`

Choose a revision hash that does not collide with existing revisions. Existing hashes in `backend/alembic/versions/` are:
- `452ccece7038`
- `b514fc596e17`
- `c7f3a1e9b2d4` (current head)

Pick a new hex string, e.g. `d8e2f3a4c501`. Verify before writing:
```bash
grep -r "d8e2f3a4c501" /Users/clint/Workspace/team-resourcer/backend/alembic/versions/
# Must return no output
```

Standard module-level header:
```
revision = 'd8e2f3a4c501'
down_revision = 'c7f3a1e9b2d4'
branch_labels = None
depends_on = None
```

`upgrade()` must execute in this exact order:

1. Add `city` as a nullable column:
   `op.add_column('team_members', sa.Column('city', sa.String(255), nullable=True))`
2. Add `state` as a nullable column:
   `op.add_column('team_members', sa.Column('state', sa.String(100), nullable=True))`
3. Migrate data — split existing `location` values on the **last** comma. Values without a comma go entirely into `city`; `state` gets the trimmed part after the last comma:
   ```python
   op.execute("""
       UPDATE team_members
       SET
           city  = TRIM(REVERSE(SPLIT_PART(REVERSE(location), ',', 2))),
           state = TRIM(REVERSE(SPLIT_PART(REVERSE(location), ',', 1)))
       WHERE location IS NOT NULL AND location LIKE '%,%'
   """)
   op.execute("""
       UPDATE team_members
       SET city = TRIM(location)
       WHERE location IS NOT NULL AND location NOT LIKE '%,%'
   """)
   ```
   This handles "Austin, TX" → city="Austin", state="TX" and "London" → city="London", state=NULL.
4. Drop the old column:
   `op.drop_column('team_members', 'location')`

`downgrade()` reverses in order:
1. Add `location` back as nullable:
   `op.add_column('team_members', sa.Column('location', sa.String(255), nullable=True))`
2. Reconstitute from parts:
   ```python
   op.execute("""
       UPDATE team_members
       SET location = CASE
           WHEN city IS NOT NULL AND state IS NOT NULL
               THEN city || ', ' || state
           WHEN city IS NOT NULL
               THEN city
           WHEN state IS NOT NULL
               THEN state
           ELSE NULL
       END
   """)
   ```
3. Drop `state`: `op.drop_column('team_members', 'state')`
4. Drop `city`: `op.drop_column('team_members', 'city')`

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer
docker compose exec backend alembic upgrade head
docker compose exec backend alembic current
# Must show: d8e2f3a4c501 (head)

docker compose exec db psql -U postgres -d teamresourcer -c "\d team_members"
# Must show: city varchar(255) nullable, state varchar(100) nullable
# Must NOT show: location column

docker compose exec backend alembic downgrade c7f3a1e9b2d4
docker compose exec backend alembic upgrade head
# Round-trip must succeed without error
```

---

### Step 2 — Backend Model

**File to modify:** `backend/app/models/team_member.py`

Replace line 34:
```python
location: Mapped[str | None] = mapped_column(String(255), nullable=True)
```
With:
```python
city: Mapped[str | None] = mapped_column(String(255), nullable=True)
state: Mapped[str | None] = mapped_column(String(100), nullable=True)
```

No import changes are needed — `String` is already imported.

Do NOT add a `location` property on the model. The display composition belongs in the frontend and in any API response that needs it — the model layer exposes raw fields only.

**Validation:**
```bash
docker compose exec backend python -c "
from app.models.team_member import TeamMember
cols = [c.key for c in TeamMember.__table__.columns]
assert 'city' in cols
assert 'state' in cols
assert 'location' not in cols
print('model OK')
"
```

---

### Step 3 — Backend Schemas

**File to modify:** `backend/app/schemas/team_member.py`

No import changes are needed.

**`TeamMemberCreate`** — replace line 24:
```python
location: str | None = None
```
With:
```python
city: str | None = None
state: str | None = None
```

**`TeamMemberUpdate`** — replace line 56:
```python
location: str | None = None
```
With:
```python
city: str | None = None
state: str | None = None
```

**`TeamMemberListResponse`** — replace line 83:
```python
location: str | None
```
With:
```python
city: str | None
state: str | None
```

**`TeamMemberDetailResponse`** — replace line 100:
```python
location: str | None
```
With:
```python
city: str | None
state: str | None
```

**Validation:**
```bash
docker compose exec backend python -c "
from app.schemas.team_member import (
    TeamMemberCreate, TeamMemberUpdate,
    TeamMemberListResponse, TeamMemberDetailResponse,
)
tc = TeamMemberCreate(employee_id='E001', first_name='Alice', last_name='Johnson', functional_area_id=1, city='Austin', state='TX')
assert tc.city == 'Austin'
assert tc.state == 'TX'
tu = TeamMemberUpdate(city='Boston')
assert tu.city == 'Boston'
assert tu.state is None
print('schemas OK')
"
```

---

### Step 4 — Import Mapper and Commit

#### 4a — import_mapper.py

**File to modify:** `backend/app/services/import_mapper.py`

In `ENTITY_CONFIGS["member"]`, replace `"location"` in `target_fields` with `"city"` and `"state"`. The full updated `target_fields` set for the member config becomes:

```python
target_fields={
    "employee_id",
    "first_name",
    "last_name",
    "hire_date",
    "title",
    "city",
    "state",
    "email",
    "phone",
    "slack_handle",
    "salary",
    "bonus",
    "pto_used",
    "functional_area_name",
    "team_name",
    "program_name",
    "supervisor_employee_id",
    "program_role",
},
```

`required_fields`, `numeric_fields`, `dedup_field`, and `validators` are unchanged.

#### 4b — import_commit.py

**File to modify:** `backend/app/services/import_commit.py`

In the `scalar_fields` list (currently at line 295–303), replace `"location"` with `"city"` and `"state"`:

```python
scalar_fields = [
    "first_name",
    "last_name",
    "title",
    "city",
    "state",
    "email",
    "phone",
    "slack_handle",
]
```

No other changes to `import_commit.py` are needed — the `setattr` loop already handles any string field by name.

**Validation:**
```bash
docker compose exec backend python -c "
from app.services.import_mapper import ENTITY_CONFIGS
cfg = ENTITY_CONFIGS['member']
assert 'city' in cfg.target_fields
assert 'state' in cfg.target_fields
assert 'location' not in cfg.target_fields
print('import_mapper OK')
"
```

---

### Step 5 — Frontend TypeScript Types

**File to modify:** `frontend/src/types/index.ts`

In `TeamMemberList` (around line 77), replace:
```typescript
location: string | null
```
With:
```typescript
city: string | null
state: string | null
```

`TeamMember extends TeamMemberList` — no additional change needed; it inherits the updated fields.

In `MemberFormInput` (around line 117), replace:
```typescript
location?: string
```
With:
```typescript
city?: string
state?: string
```

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# Will report errors at display and form callsites until Steps 6 and 7 are done — that is expected
```

---

### Step 6 — Frontend Form (MemberFormDialog)

**File to modify:** `frontend/src/components/members/MemberFormDialog.tsx`

**Zod schema** — replace:
```typescript
location: z.string(),
```
With:
```typescript
city: z.string(),
state: z.string(),
```

**`defaultValues`** — replace:
```typescript
location: member?.location ?? '',
```
With:
```typescript
city: member?.city ?? '',
state: member?.state ?? '',
```

**Form JSX** — the current layout has Slack Handle and Location in a `grid-cols-2` row (lines 318–333). Replace that row with City + State together, and move Slack Handle into its own full-width field (or keep it paired with another field). The clearest UX groups the two related location fields together:

Replace the current block:
```tsx
<div className="grid grid-cols-2 gap-3">
  <Field label="Slack Handle" error={errors.slack_handle?.message}>
    <input
      {...register('slack_handle')}
      className={inputCls}
      placeholder="@handle"
    />
  </Field>
  <Field label="Location" error={errors.location?.message}>
    <input
      {...register('location')}
      className={inputCls}
      placeholder="City, Country"
    />
  </Field>
</div>
```

With:
```tsx
<div className="grid grid-cols-2 gap-3">
  <Field label="City" error={errors.city?.message}>
    <input
      {...register('city')}
      className={inputCls}
      placeholder="Austin"
    />
  </Field>
  <Field label="State" error={errors.state?.message}>
    <input
      {...register('state')}
      className={inputCls}
      placeholder="TX"
    />
  </Field>
</div>

<Field label="Slack Handle" error={errors.slack_handle?.message}>
  <input
    {...register('slack_handle')}
    className={inputCls}
    placeholder="@handle"
  />
</Field>
```

This keeps City and State visually adjacent (they are semantically one concept), and Slack Handle moves to a full-width field below — a reasonable trade-off.

**`onSubmit` — update payload** in both the `updateMember.mutateAsync` call and the `createMember.mutateAsync` call. Replace:
```typescript
location: values.location || undefined,
```
With:
```typescript
city: values.city || undefined,
state: values.state || undefined,
```

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# Will still report errors in display components until Step 7 is done
```

---

### Step 7 — Frontend Display Components

All three display components reference `member.location`. Replace each with a composed display string using `[member.city, member.state].filter(Boolean).join(', ')`.

#### 7a — MemberCard

**File to modify:** `frontend/src/components/members/MemberCard.tsx`

Replace lines 112–118:
```tsx
{member.location && (
  <div className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400">
    <MapPin className="h-3 w-3 flex-shrink-0" />
    <span className="truncate">{member.location}</span>
  </div>
)}
```
With:
```tsx
{(member.city || member.state) && (
  <div className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400">
    <MapPin className="h-3 w-3 flex-shrink-0" />
    <span className="truncate">
      {[member.city, member.state].filter(Boolean).join(', ')}
    </span>
  </div>
)}
```

#### 7b — MemberDetailSheet

**File to modify:** `frontend/src/components/members/MemberDetailSheet.tsx`

Replace lines 133–138:
```tsx
{member.location && (
  <div className="flex items-center gap-2 text-sm text-slate-700">
    <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
    <span>{member.location}</span>
  </div>
)}
```
With:
```tsx
{(member.city || member.state) && (
  <div className="flex items-center gap-2 text-sm text-slate-700">
    <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
    <span>{[member.city, member.state].filter(Boolean).join(', ')}</span>
  </div>
)}
```

#### 7c — memberColumns

**File to modify:** `frontend/src/components/members/memberColumns.tsx`

The Location column currently uses `accessorKey: 'location'` (lines 97–109). Replace the entire column definition with one that composes from `city` and `state`:

Replace:
```tsx
{
  id: 'location',
  accessorKey: 'location',
  header: 'Location',
  enableSorting: true,
  cell: ({ getValue }) => {
    const val = getValue() as string | null
    return val ? (
      <span className="text-sm text-slate-700">{val}</span>
    ) : (
      <span className="text-slate-400">—</span>
    )
  },
},
```
With:
```tsx
{
  id: 'location',
  accessorFn: (row) => [row.city, row.state].filter(Boolean).join(', '),
  header: 'Location',
  enableSorting: true,
  cell: ({ getValue }) => {
    const val = getValue() as string
    return val ? (
      <span className="text-sm text-slate-700">{val}</span>
    ) : (
      <span className="text-slate-400">—</span>
    )
  },
},
```

Using `accessorFn` means TanStack Table sorts on the composed string, which is the correct behavior for a display-only column.

**Validation after all 7a–7c changes:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# Must pass with 0 errors
```

---

### Step 8 — API Route Smoke Test

No route files require changes. Verify the full API round-trip:

```bash
# Start with clean state
cd /Users/clint/Workspace/team-resourcer
make reset-db && make seed

# List members — must have city, state fields; must NOT have location field
curl -s http://localhost:8000/api/members/ | python3 -m json.tool
# Each member object: "city": null, "state": null — no "location" key

# Create member with city + state
curl -s -X POST http://localhost:8000/api/members/ \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"E099","first_name":"Test","last_name":"User","functional_area_id":1,"city":"Austin","state":"TX"}' \
  | python3 -m json.tool
# Must return 201 with "city": "Austin", "state": "TX"

MEMBER_UUID=$(curl -s http://localhost:8000/api/members/ \
  | python3 -c "import sys,json; print(next(m['uuid'] for m in json.load(sys.stdin) if m['employee_id']=='E099'))")

# Detail view
curl -s http://localhost:8000/api/members/$MEMBER_UUID | python3 -m json.tool
# Must include "city": "Austin", "state": "TX"

# Partial update — city only
curl -s -X PUT http://localhost:8000/api/members/$MEMBER_UUID \
  -H "Content-Type: application/json" \
  -d '{"city":"Boston"}' | python3 -m json.tool
# city: "Boston", state still "TX" (exclude_unset=True preserves unchanged fields)

# Cleanup
curl -s -X DELETE http://localhost:8000/api/members/$MEMBER_UUID
# 204 No Content
```

---

### Step 9 — Tests

**Strategy:** implement-then-test (per CLAUDE.md).

#### 9a — Backend: Import mapper field set

**File to modify or create:** `backend/tests/test_import_mapper.py`

Add or extend test cases for the member `EntityConfig`:
- `"city"` and `"state"` are in `target_fields`
- `"location"` is NOT in `target_fields` — mapping a column to `"location"` raises `ValueError` from `apply_mapping`
- A row with `city="Austin"` and `state="TX"` passes validation (no errors)
- A row with neither `city` nor `state` also passes (both are optional — not in `required_fields`)

Run with:
```bash
cd /Users/clint/Workspace/team-resourcer/backend && python -m pytest tests/test_import_mapper.py -v
```

#### 9b — Backend: Migration data split

**File to modify or create:** `backend/tests/test_migrations.py`

Because the data migration uses Postgres-specific `LIKE '%,%'` and string operations, test the migration SQL logic directly against the running Postgres container rather than in-memory SQLite.

Write a pytest test (marked `@pytest.mark.integration` or simply run against the compose DB) that:
1. Inserts a row with `location = "Austin, TX"` into `team_members` (before the migration runs — or test the SQL expressions directly via `op.get_bind()` in a separate helper).
2. Verifies that after running the split expressions, `city = "Austin"` and `state = "TX"`.
3. Inserts a row with `location = "London"` (no comma).
4. Verifies `city = "London"` and `state` is NULL.
5. Inserts a row with `location = "New York, New York, NY"` (multiple commas — last comma split should yield city="New York, New York" and state="NY").

Note: the REVERSE/SPLIT_PART approach in the migration splits on the last comma. Verify the multi-comma case works as expected before committing the migration.

Run with:
```bash
cd /Users/clint/Workspace/team-resourcer/backend && python -m pytest tests/test_migrations.py -v -k "location"
```

---

## File Manifest

| File | Action |
|---|---|
| `backend/alembic/versions/d8e2f3a4c501_member_location_split.py` | CREATE |
| `backend/app/models/team_member.py` | MODIFY — replace `location` column with `city` + `state` |
| `backend/app/schemas/team_member.py` | MODIFY — all four schemas |
| `backend/app/services/import_mapper.py` | MODIFY — replace `"location"` with `"city"` and `"state"` in member `target_fields` |
| `backend/app/services/import_commit.py` | MODIFY — `scalar_fields` list |
| `frontend/src/types/index.ts` | MODIFY — `TeamMemberList` and `MemberFormInput` |
| `frontend/src/components/members/MemberFormDialog.tsx` | MODIFY — schema, defaultValues, JSX fields, submit payload |
| `frontend/src/components/members/MemberCard.tsx` | MODIFY — location display |
| `frontend/src/components/members/MemberDetailSheet.tsx` | MODIFY — location display |
| `frontend/src/components/members/memberColumns.tsx` | MODIFY — location column definition |
| `backend/tests/test_import_mapper.py` | CREATE or MODIFY |
| `backend/tests/test_migrations.py` | CREATE or MODIFY |

---

## Validation Criteria (Full End-to-End)

```bash
# 1. Migration clean
cd /Users/clint/Workspace/team-resourcer
docker compose exec backend alembic upgrade head
docker compose exec backend alembic current
# Expected: d8e2f3a4c501 (head)

# 2. DB schema correct
docker compose exec db psql -U postgres -d teamresourcer -c "\d team_members"
# city varchar(255) nullable
# state varchar(100) nullable
# location column must NOT appear

# 3. Migration round-trip
docker compose exec backend alembic downgrade c7f3a1e9b2d4
docker compose exec backend alembic upgrade head
# No errors

# 4. Seed works
make reset-db && make seed
# Exits cleanly; no schema errors

# 5. API returns new fields, not old
curl -s http://localhost:8000/api/members/ | python3 -m json.tool
# All members: "city": null, "state": null — no "location" key present

# 6. Create with city + state
curl -s -X POST http://localhost:8000/api/members/ \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"E998","first_name":"Jane","last_name":"Doe","functional_area_id":1,"city":"Austin","state":"TX"}' \
  | python3 -m json.tool
# "city": "Austin", "state": "TX"

# 7. Update city only (exclude_unset=True must preserve state)
UUID=$(curl -s http://localhost:8000/api/members/ \
  | python3 -c "import sys,json; print(next(m['uuid'] for m in json.load(sys.stdin) if m['employee_id']=='E998'))")
curl -s -X PUT http://localhost:8000/api/members/$UUID \
  -H "Content-Type: application/json" \
  -d '{"city":"Boston"}' | python3 -m json.tool
# city: "Boston", state still "TX"

# Cleanup
curl -s -X DELETE http://localhost:8000/api/members/$UUID

# 8. TypeScript type check
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# 0 errors

# 9. Backend tests
cd /Users/clint/Workspace/team-resourcer/backend && python -m pytest tests/test_import_mapper.py -v
# All pass

# 10. Manual smoke
# /members card view: "Austin, TX" appears under MapPin icon; single-part values like "London" show without trailing comma
# /members table view: Location column shows composed string or — for nulls
# Detail sheet: Contact section shows "Austin, TX" under MapPin
# Add Member form: City + State side by side (grid-cols-2), Slack Handle below as full-width
# Edit Member form: City + State pre-populate from existing member data
# Import: member CSV with "city" and "state" columns maps and commits correctly
# Import: member CSV with a "location" column fails at preview with "Unknown target field: location"
```

---

## Risks

1. **Multi-comma location values in data migration** — The REVERSE/SPLIT_PART strategy splits on the last comma, which is correct for "Austin, TX" but produces city="New York, New York", state="NY" for "New York, New York, NY". This is the desired behavior. Validate this with the test in Step 9b before shipping the migration.

2. **No seed data has location values** — The three seed members have `location = NULL` after the feature 018 migration. The data migration SQL will no-op on them. There is no risk of bad splits from seed data, but also no way to test the data migration via seed. Use the test in Step 9b or insert test rows manually to verify.

3. **`memberColumns` `accessorFn` vs `accessorKey`** — Switching from `accessorKey: 'location'` to `accessorFn` means TanStack Table no longer has a direct column accessor for filtering via `column.getFilterValue()`. If `MembersPage` uses column-level filtering (not just the top-level search), verify the filter still works after this change. The table view currently uses a global search in `MembersPage.tsx` (filtering on member names), not column-level filters, so this should be safe — but confirm by grepping for `getFilterValue` or `setFilterValue`:
   ```bash
   grep -r "FilterValue\|columnFilter" /Users/clint/Workspace/team-resourcer/frontend/src/
   ```

4. **`import_commit.py` scalar_fields** — The `setattr` loop applies every field in `scalar_fields` via `str(val)` conversion. Both `city` and `state` are `str | None` on the model. Since the loop only sets a field when `val is not None and val != ""`, empty strings from the import CSV will not overwrite existing values with blank strings — this is the correct behavior and is consistent with how other optional fields are handled.

5. **Existing imports in progress** — Any in-flight import session created before this deployment that has `"location"` mapped as a target field will receive an `apply_mapping` `ValueError` on commit after deployment. This is unavoidable without backward compatibility. Sessions are short-lived (TTL-based), so the blast radius is limited to active import wizard sessions at the moment of deployment.

6. **`MemberFormInput.location` removal** — `MemberFormInput` is consumed by `useCreateMember` and `useUpdateMember` hooks. If either hook manually constructs its request body from `MemberFormInput` fields (rather than spreading the object), the `location` key reference will cause a TypeScript error. Verify by running `npx tsc --noEmit` after Step 5 — all such errors will surface as type errors before Step 6 is needed.
