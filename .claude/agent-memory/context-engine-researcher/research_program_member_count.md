---
name: Research: Programs Table — Total Members Column
description: Full audit of what is needed to add a "Total Members" count column to the Programs table view
type: project
---

## Summary (2026-04-02)

### Current State

The Programs table (`frontend/src/components/programs/programColumns.tsx`) has 3 data columns:
Name, Description, Agency — plus an actions column. No member count anywhere.

The `GET /api/programs/` list endpoint returns `list[ProgramResponse]` which does NOT include
any member count field. The `ProgramResponse` schema (backend/app/schemas/program.py line 22)
fields: id, name, description, agency_id, agency (nested), created_at, updated_at.

The `Program` frontend type (frontend/src/types/index.ts line 45) mirrors this exactly —
no member_count field.

### Relationship

Programs ↔ Members is many-to-many via `program_assignments` join table.
- `Program.assignments` relationship → list[ProgramAssignment] (backend/app/models/program.py line 37)
- `ProgramAssignment` has composite PK (member_uuid, program_id)

### Two Implementation Approaches

**Option A — Backend count (recommended)**
Add `member_count: int` to `ProgramResponse` schema. In `list_programs` service
(backend/app/services/program_service.py line 18), add
`selectinload(Program.assignments)` to the query, then Pydantic computes
`len(program.assignments)` via a `@computed_field` or validator. Alternatively, use a
`func.count` subquery correlated on `program_assignments.program_id` to avoid loading
the full assignment rows — more efficient at scale.
Then add `member_count?: number` to the `Program` type in frontend/src/types/index.ts
and a column in programColumns.tsx.

**Option B — Frontend-only count (no backend change)**
`ProgramsPage.tsx` already fetches `useMembers()` (all members with their list data).
But `TeamMemberList` has no `program_assignments` field (it's stripped by the list schema).
So this approach would require fixing the member list schema first — more invasive.
Not recommended.

### Recommended Implementation Plan

1. **Backend schema** — `backend/app/schemas/program.py`: add `member_count: int = 0`
   to `ProgramResponse` (default 0 is safe for backward compat).

2. **Backend service** — `backend/app/services/program_service.py` `list_programs` (line 18):
   add `selectinload(Program.assignments)` to the select options. Then the Pydantic model
   needs a computed field. Since `Program` ORM model has `assignments: list[ProgramAssignment]`,
   the schema can use a `@computed_field` (Pydantic v2) that returns `len(self.assignments)`.
   **Beware**: `get_program`, `create_program`, `update_program` also return `ProgramResponse` —
   they also need `selectinload(Program.assignments)` added or `member_count` will be 0.

   Alternatively: use a SQL `func.count` scalar subquery to get the count without loading
   assignment rows. This avoids changing 4 separate queries. Pattern:
   ```python
   from sqlalchemy import func, select, literal_column
   subq = (
       select(func.count())
       .where(ProgramAssignment.program_id == Program.id)
       .scalar_subquery()
   )
   select(Program, subq.label("member_count"))...
   ```
   But this makes the service return tuples, not `Program` ORM instances — more complex.
   The `selectinload` approach is simpler and consistent with existing patterns in this codebase.

3. **Frontend type** — `frontend/src/types/index.ts` line 45: add `member_count?: number`
   to `Program` interface (optional to keep it backward-compatible with any place that
   constructs a `Program` object without the new field).

4. **Frontend column** — `frontend/src/components/programs/programColumns.tsx`:
   insert new column between Agency and Actions:
   ```tsx
   {
     accessorKey: 'member_count',
     header: 'Total Members',
     enableSorting: true,
     cell: ({ row }) => (
       <span className="text-slate-700">{row.original.member_count ?? 0}</span>
     ),
   }
   ```

### Known Risk: MissingGreenlet

Per error index: adding a relationship to a response schema that isn't eager-loaded in ALL
routes using that schema causes `MissingGreenlet` in the async SQLAlchemy session.
All 4 routes that return `ProgramResponse` (list, get, create, update) must have
`selectinload(Program.assignments)` — not just `list_programs`.

### No Existing Count Pattern

Neither Teams nor Areas tables show a member count today. This is the first such column.
No `member_count` computed field pattern exists in the codebase to copy from.
