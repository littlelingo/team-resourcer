---
feature: 018-member-name-split
status: APPROVED
complexity: MEDIUM
testing_strategy: implement-then-test
created: 2026-03-26
depends_on: 017-program-agency
---

# PRP: Member Name Split + Hire Date

## Problem Statement

The `TeamMember` entity stores a single `name` column. The codebase needs this split into `first_name` + `last_name` so names are addressable individually, and a new `hire_date` (Date, nullable) field to track when a member joined. Every layer that touches `name` must be updated: DB, migration, schemas, services, seed, import, frontend types, form, display components, and search.

## Solution Overview

1. Add a new Alembic migration that drops `name`, adds `first_name`/`last_name` (NOT NULL), and adds `hire_date` (Date, nullable). Because only seed data exists, migrate existing data with a simple split-on-space strategy inside the migration `upgrade()`.
2. Update the `TeamMember` SQLAlchemy model to reflect the new columns.
3. Update all Pydantic schemas. Response schemas expose `first_name`, `last_name`, and `hire_date`. A computed `name` property (derived as `f"{first_name} {last_name}"`) is added as a `@property` on the model to avoid breaking the `name` attribute access pattern in seed print statements — but schemas do NOT include a serialized `name` field; callers derive the display name from the two fields.
4. Update `create_member` and `update_member` service functions to accept `first_name`/`last_name` instead of `name`.
5. Update seed data to pass split names and no `hire_date` (it is optional).
6. Update import mapper and commit to accept `first_name`/`last_name` as target fields (both required), `hire_date` as optional.
7. Update `MemberFormInput` TypeScript type: remove `name`, add `first_name`, `last_name`, `hire_date`.
8. Update `TeamMemberList` and `TeamMember` TS interfaces: remove `name`, add `first_name`, `last_name`, `hire_date`.
9. Update `getInitials` in `member-utils.ts` to accept `(firstName: string, lastName: string)` and derive initials from the first char of each.
10. Update `MemberFormDialog` zod schema, form fields (split Name into First/Last in the same 2-col grid; add Hire Date below), and submit payload.
11. Update all display callsites (`MemberCard`, `memberColumns`, `MemberDetailSheet`, `MembersPage` search) to use `first_name + " " + last_name` as the display name.
12. Update supervisor options label in `MemberFormDialog` to use combined name.
13. Add tests for `getInitials` and the migration data-split logic.

---

## Implementation Steps

### Step 1 — Database Migration

**File to create:** `backend/alembic/versions/c7f3a1e9b2d4_member_name_split_and_hire_date.py`

The revision hash `c7f3a1e9b2d4` must not collide with existing revisions. Verify before creating:
```bash
grep -r "c7f3a1e9b2d4" /Users/clint/Workspace/team-resourcer/backend/alembic/versions/
# Must return no output
```

Standard module-level header:
```
revision = 'c7f3a1e9b2d4'
down_revision = 'b514fc596e17'
branch_labels = None
depends_on = None
```

`upgrade()` must:
1. Add `first_name` as a **nullable** column initially (required to fill it before setting NOT NULL):
   `op.add_column('team_members', sa.Column('first_name', sa.String(255), nullable=True))`
2. Add `last_name` as nullable:
   `op.add_column('team_members', sa.Column('last_name', sa.String(255), nullable=True))`
3. Add `hire_date` as nullable (final state — stays nullable):
   `op.add_column('team_members', sa.Column('hire_date', sa.Date(), nullable=True))`
4. Migrate data — split existing `name` on the first space:
   ```python
   op.execute("""
       UPDATE team_members
       SET
           first_name = SPLIT_PART(name, ' ', 1),
           last_name  = NULLIF(TRIM(SUBSTRING(name FROM POSITION(' ' IN name) + 1)), '')
   """)
   ```
   This handles single-word names by leaving `last_name` NULL. Immediately after, patch any NULL `last_name` to `''` (empty string) so the NOT NULL constraint can be applied — or use a fallback:
   ```python
   op.execute("""
       UPDATE team_members SET last_name = '' WHERE last_name IS NULL
   """)
   ```
5. Alter `first_name` to NOT NULL: `op.alter_column('team_members', 'first_name', nullable=False)`
6. Alter `last_name` to NOT NULL: `op.alter_column('team_members', 'last_name', nullable=False)`
7. Drop the old column: `op.drop_column('team_members', 'name')`

`downgrade()` reverses in order:
1. Add `name` back as nullable: `op.add_column('team_members', sa.Column('name', sa.String(255), nullable=True))`
2. Reconstitute name from parts: `op.execute("UPDATE team_members SET name = TRIM(first_name || ' ' || last_name)")`
3. Alter `name` to NOT NULL: `op.alter_column('team_members', 'name', nullable=False)`
4. Drop `hire_date`: `op.drop_column('team_members', 'hire_date')`
5. Drop `last_name`: `op.drop_column('team_members', 'last_name')`
6. Drop `first_name`: `op.drop_column('team_members', 'first_name')`

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer
docker compose exec backend alembic upgrade head
docker compose exec backend alembic current
# Must show: c7f3a1e9b2d4 (head)
docker compose exec db psql -U postgres -d teamresourcer -c "\d team_members"
# Must show: first_name varchar(255) NOT NULL, last_name varchar(255) NOT NULL,
#            hire_date date nullable — and NO name column
docker compose exec backend alembic downgrade b514fc596e17
docker compose exec backend alembic upgrade head
# Round-trip must succeed without error
```

---

### Step 2 — Backend Model

**File to modify:** `backend/app/models/team_member.py`

Replace line 30:
```python
name: Mapped[str] = mapped_column(String(255), nullable=False)
```
With:
```python
first_name: Mapped[str] = mapped_column(String(255), nullable=False)
last_name: Mapped[str] = mapped_column(String(255), nullable=False)
hire_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
```

Add `date` and `Date` to imports. The top import block already has `datetime` from `datetime`; add `date` alongside it:
```python
from datetime import date, datetime
```
Add `Date` to the SQLAlchemy import line alongside existing `DateTime, ForeignKey, Numeric, String`:
```python
from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
```

Add a `@property` after the column definitions (before the relationships block) that provides a computed display name. This keeps seed print statements (`alice.name`) working without a separate column:
```python
@property
def name(self) -> str:
    return f"{self.first_name} {self.last_name}".strip()
```

**Validation:**
```bash
docker compose exec backend python -c "
from app.models.team_member import TeamMember
m = TeamMember.__new__(TeamMember)
m.first_name = 'Alice'
m.last_name = 'Johnson'
assert m.name == 'Alice Johnson'
print('model OK')
"
```

---

### Step 3 — Backend Schemas

**File to modify:** `backend/app/schemas/team_member.py`

Add `date` to the imports at the top:
```python
from datetime import date, datetime
```

**`TeamMemberCreate`:** Replace `name: str` with:
```python
first_name: str
last_name: str
hire_date: date | None = None
```
Remove the `name: str` field entirely. The `employee_id_not_empty` validator stays unchanged.

**`TeamMemberUpdate`:** Replace `name: str | None = None` with:
```python
first_name: str | None = None
last_name: str | None = None
hire_date: date | None = None
```

**`TeamMemberListResponse`:** Replace `name: str` with:
```python
first_name: str
last_name: str
```
Do NOT add `hire_date` here — the list projection stays lightweight.

**`TeamMemberDetailResponse`:** Replace `name: str` with:
```python
first_name: str
last_name: str
hire_date: date | None
```

**Validation:**
```bash
docker compose exec backend python -c "
from app.schemas.team_member import (
    TeamMemberCreate, TeamMemberUpdate,
    TeamMemberListResponse, TeamMemberDetailResponse
)
tc = TeamMemberCreate(employee_id='E001', first_name='Alice', last_name='Johnson', functional_area_id=1)
assert tc.first_name == 'Alice'
tu = TeamMemberUpdate(first_name='Bob')
assert tu.first_name == 'Bob'
print('schemas OK')
"
```

---

### Step 4 — Backend Services

**File to modify:** `backend/app/services/member_service.py`

This file contains `create_member` and `update_member`. Both pass `data.model_dump(...)` fields to set attributes on `TeamMember`.

In `create_member`: wherever the member is constructed with `name=data.name`, replace with `first_name=data.first_name, last_name=data.last_name`. If the constructor uses `**data.model_dump(...)`, it will pick up the new fields automatically — verify this is the case by reading the file before editing. Also ensure `hire_date` is included in the fields passed to the model (it will be via the dict if the schema includes it).

In `update_member`: if it iterates `model_dump(exclude_unset=True)` and `setattr`s each field, no change is needed — `first_name`, `last_name`, and `hire_date` will flow through automatically. However, remove any explicit reference to `name` as a field name if one exists (e.g., in a `scalar_fields` list or similar enumeration). Cross-check that the service does not have a `_FINANCIAL_FIELDS` guard that needs updating — `hire_date` is not a financial field and should not trigger history.

**File to check:** `backend/app/services/import_supervisor.py`

This file resolves supervisor FKs in the second pass of member import. It likely references `member.name` for logging. Update any such references to use `f"{member.first_name} {member.last_name}"` or `member.name` (via the property on the model, which now works).

**Validation:**
```bash
docker compose exec backend python -c "
from app.services.member_service import create_member, update_member
print('member_service imports OK')
"
```

---

### Step 5 — Backend Seed Data

**File to modify:** `backend/app/seed.py`

`TeamMemberCreate` calls currently pass `name="Alice Johnson"`. Replace each with `first_name` / `last_name` splits. Change all three member creations:

```python
# E001
TeamMemberCreate(
    employee_id="E001",
    first_name="Alice",
    last_name="Johnson",
    title="Staff Engineer",
    ...
)

# E002
TeamMemberCreate(
    employee_id="E002",
    first_name="Bob",
    last_name="Smith",
    title="Senior Engineer",
    ...
)

# E003
TeamMemberCreate(
    employee_id="E003",
    first_name="Carol",
    last_name="Williams",
    title="Senior Product Manager",
    ...
)
```

Leave `hire_date` absent from all three (it is nullable and optional — no seed value needed).

The `alice.name`, `bob.name`, and `carol.name` references in the print statements continue to work via the model `@property` added in Step 2.

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer
make reset-db
make seed
# Must print:
#   Created TeamMember: Alice Johnson (uuid=...)
#   Created TeamMember: Bob Smith (uuid=...)
#   Created TeamMember: Carol Williams (uuid=...)
#   Seed complete.
docker compose exec db psql -U postgres -d teamresourcer \
  -c "SELECT employee_id, first_name, last_name, hire_date FROM team_members;"
# Must show 3 rows with split names and NULL hire_date
```

---

### Step 6 — Backend Import Support

**File to modify:** `backend/app/services/import_mapper.py`

In `ENTITY_CONFIGS["member"]`:

Replace `"name"` with `"first_name"` and `"last_name"` in `target_fields`:
```python
"member": EntityConfig(
    target_fields={
        "employee_id",
        "first_name",
        "last_name",
        "hire_date",
        "title",
        "location",
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
    required_fields={"employee_id", "first_name", "last_name"},
    numeric_fields={"salary", "bonus", "pto_used"},
    dedup_field="employee_id",
    validators=[_validate_email],
),
```

Add a `_validate_hire_date` validator function before `ENTITY_CONFIGS`:
```python
def _validate_hire_date(data: dict[str, Any], errors: list[str]) -> None:
    val = data.get("hire_date")
    if val and val != "":
        try:
            from datetime import date as _date
            _date.fromisoformat(str(val))
        except ValueError:
            errors.append(f"'hire_date' must be ISO date format (YYYY-MM-DD), got '{val}'.")
```

Add `_validate_hire_date` to the `validators` list in the `"member"` `EntityConfig` alongside `_validate_email`.

**File to modify:** `backend/app/services/import_commit.py`

In `_commit_members`, update the section that constructs a new member:

Replace:
```python
member = TeamMember(
    employee_id=emp_id,
    name=str(data.get("name", "")),
    functional_area_id=functional_area_id,
)
```
With:
```python
member = TeamMember(
    employee_id=emp_id,
    first_name=str(data.get("first_name", "")),
    last_name=str(data.get("last_name", "")),
    functional_area_id=functional_area_id,
)
```

In the `scalar_fields` list that follows (used for update via `setattr`), replace `"name"` with `"first_name"` and `"last_name"`:
```python
scalar_fields = ["first_name", "last_name", "title", "location", "email", "phone", "slack_handle"]
```

Add `hire_date` resolution after the scalar fields loop:
```python
hire_date_val = data.get("hire_date")
if hire_date_val and hire_date_val != "":
    try:
        from datetime import date as _date
        member.hire_date = _date.fromisoformat(str(hire_date_val))
    except ValueError:
        pass  # Already caught at preview validation stage
```

**Validation:**
```bash
docker compose exec backend python -c "
from app.services.import_mapper import ENTITY_CONFIGS
cfg = ENTITY_CONFIGS['member']
assert 'first_name' in cfg.target_fields
assert 'last_name' in cfg.target_fields
assert 'hire_date' in cfg.target_fields
assert 'name' not in cfg.target_fields
assert cfg.required_fields == {'employee_id', 'first_name', 'last_name'}
print('import_mapper OK')
"
```

---

### Step 7 — Frontend TypeScript Types

**File to modify:** `frontend/src/types/index.ts`

In `TeamMemberList` (lines 77–88), replace `name: string` with:
```typescript
first_name: string
last_name: string
```
Do not add `hire_date` here — the list projection matches `TeamMemberListResponse`.

In `TeamMember extends TeamMemberList` (lines 90–105), add after `pto_used`:
```typescript
hire_date: string | null
```
(Date values arrive as ISO strings from the JSON response.)

In `MemberFormInput` (lines 109–123), replace `name: string` with:
```typescript
first_name: string
last_name: string
hire_date?: string
```

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# Must pass with 0 errors (other steps will add more errors until complete)
```

---

### Step 8 — Frontend Member Utility

**File to modify:** `frontend/src/lib/member-utils.ts`

Replace the current single-argument `getInitials(name: string)` signature with a two-argument version:
```typescript
export function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim()
  const last = lastName.trim()
  if (!first && !last) return '?'
  if (!last) return first.slice(0, 2).toUpperCase()
  return (first[0] + last[0]).toUpperCase()
}
```

This is a breaking change — all existing callsites pass `member.name` (a single string). Each callsite must be updated in subsequent steps to pass `member.first_name, member.last_name` instead.

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# Will fail until all callsites are updated — check after Steps 9 and 10
```

---

### Step 9 — Frontend Display Components

All display components that reference `member.name` or call `getInitials(member.name)` must be updated to use `first_name` and `last_name`.

#### 9a — MemberCard

**File to modify:** `frontend/src/components/members/MemberCard.tsx`

Line 21: `getInitials(member.name)` → `getInitials(member.first_name, member.last_name)`

The Avatar `alt` attribute and the `<h3>` name display:
- `alt={member.name}` → `alt={`${member.first_name} ${member.last_name}`}`
- `{member.name}` in the `<h3>` → `` {`${member.first_name} ${member.last_name}`} ``

#### 9b — memberColumns

**File to modify:** `frontend/src/components/members/memberColumns.tsx`

Line 35: `getInitials(member.name)` → `getInitials(member.first_name, member.last_name)`

The `accessorKey: 'name'` on the `"member"` column is used for sorting. Since `name` no longer exists on the type, change to `accessorKey: 'last_name'` (or use `accessorFn`) for sort. Update:
- `accessorKey: 'name'` → `accessorFn: (row) => \`${row.last_name}, ${row.first_name}\`` (sorts by last name)
- `alt={member.name}` → `` alt={`${member.first_name} ${member.last_name}`} ``
- `{member.name}` in the bold name `<p>` → `` {`${member.first_name} ${member.last_name}`} ``

#### 9c — MemberDetailSheet

**File to modify:** `frontend/src/components/members/MemberDetailSheet.tsx`

Line 40: `getInitials(member.name)` → `getInitials(member.first_name, member.last_name)`

Line 87 avatar `alt`: `alt={member.name}` → `` alt={`${member.first_name} ${member.last_name}`} ``

Line 95 display name `<h2>`: `{member.name}` → `` {`${member.first_name} ${member.last_name}`} ``

Add a `hire_date` row in the Organization section (after the existing fields, before the closing `</div>`). Add it only when `member.hire_date` is present:
```tsx
{member.hire_date && (
  <div className="flex items-center justify-between">
    <span className="text-slate-500">Hire Date</span>
    <span>{member.hire_date}</span>
  </div>
)}
```

#### 9d — MembersPage search

**File to modify:** `frontend/src/pages/MembersPage.tsx`

In the `filteredMembers` `useMemo` (lines 83–92), replace:
```typescript
m.name.toLowerCase().includes(q)
```
With:
```typescript
`${m.first_name} ${m.last_name}`.toLowerCase().includes(q)
```

**Validation after all 9a–9d changes:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# Must pass with 0 errors
```

---

### Step 10 — Frontend MemberFormDialog

**File to modify:** `frontend/src/components/members/MemberFormDialog.tsx`

This is the most involved frontend change.

**Zod schema (`memberFormSchema`):** Replace `name: z.string().min(1, 'Name is required')` with:
```typescript
first_name: z.string().min(1, 'First name is required'),
last_name: z.string().min(1, 'Last name is required'),
hire_date: z.string().optional(),
```

**`MemberFormValues` type** is inferred from the schema — no manual change needed.

**`defaultValues` in `useForm`:** Replace `name: member?.name ?? ''` with:
```typescript
first_name: member?.first_name ?? '',
last_name: member?.last_name ?? '',
hire_date: member?.hire_date ?? '',
```

**`useEffect` reset** (the one triggered by `[open, member]` that calls `reset()`): Update similarly — add `first_name`, `last_name`, `hire_date`; remove `name`.

**Supervisor options label:** In the `supervisorOptions` map (line 193):
```typescript
.map((m) => ({ value: m.uuid, label: m.name }))
```
Change to:
```typescript
.map((m) => ({ value: m.uuid, label: `${m.first_name} ${m.last_name}` }))
```

**Form JSX — Name fields:**

The current 2-col grid has Employee ID + Name. Replace the single Name field with First Name + Last Name, keeping Employee ID in the same 2-col grid. The layout becomes a 3-field section:
- Row 1 (2-col): Employee ID + First Name
- Row 2 (full width or 2-col): Last Name (alone, or paired with something)

Simplest approach that matches the existing grid pattern — change the 2-col grid to contain Employee ID and First Name, then add Last Name as a standalone field immediately below:

```tsx
{/* Basic info */}
<div className="grid grid-cols-2 gap-3">
  <Field label="Employee ID" required error={errors.employee_id?.message}>
    <input
      {...register('employee_id')}
      className={inputCls}
      placeholder="EMP-001"
    />
  </Field>
  <Field label="First Name" required error={errors.first_name?.message}>
    <input
      {...register('first_name')}
      className={inputCls}
      placeholder="First name"
    />
  </Field>
</div>

<Field label="Last Name" required error={errors.last_name?.message}>
  <input
    {...register('last_name')}
    className={inputCls}
    placeholder="Last name"
  />
</Field>
```

**Form JSX — Hire Date field:**

Add after the Last Name field and before the Title field:
```tsx
<Field label="Hire Date" error={errors.hire_date?.message}>
  <input
    {...register('hire_date')}
    type="date"
    className={inputCls}
  />
</Field>
```
Using `type="date"` renders a native date picker that returns values in `YYYY-MM-DD` format, matching the backend `date` type. No third-party date picker is needed.

**Submit payload — `onSubmit` function:**

In the `updateMember.mutateAsync` call, replace `name: values.name` with:
```typescript
first_name: values.first_name,
last_name: values.last_name,
hire_date: values.hire_date || undefined,
```

In the `createMember.mutateAsync` call, replace `name: values.name` with the same three fields.

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# Must pass with 0 errors
# With backend running:
# Open /members → Add Member
# - "Employee ID" + "First Name" side by side
# - "Last Name" below
# - "Hire Date" date picker below Last Name
# - "Title" below Hire Date (unchanged)
# Fill all required fields, submit → member appears in list with combined name
# Open Edit on an existing member → fields pre-populate correctly
```

---

### Step 11 — API Route Smoke Test

No route files require changes (routes delegate to service layer and return schema-serialized responses). However, verify the full API round-trip after all backend steps:

**Validation:**
```bash
# After make reset-db && make seed:
curl -s http://localhost:8000/api/members/ | python3 -m json.tool
# Each member must have first_name, last_name, hire_date=null and NO name field

curl -s -X POST http://localhost:8000/api/members/ \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"E099","first_name":"Test","last_name":"User","functional_area_id":1}' \
  | python3 -m json.tool
# Must return 201 with first_name="Test", last_name="User"

MEMBER_UUID=$(curl -s http://localhost:8000/api/members/ \
  | python3 -c "import sys,json; print(next(m['uuid'] for m in json.load(sys.stdin) if m['employee_id']=='E099'))")
curl -s http://localhost:8000/api/members/$MEMBER_UUID | python3 -m json.tool
# Must include hire_date: null

curl -s -X PUT http://localhost:8000/api/members/$MEMBER_UUID \
  -H "Content-Type: application/json" \
  -d '{"hire_date":"2026-01-15"}' | python3 -m json.tool
# Must return updated member with hire_date: "2026-01-15"

curl -s -X DELETE http://localhost:8000/api/members/$MEMBER_UUID
# 204 No Content
```

---

### Step 12 — Tests

**Strategy:** implement-then-test (per CLAUDE.md).

#### 12a — Backend: Import mapper validation

**File to modify or create:** `backend/tests/test_import_mapper.py` (create if it does not exist; check with `ls backend/tests/`)

Add test cases for the updated member `EntityConfig`:
- `"name"` is NOT in `target_fields` — mapping a column to `"name"` raises `ValueError`
- `"first_name"` and `"last_name"` ARE in `target_fields`
- `"hire_date"` is in `target_fields`
- Required fields validation: row missing `first_name` or `last_name` produces an error row

Add test for `_validate_hire_date`:
- Valid ISO date `"2026-01-15"` produces no errors
- Invalid value `"not-a-date"` produces an error with message containing `'hire_date'`

#### 12b — Frontend: getInitials

**File to modify or create:** `frontend/src/lib/member-utils.test.ts` (create if it does not exist)

Test cases for the new two-argument `getInitials(firstName, lastName)`:
- `getInitials("Alice", "Johnson")` → `"AJ"`
- `getInitials("Bob", "Smith")` → `"BS"`
- `getInitials("Carol", "")` → `"CA"` (first 2 chars of first name when last is empty)
- `getInitials("", "")` → `"?"`
- `getInitials("  Alice  ", "  Johnson  ")` → `"AJ"` (trimmed)

Run with:
```bash
cd /Users/clint/Workspace/team-resourcer/frontend && npx vitest run src/lib/member-utils.test.ts
```

#### 12c — Backend: Migration data split

**File to modify or create:** `backend/tests/test_migrations.py` (create if it does not exist)

Using the aiosqlite in-memory pattern (reference `planning_sqlite_test_db.md`), or alternatively using the live Postgres test DB, verify the split logic:
- Insert a row with `name = "Alice Johnson"` into a temporary structure
- Run the SPLIT_PART SQL
- Assert `first_name = "Alice"`, `last_name = "Johnson"`
- Insert a row with `name = "Madonna"` (single word)
- Assert `first_name = "Madonna"`, `last_name = ""`

Note: SQLite does not support `SPLIT_PART`. If the test DB is SQLite, test the Python equivalent logic or mark this as a Postgres-only integration test using `pytest.mark.integration` and skip in CI if only SQLite is available.

Run with:
```bash
cd /Users/clint/Workspace/team-resourcer/backend && python -m pytest tests/test_migrations.py -v
```

---

## File Manifest

| File | Action |
|---|---|
| `backend/alembic/versions/c7f3a1e9b2d4_member_name_split_and_hire_date.py` | CREATE |
| `backend/app/models/team_member.py` | MODIFY — replace `name` column, add `first_name`/`last_name`/`hire_date`, add `name` property |
| `backend/app/schemas/team_member.py` | MODIFY — all four schemas |
| `backend/app/services/member_service.py` | MODIFY — update field references |
| `backend/app/services/import_supervisor.py` | CHECK — update `member.name` log references if any |
| `backend/app/services/import_mapper.py` | MODIFY — member EntityConfig |
| `backend/app/services/import_commit.py` | MODIFY — `_commit_members` constructor and scalar_fields |
| `backend/app/seed.py` | MODIFY — split name args on all three TeamMemberCreate calls |
| `frontend/src/types/index.ts` | MODIFY — `TeamMemberList`, `TeamMember`, `MemberFormInput` |
| `frontend/src/lib/member-utils.ts` | MODIFY — new two-arg `getInitials` signature |
| `frontend/src/components/members/MemberCard.tsx` | MODIFY — display and initials |
| `frontend/src/components/members/memberColumns.tsx` | MODIFY — display, initials, accessorKey |
| `frontend/src/components/members/MemberDetailSheet.tsx` | MODIFY — display, initials, hire_date row |
| `frontend/src/pages/MembersPage.tsx` | MODIFY — search filter |
| `frontend/src/components/members/MemberFormDialog.tsx` | MODIFY — schema, fields, payload |
| `backend/tests/test_import_mapper.py` | CREATE or MODIFY |
| `frontend/src/lib/member-utils.test.ts` | CREATE |
| `backend/tests/test_migrations.py` | CREATE or MODIFY |

---

## Validation Criteria (Full End-to-End)

```bash
# 1. Migration clean
cd /Users/clint/Workspace/team-resourcer
docker compose exec backend alembic upgrade head
docker compose exec backend alembic current
# Expected: c7f3a1e9b2d4 (head)

# 2. DB schema correct
docker compose exec db psql -U postgres -d teamresourcer -c "\d team_members"
# first_name varchar(255) NOT NULL
# last_name varchar(255) NOT NULL
# hire_date date (nullable)
# name column must NOT appear

# 3. Seed works
make reset-db && make seed
# "Created TeamMember: Alice Johnson (uuid=...)" via the @property

# 4. API returns new fields
curl -s http://localhost:8000/api/members/ | python3 -m json.tool
# All members have first_name, last_name, no name field; hire_date: null

# 5. Create with hire_date
curl -s -X POST http://localhost:8000/api/members/ \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"E998","first_name":"Jane","last_name":"Doe","functional_area_id":1,"hire_date":"2025-06-01"}' \
  | python3 -m json.tool
# hire_date: "2025-06-01" in response

# 6. Update first_name only (exclude_unset=True must work)
UUID=$(curl -s http://localhost:8000/api/members/ \
  | python3 -c "import sys,json; print(next(m['uuid'] for m in json.load(sys.stdin) if m['employee_id']=='E998'))")
curl -s -X PUT http://localhost:8000/api/members/$UUID \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Janet"}' | python3 -m json.tool
# first_name: "Janet", last_name still "Doe"

# 7. Type check
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# 0 errors

# 8. Frontend tests
cd /Users/clint/Workspace/team-resourcer/frontend && npx vitest run src/lib/member-utils.test.ts
# All pass

# 9. Backend tests
cd /Users/clint/Workspace/team-resourcer/backend && python -m pytest tests/test_import_mapper.py -v
# All pass

# 10. Manual smoke
# /members card view: combined name shows correctly, initials are two letters
# /members table view: Member column shows "First Last"
# Detail sheet: name, initials correct; Hire Date row visible when set
# Add Member form: Employee ID + First Name side-by-side, Last Name below, Hire Date below
# Import: member CSV with first_name/last_name columns maps and commits correctly
# Import: member CSV with "name" column fails at preview (unknown target field)
```

---

## Risks

1. **`name` property vs. column conflict in SQLAlchemy** — Adding a Python `@property` named `name` on a mapped class is safe because SQLAlchemy 2.0 does not use Python descriptors for non-mapped attributes. However, if any query uses `order_by(TeamMember.name)` or `where(TeamMember.name == ...)`, it will fail at runtime because `name` is no longer a mapped column. Search the codebase for any such references before implementing:
   ```bash
   grep -r "TeamMember.name" /Users/clint/Workspace/team-resourcer/backend/
   ```
   If found, replace with `TeamMember.last_name` or a SQL expression.

2. **Migration NOT NULL race** — Adding `first_name` as NOT NULL immediately fails if the table has existing rows (Postgres enforces the constraint before the UPDATE runs). The migration correctly adds the column as nullable first, fills it, then alters to NOT NULL. Do not reorder these steps.

3. **`accessorKey: 'name'` removal in memberColumns** — TanStack Table uses `accessorKey` for both data access and sorting. Switching to `accessorFn` means the sort function changes behavior. The `accessorFn` returning `` `${row.last_name}, ${row.first_name}` `` sorts alphabetically by last name, which is the conventional expectation. If the product wants first-name-first sort, use `` `${row.first_name} ${row.last_name}` `` instead.

4. **`useEffect` reset in MemberFormDialog must include all three new fields** — The existing `useEffect` that calls `reset(member-derived defaults)` when `[open, member]` changes must be updated. If `first_name`, `last_name`, or `hire_date` are omitted from the reset object, the form will show stale values from a previous open. Read the current `useEffect` before editing to ensure all fields are covered.

5. **Import: existing CSVs with a `name` column will break** — After this change, any import attempt using `entity_type="member"` with a `name` column mapped as a target field will receive a "Unknown target field: name" error from `apply_mapping`. This is the correct behavior (the feature intentionally removes the field), but should be documented in release notes or a UI change to the ImportWizard placeholder text.

6. **`hire_date` type in TypeScript** — The backend serializes `date` as an ISO string (e.g., `"2026-01-15"`). The `TeamMember` interface should declare it as `string | null`, not `Date`. The native `<input type="date">` in `MemberFormDialog` natively produces and accepts `YYYY-MM-DD` strings, so no conversion is needed in the form.

7. **`import_supervisor.py` log references** — This file may reference `member.name` in warning/error log messages (e.g., "Circular supervisor detected for member {member.name}"). The `@property` on the model means this will continue to work without changes, but verify to be safe.
