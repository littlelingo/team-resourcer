# Feature 017: Program Agency

Add `Agency` as a new first-class lookup entity, then attach `agency_id` (FK) to Programs.
Seed data: VA, CMS, SEC.

---

## Current State

### Programs table (initial migration: `452ccece7038`)
- Columns: `id`, `name` (unique), `description`, `created_at`, `updated_at`
- No agency relationship exists today
- `programs` has **no FK columns** — the only related table is `program_assignments` (member ↔ program join)

### Functional Area — the best reference model
`functional_areas` is structurally identical to what `agencies` should be:
- `id` (PK, autoincrement), `name` (unique), `description` (nullable), timestamps
- Has downstream dependents via FK: `teams.functional_area_id`, `team_members.functional_area_id`
- Agency will have one downstream dependent: `programs.agency_id`

---

## Architecture Patterns

### Migration pattern (single migration file, hand-edited)
`backend/alembic/versions/452ccece7038_initial_schema.py` is the only migration.
All new schema changes need a **new Alembic revision file** chained off `452ccece7038`.
Pattern:
```python
revision = '<new_hash>'
down_revision = '452ccece7038'

def upgrade():
    op.create_table('agencies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.add_column('programs', sa.Column('agency_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_programs_agency_id', 'programs', 'agencies', ['agency_id'], ['id'])
    op.create_index('ix_programs_agency_id', 'programs', ['agency_id'])

def downgrade():
    op.drop_index('ix_programs_agency_id', table_name='programs')
    op.drop_constraint('fk_programs_agency_id', 'programs', type_='foreignkey')
    op.drop_column('programs', 'agency_id')
    op.drop_table('agencies')
```
`agency_id` should be **nullable** on programs so existing programs don't break.

### SQLAlchemy model pattern
Mirror `backend/app/models/functional_area.py` exactly.
```python
class Agency(Base):
    __tablename__ = "agencies"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at / updated_at — same as FunctionalArea
    programs: Mapped[list[Program]] = relationship("Program", back_populates="agency")
```
`Program` model gains:
```python
agency_id: Mapped[int | None] = mapped_column(ForeignKey("agencies.id"), nullable=True)
agency: Mapped[Agency | None] = relationship("Agency", back_populates="programs")
```

### Pydantic schema pattern
Mirror `backend/app/schemas/functional_area.py`:
- `AgencyCreate(BaseModel)`: `name: str`, `description: str | None = None`
- `AgencyUpdate(BaseModel)`: both fields optional
- `AgencyResponse(BaseModel)`: full fields + timestamps
- `AgencyListResponse(BaseModel)`: `id`, `name`, `description` (no timestamps — used in dropdowns)

`ProgramCreate` gains: `agency_id: int | None = None`
`ProgramUpdate` gains: `agency_id: int | None = None`
`ProgramResponse` gains: `agency_id: int | None` + `agency: AgencyListResponse | None`
`ProgramListResponse` — likely unchanged (no agency needed in list widget).

### Service pattern
Mirror `backend/app/services/area_service.py` verbatim for agencies:
`list_agencies`, `get_agency`, `create_agency`, `update_agency`, `delete_agency`

`program_service.py` — no changes to service logic; Pydantic schema changes flow through automatically because `create_program` / `update_program` use `data.model_dump()`.
However, `get_program` / `list_programs` will need `selectinload(Program.agency)` added to avoid lazy-load errors in async context (same pattern as `get_program_members` already uses `selectinload`).

### Route pattern
New router at `backend/app/api/routes/agencies.py` — mirror `areas.py` structure:
- `GET /` → list
- `GET /{agency_id}` → detail
- `POST /` → create (201)
- `PUT /{agency_id}` → update
- `DELETE /{agency_id}` → 204

Register in `main.py`:
```python
app.include_router(agencies_router, prefix="/api/agencies", tags=["agencies"])
```

`__init__` files (`schemas/__init__.py`, `services/__init__.py`) must be updated to export new symbols.

### Seed data pattern
`backend/app/seed.py` — idempotency check is on `FunctionalArea.name == "Engineering"`.
Add agencies before programs, using the same flush-then-reference pattern:
```python
va = Agency(name="VA", description="Department of Veterans Affairs")
cms = Agency(name="CMS", description="Centers for Medicare & Medicaid Services")
sec = Agency(name="SEC", description="Securities and Exchange Commission")
db.add_all([va, cms, sec])
await db.flush()
```
Then set `agency_id=va.id` etc. when creating programs.

---

## Frontend Files Involved

### Types — `frontend/src/types/index.ts`
Add:
```ts
export interface Agency {
  id: number
  name: string
  description: string | null
}
export interface AgencyFormInput {
  name: string
  description?: string
}
```
Update `Program`:
```ts
agency_id: number | null
agency?: Agency
```
Update `ProgramFormInput`:
```ts
agency_id?: number
```

### React Query hooks
New file: `frontend/src/hooks/useAgencies.ts` — mirror `useFunctionalAreas.ts` exactly, swapping:
- endpoint `/api/areas/` → `/api/agencies/`
- key prefix `"areas"` → `"agencies"`
- types `FunctionalArea` / `FunctionalAreaFormInput` → `Agency` / `AgencyFormInput`

Exported hooks: `useAgencies`, `useCreateAgency`, `useUpdateAgency`, `useDeleteAgency`

### Agency management page
New file: `frontend/src/pages/AgenciesPage.tsx` — mirror `FunctionalAreasPage.tsx`:
- Uses `useAgencies`, `useDeleteAgency`, `AgencyFormDialog`, `agencyColumns`
- Has Add / Import buttons (the Import wizard already supports any entity type via `entityType` prop)

New files:
- `frontend/src/components/agencies/AgencyFormDialog.tsx` — mirror `FunctionalAreaFormDialog.tsx`
- `frontend/src/components/agencies/agencyColumns.tsx` — mirror `functionalAreaColumns.tsx`

### ProgramFormDialog — `frontend/src/components/programs/ProgramFormDialog.tsx`
Add agency dropdown using `useAgencies()`, same pattern as TeamFormDialog uses `useFunctionalAreas()`:
- Import `useAgencies` from `@/hooks/useAgencies`
- Add `agency_id` to zod schema: `agency_id: z.coerce.number().optional()`
- Use `Controller` + `Select.Root` / `Select.Item` from `@radix-ui/react-select`
- "None" sentinel value: use `"__none__"` pattern (established in `TeamFormDialog` line 256)
- Map `"__none__"` → `undefined` before submitting

### programColumns — `frontend/src/components/programs/programColumns.tsx`
Add an "Agency" column after "Description":
```ts
{ accessorKey: 'agency', header: 'Agency', cell: ({ row }) => row.original.agency?.name ?? '—' }
```

### App routing and nav — `frontend/src/App.tsx` + `AppLayout.tsx`
Add route: `<Route path="/agencies" element={<AgenciesPage />} />`
Add nav item in `AppLayout.tsx`: `{ label: 'Agencies', icon: Building2, path: '/agencies' }` (import `Building2` from lucide-react)

---

## Import/Export Impact

The CSV import feature (`import_mapper.py`, `import_commit.py`) currently handles `"program"` entity type with `target_fields = {"name", "description"}` (line 55-58 in `import_mapper.py`).

**Two decisions needed:**

1. **Program import**: Should importing a program also accept an `agency_name` column and auto-create/link agencies? This would require:
   - Adding `"agency_name"` to `ENTITY_CONFIGS["program"].target_fields`
   - `_commit_programs` in `import_commit.py` calling `_get_or_create_agency(db, name)` (new helper)

2. **Agency import**: Should there be a standalone agency import (entityType = "agency")? This requires:
   - Adding `"agency"` to `EntityType` Literal in `import_schemas.py`
   - Adding `ENTITY_CONFIGS["agency"]` entry in `import_mapper.py`
   - Adding `_commit_agencies` in `import_commit.py`
   - Updating the `commit_import` dispatch in `import_commit.py`

The `ImportWizard` frontend component accepts `entityType` as a prop and already uses a generic flow — adding a new entity type only requires backend changes, not frontend wizard changes.

---

## Dependencies

- Agency must be created before programs can reference it (seed order matters)
- `program_service.list_programs` and `get_program` need `selectinload(Program.agency)` to eagerly load the relationship — otherwise SQLAlchemy async will raise `MissingGreenlet` when the route serializes `ProgramResponse.agency`
- Team's FK pattern (nullable `lead_id` -> optional relationship) is the closest parallel for `agency_id` nullable FK

---

## Risks

1. **Lazy-load async bug** — The most likely runtime failure. If `selectinload(Program.agency)` is not added to `list_programs` and `get_program` queries, every `/api/programs/` request will raise an `sqlalchemy.exc.MissingGreenlet` error. The existing `get_program_members` already uses `selectinload` as the established fix.

2. **Existing program data** — `agency_id` must be nullable. Any non-nullable migration will fail against existing rows unless a default agency is provided. Keep it nullable.

3. **Import backward compatibility** — If `agency_name` is added as a target field for program import, existing column-mappings that don't include it will still work (unmapped fields are simply absent from `data` dict; no validation error for absent optional fields).

4. **Seed idempotency** — The seed idempotency guard only checks for `FunctionalArea.name == "Engineering"`. If agencies are seeded separately from programs, a partial re-seed could duplicate agencies. Add an idempotency guard for `Agency.name == "VA"` if splitting.

---

## Open Questions

1. **Nullable vs. required**: Should `agency_id` be required on new programs in the UI? Backend schema allows null, but the form could enforce selection. Recommend: optional in form (matches how `description` is optional), required decision left to UX.

2. **Agency import as a standalone entityType**: Is `entityType="agency"` needed in the ImportWizard on the AgenciesPage? Consistent with how FunctionalAreasPage already has Import → `entityType="area"`. Recommend yes for consistency.

3. **Program import with agency resolution**: Should a program CSV support an `agency_name` column? Low effort to add but increases import complexity. The team may prefer agencies to be managed manually.

4. **Cascade delete behavior**: If an agency is deleted, should `programs.agency_id` be SET NULL (soft delink) or RESTRICT (block delete if programs reference it)? Current FK patterns in the codebase do not use `ON DELETE` clauses — Postgres defaults to `RESTRICT`. Recommend `ON DELETE SET NULL` for agencies since programs are the more important record.

5. **Nav placement**: Where in the sidebar does "Agencies" live? Natural position is between "Programs" and "Functional Areas" since agencies belong to programs, and functional areas belong to teams.
