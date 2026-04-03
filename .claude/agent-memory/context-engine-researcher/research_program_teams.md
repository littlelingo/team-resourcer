---
name: Research: Program Teams (feature candidate)
description: 2026-04-03 deep audit of CRUD/migration/frontend patterns for adding a program_teams table nested under programs
type: project
---

Full pattern audit for `program_teams` feature. Covers model, schema, routes, service, migration, and frontend hook/form patterns.

**Why:** New `program_teams` table adds program-specific teams; needs to exactly replicate existing team patterns but nested under `/api/programs/{program_id}/teams/`.

**How to apply:** Use Team as the direct template for every layer. Key divergence points noted below.

## Backend touch points

### Model pattern (team.py → program_team.py)
- parent FK: `program_id: int` → `ForeignKey("programs.id")`
- `lead_id`: `UUID | None` → `ForeignKey("team_members.uuid", use_alter=True, name="fk_program_teams_lead_id")`
- Same `created_at`/`updated_at` columns with `func.now()`
- Relationships: back_populates on Program model; lead via foreign_keys=[lead_id]
- Register new model in `backend/app/models/__init__.py`

### Schema pattern (schemas/team.py)
- `ProgramTeamCreate`: `name`, `description?`, `lead_id?` (no program_id — injected from path)
- `ProgramTeamUpdate`: all fields optional including `program_id?`
- `ProgramTeamResponse`: full object with `program_id`, `lead_id`, `member_count`, nested program object optional
- `ProgramTeamListResponse`: slim (id, name, program_id only)

### Service pattern (team_service.py lines 16–103)
- `list_program_teams(db, program_id?)` — selectinload parent + members, compute member_count inline
- `get_program_team(db, team_id)` — single fetch with selectinload
- `create_program_team(db, data, program_id)` — `Team(**data.model_dump(), program_id=program_id)`; commit; re-fetch
- `update_program_team(db, team_id, data)` — `model_dump(exclude_unset=True)` loop
- `delete_program_team(db, team_id)` — `db.delete(); commit()`
- member add/remove: update `program_team_id` on TeamMember (if adding program-team membership column) OR use a join table

### Route nesting pattern (areas.py lines 6–27)
```python
# In programs.py (already exists)
from app.api.routes.program_teams import router as program_teams_router
router.include_router(program_teams_router, prefix="/{program_id}/teams", tags=["program-teams"])
```
- Route handler receives `program_id: int` from path automatically
- GET / → list, GET /{id} → get (validate program_id match), POST / → create, PUT /{id} → update, DELETE /{id} → delete
- Member add: POST /{id}/members with `Body(..., embed=True)` UUID
- Member remove: DELETE /{id}/members/{member_uuid}
- No need for a top-level `/api/program-teams/` router (unlike teams which has `teams_top_router`)

### Migration pattern
- File: `backend/alembic/versions/<hash>_add_program_teams.py`
- `down_revision` must point to current head: `55b198d5e2a6`
- `op.create_table(...)` with all columns; `op.create_foreign_key(...)` for lead_id (use_alter pattern)
- Command: `make migration name="add_program_teams"` then `make migrate`
- Alembic uses `from app.models import *` in env.py — new model must be in `__init__.py` before autogenerate works

## Frontend touch points

### Hook pattern (useTeams.ts → useProgramTeams.ts)
- `programTeamKeys` with `all`, `list(programId)`, `detail(programId, id)`, `members(teamId)`
- `useProgramTeams(programId)` → `/api/programs/${programId}/teams/`
- `useCreateProgramTeam(programId)` → POST `/api/programs/${programId}/teams/`
- `useUpdateProgramTeam(programId)` → PUT `/api/programs/${programId}/teams/${id}`
- `useDeleteProgramTeam(programId)` → DELETE
- `useProgramTeamMembers(teamId)` → `/api/members/?program_team_id=${teamId}` (or equivalent)
- `useAddProgramTeamMember(programId)` → POST `/{teamId}/members`
- `useRemoveeProgramTeamMember(programId)` → DELETE `/{teamId}/members/{uuid}`
- Invalidate `programTeamKeys.all` on mutations

### Form dialog pattern (TeamFormDialog.tsx)
- Zod schema: `name` (required), `program_id` (coerce.number, required), `description?`, `lead_id?`
- No separate area selector — use program selector (load from usePrograms)
- `lead_id` uses `__none__` sentinel (lines 236–237 in TeamFormDialog.tsx — already the pattern)
- `useCreateProgramTeam(selectedProgramId)` / `useUpdateProgramTeam(team.program_id)`
- Submit strips `program_id` from payload (injected by route), sends only `name/description/lead_id`

### Page integration (ProgramsPage.tsx)
- ProgramsPage already has EntityMembersSheet for program members (lines 117–138)
- Program teams would be a second sheet or a tab within the existing detail view
- `selectedProgram?.id` is the context for team list queries
- `allMembers` filter: members assigned to the program (not all members)

### EntityMembersSheet wiring
- Already used in TeamsPage (lines 164–186) and ProgramsPage (lines 117–138)
- Pass `leadId={selectedProgramTeam?.lead_id}` for lead badge (feature 053 pattern)
