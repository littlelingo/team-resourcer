# Feature 023: Program Import — Agency Association

Research date: 2026-03-28

---

## 1. Current State: Program-Agency Relationship

### Schema

`programs` table has a nullable `agency_id` FK column added in migration
`b514fc596e17_add_agencies_and_program_agency_fk.py`:

```python
op.add_column("programs", sa.Column("agency_id", sa.Integer(), nullable=True))
op.create_foreign_key(
    "fk_programs_agency_id", "programs", "agencies", ["agency_id"], ["id"],
    ondelete="SET NULL"
)
op.create_index("ix_programs_agency_id", "programs", ["agency_id"])
```

The FK has `ON DELETE SET NULL` — deleting an agency nulls out `programs.agency_id` rather than blocking.

### SQLAlchemy Model (`backend/app/models/program.py`, line 34)

```python
agency_id: Mapped[int | None] = mapped_column(ForeignKey("agencies.id"), nullable=True)
agency: Mapped["Agency | None"] = relationship("Agency", back_populates="programs")
```

The relationship is bidirectional: `Agency.programs` is a list on the agency side.

### Pydantic Schemas (`backend/app/schemas/program.py`)

- `ProgramCreate`: accepts `agency_id: int | None = None`
- `ProgramUpdate`: accepts `agency_id: int | None = None`
- `ProgramResponse`: includes `agency_id: int | None` AND the full `agency: AgencyListResponse | None`

The CRUD routes accept `agency_id` directly (integer FK), not `agency_name`. The program service
uses `selectinload(Program.agency)` on all reads to eagerly load the relationship.

### Agency Table (`backend/app/models/agency.py`)

- `id` (PK, autoincrement), `name` (unique, String 255), `description` (nullable Text), timestamps
- `name` uniqueness constraint is the lookup key — identical structure to `FunctionalArea`
- No lookup-by-name API endpoint exists; the `GET /api/agencies/` route returns the full list

---

## 2. Current Program Import Flow

### Backend config (`backend/app/services/import_mapper.py`, line 77)

```python
"program": EntityConfig(
    target_fields={"name", "description", "agency_name"},
    required_fields={"name"},
    dedup_field="name",
),
```

`agency_name` IS already in the backend's `target_fields`. The backend will accept it if sent.

### Backend commit (`backend/app/services/import_commit.py`, lines 172-200)

`_commit_programs()` already implements agency resolution — lookup-only, no auto-create:

```python
agency_name = row.data.get("agency_name")
if agency_name:
    agency_result = await db.execute(
        select(Agency).where(Agency.name == str(agency_name).strip())
    )
    found_agency = agency_result.scalar_one_or_none()
    if found_agency is not None:
        program.agency_id = found_agency.id
```

If the agency name is not found, it is silently skipped (no error, no creation). This is
intentional — programs should only be linked to agencies that already exist in the DB.

### Frontend (`frontend/src/components/import/MapColumnsStep.tsx`, line 34)

```typescript
export const PROGRAM_TARGET_FIELDS: TargetField[] = [
  { label: 'Name', value: 'name' },
  { label: 'Description', value: 'description' },
]
```

`agency_name` is NOT in the frontend field list. This is the single gap. Users cannot map an
agency column during a program import because the target field never appears in the dropdown.

---

## 3. What Needs to Change

### Frontend only — one line addition

File: `frontend/src/components/import/MapColumnsStep.tsx`, line 37

Add a third entry to `PROGRAM_TARGET_FIELDS`:

```typescript
export const PROGRAM_TARGET_FIELDS: TargetField[] = [
  { label: 'Name', value: 'name' },
  { label: 'Description', value: 'description' },
  { label: 'Agency', value: 'agency_name' },    // ← add this
]
```

The `value: 'agency_name'` must match the key the backend already expects.

### Backend — no changes required

- `ENTITY_CONFIGS["program"].target_fields` already includes `"agency_name"`
- `_commit_programs()` already resolves `agency_name` → `agency_id` via name lookup
- No new migration, no new service logic, no schema change needed

---

## 4. Agency Matching Logic (How It Works)

The matching is name-based, case-sensitive, exact match:

```python
select(Agency).where(Agency.name == str(agency_name).strip())
```

No fuzzy matching. No auto-creation. Behavior when agency not found: silently skipped —
`program.agency_id` stays `None`. No row-level error is surfaced.

This is a **lookup-only** pattern, as opposed to teams/areas which use `_get_or_create_*`.
The rationale: agencies are managed records (VA, CMS, SEC) that should exist before programs
reference them.

---

## 5. Existing Patterns to Follow

### employee_id matching in member import (`import_commit.py`, line 272)

The closest parallel for reference-by-name resolution is how `_commit_members` resolves
`functional_area_name` and `team_name`:

```python
fa_name = data.get("functional_area_name")
if fa_name:
    area = await _get_or_create_functional_area(db, str(fa_name))
    functional_area_id = area.id
```

Those use get-or-create. The program→agency pattern deliberately uses lookup-only instead.

### team import resolving functional_area_name (`_commit_teams`, line 203)

Same pattern — name string → FK resolution. Same `select(...).where(Model.name == name)` idiom.

---

## 6. Dependencies and Risks

### Dependencies

- Agencies must already exist in the database before running a program import that references
  them. The import will not create agencies on the fly — users need to import/create agencies
  first (via the Agencies page or agency import).
- No dependency on new migrations, new routes, or schema changes.

### Risks

1. **Silent skip on agency not found** — If an agency name in the CSV does not exactly match an
   existing agency, the row is committed with `agency_id = None` and no warning is shown. This
   could be confusing to users who expect an error. Consider whether the preview step should
   warn when `agency_name` is mapped but no matching agency exists.

2. **Case sensitivity** — The lookup is case-sensitive (`Agency.name == str(agency_name).strip()`).
   If the CSV has "va" but the DB has "VA", no match occurs. No normalization is applied.

3. **No row-level feedback in preview** — The preview step validates required/numeric fields but
   does not pre-validate FK lookups. A user won't know agency matching failed until post-commit.
   This is consistent with how `functional_area_name` works in the member import (also no
   pre-validation of FK resolution).

4. **Scope creep risk** — Adding auto-create for agencies during program import would change the
   established lookup-only intent. Avoid unless explicitly requested.

---

## 7. File Touch Map

| File | Change | Priority |
|------|--------|----------|
| `frontend/src/components/import/MapColumnsStep.tsx` line 37 | Add `{ label: 'Agency', value: 'agency_name' }` to `PROGRAM_TARGET_FIELDS` | Required |
| `backend/app/services/import_commit.py` lines 172-200 | Already correct — no change | None |
| `backend/app/services/import_mapper.py` lines 77-81 | Already correct — no change | None |

This is a **frontend-only, one-line fix** to expose the already-working backend capability.
