---
name: Research: Entity Member Count (Agencies, Functional Areas, Teams)
description: 2026-04-02 research on adding Members count columns to Agencies, Functional Areas, and Teams tables, following the Programs (feature 051) pattern
type: project
---

## Member Relationship Map

### Functional Areas
- **Direct relationship**: `FunctionalArea.members` → `list[TeamMember]` (via `TeamMember.functional_area_id` FK, not nullable)
- Model: `backend/app/models/functional_area.py` line 36
- Schema: `FunctionalAreaResponse` / `FunctionalAreaListResponse` in `backend/app/schemas/functional_area.py` — neither has `member_count`
- Service: `backend/app/services/area_service.py` — `list_areas` uses bare `select(FunctionalArea)`, NO selectinload at all
- Frontend columns: `frontend/src/components/functional-areas/functionalAreaColumns.tsx` — no Members column
- Frontend type: `frontend/src/types/index.ts` line 3 — `FunctionalArea` has only `id`, `name`, `description`

### Teams
- **Direct relationship**: `Team.members` → `list[TeamMember]` (via `TeamMember.team_id` FK, nullable — members can be unassigned)
- Model: `backend/app/models/team.py` lines 51–55
- Schema: `TeamResponse` / `TeamListResponse` in `backend/app/schemas/team.py` — neither has `member_count`
- Service: `backend/app/services/team_service.py` — `list_teams` uses `selectinload(Team.functional_area)` only; no members eager-load
- Frontend columns: `frontend/src/components/teams/teamColumns.tsx` — no Members column
- Frontend type: `frontend/src/types/index.ts` line 26 — `Team` has `id`, `name`, `description`, `functional_area_id`, `lead_id`, `functional_area?`, timestamps

### Agencies
- **INDIRECT relationship**: Agency → Programs (one-to-many via `Program.agency_id`) → ProgramAssignments (many-to-many) → TeamMember
- No direct `agency_id` on `team_members`; no `members` relationship on Agency model
- Model: `backend/app/models/agency.py` line 34 — only `Agency.programs` relationship
- Schema: `AgencyResponse` / `AgencyListResponse` in `backend/app/schemas/agency.py` — neither has `member_count`
- Service: `backend/app/services/agency_service.py` — `list_agencies` uses bare `select(Agency)`, NO selectinload
- Frontend columns: `frontend/src/components/agencies/agencyColumns.tsx` — no Members column
- Frontend type: `frontend/src/types/index.ts` line 11 — `Agency` has only `id`, `name`, `description`

## Pattern to Follow (from feature 051 / Programs)

The established pattern uses **dynamic attribute injection** (`p.member_count = len(p.assignments)  # type: ignore[attr-defined]`):

1. **Schema**: Add `member_count: int = 0` to the Response schema
2. **Service**: Add `selectinload(Model.relationship)` to all service functions that return the model; set `obj.member_count = len(obj.relationship)` before return
3. **Frontend type**: Add `member_count: number` to the interface in `types/index.ts`
4. **Frontend columns**: Add `accessorKey: 'member_count'` column with `enableSorting: true`

## Agency Complexity: Counting Members Through Programs

Agencies have no direct path to members. Two approaches:

**Option A — SQL scalar subquery** (recommended for correctness): Use a correlated subquery counting DISTINCT members across all programs for the agency. Avoids double-counting members assigned to multiple programs under the same agency.

**Option B — Python via eager-loading** (simpler but may double-count): `selectinload(Agency.programs).selectinload(Program.assignments)`, then `len({a.member_uuid for p in agency.programs for a in p.assignments})`. Uses a set to deduplicate. Consistent with the existing pattern.

Option B with set-dedup is the simplest path consistent with the 051 pattern.

## Key Risk: MissingGreenlet
Per ERROR INDEX: if a relationship is declared in the response schema but not eager-loaded in the service, SQLAlchemy raises `MissingGreenlet` in async context. MUST add `selectinload` to every service function that returns the model (list, get, create, update — delete is safe).

## Service Functions Requiring selectinload

### area_service.py — 4 functions total
- `list_areas` (line 12) — needs `selectinload(FunctionalArea.members)`
- `get_area` (line 18) — needs `selectinload(FunctionalArea.members)`
- `create_area` (line 24) — needs re-query with selectinload after commit (like create_program pattern)
- `update_area` (line 33) — needs re-query with selectinload after commit

### team_service.py — 4 functions total
- `list_teams` (line 16) — already has `selectinload(Team.functional_area)`; add `selectinload(Team.members)`
- `get_team` (line 25) — already has `selectinload(Team.functional_area)`; add `selectinload(Team.members)`
- `create_team` (line 32) — delegates to `get_team`; get_team just needs updating
- `update_team` (line 40) — delegates to `get_team`; get_team just needs updating

### agency_service.py — 4 functions total
- `list_agencies` (line 12) — needs `selectinload(Agency.programs).selectinload(Program.assignments)`
- `get_agency` (line 18) — needs same
- `create_agency` (line 24) — needs re-query with selectinload after commit
- `update_agency` (line 33) — needs re-query with selectinload after commit

**Why:** To surface member counts on the list tables without a separate API call. Follows the exact approach validated in feature 051.
**How to apply:** Implement identically to program_service.py, adjusting selectinload chains per entity.
