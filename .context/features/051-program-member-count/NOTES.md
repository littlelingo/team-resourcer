# Feature 051: Program Member Count Column

## Goal

Add a "Total Members" column to the Programs table showing the count of members associated with each program.

## Current State

### Database Layer
- **Program model**: `backend/app/models/program.py` — has `assignments: Mapped[list[ProgramAssignment]]` relationship (line 37)
- **ProgramAssignment model**: join table with composite PK of `member_uuid` + `program_id` (many-to-many)
- The relationship exists but is **not loaded** by any service function today

### Backend API
- **Routes**: `backend/app/routers/programs.py` — standard CRUD endpoints (`GET /api/programs/`, `GET /api/programs/{id}`, etc.)
- **Service**: `backend/app/services/program_service.py`
  - `list_programs` (line 18): only `selectinload(Program.agency)` — does NOT load assignments
  - `get_program` (line 26): same — only loads agency
  - `create_program` (line 34): no selectinload
  - `update_program` (line 46): no selectinload
- **Schema**: `backend/app/schemas/program.py`
  - `ProgramResponse` (lines 22-31): fields are `id, name, description, agency_id, agency, created_at, updated_at` — no `member_count`

### Frontend
- **Programs page**: `frontend/src/pages/ProgramsPage.tsx` — uses `usePrograms()` hook, passes data to `DataTable`
- **Columns**: `frontend/src/components/programs/programColumns.tsx` — 3 data columns (Name, Description, Agency) + actions column
- **Type**: `frontend/src/types/index.ts` lines 45-53 — `Program` interface, no `member_count` field
- **Hook**: `frontend/src/hooks/usePrograms.ts` — calls `GET /api/programs/`, returns raw list

## Gaps

1. **No `member_count` on `ProgramResponse`** — field doesn't exist in schema
2. **`Program.assignments` not eager-loaded** — service doesn't `selectinload` assignments
3. **No frontend column** — `programColumns.tsx` has no member count column
4. **No `member_count` on `Program` TS type** — interface missing the field

## Implementation Touch Points (4 files)

| Layer | File | Change |
|-------|------|--------|
| Backend schema | `backend/app/schemas/program.py` | Add `member_count: int` field to `ProgramResponse` |
| Backend service | `backend/app/services/program_service.py` | Add `selectinload(Program.assignments)` to `list_programs` and `get_program`; compute `member_count` |
| Frontend type | `frontend/src/types/index.ts` | Add `member_count?: number` to `Program` interface |
| Frontend column | `frontend/src/components/programs/programColumns.tsx` | Add "Total Members" column |

## Risks & Known Errors

- **MissingGreenlet (error index, feature 050)**: If `selectinload(Program.assignments)` is added to some service functions but missed on others, any route that serializes a `ProgramResponse` with unloaded assignments will raise `MissingGreenlet`. ALL service functions returning `ProgramResponse` must load assignments.
- **`assignments` leaking into JSON**: If using `@computed_field` with assignments on the schema, the raw assignments list could leak into API response. Use `member_count` as a plain `int` field set by the service, or use `model_config` to exclude assignments.

## Patterns to Follow

- Existing `selectinload` pattern in `list_programs` for `Program.agency` — extend to include `Program.assignments`
- Column definition style in `programColumns.tsx` — follow same structure as existing columns
- `from_attributes = True` on `ProgramResponse` — means Pydantic reads from ORM attributes

## Open Questions

- Should `member_count` also appear on program detail/edit views, or table only? (Table only for now)
- Should the count be sortable? (Yes — follow existing column pattern with `enableSorting: true`)

## Dependencies

None — all infrastructure (models, relationships, join table) already exists.
