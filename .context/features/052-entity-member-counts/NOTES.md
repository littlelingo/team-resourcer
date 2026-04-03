# Feature 052: Member Count Columns for Agencies, Functional Areas, and Teams

## Goal

Add a "Members" count column to the Agencies, Functional Areas, and Teams tables — the same pattern used in feature 051 (Programs).

## Current State

### Functional Areas (direct relationship — simplest)
- **Model** (`backend/app/models/functional_area.py`): `FunctionalArea.members` relationship exists (line 36) — direct via `team_members.functional_area_id` FK
- **Schema** (`backend/app/schemas/functional_area.py`): `FunctionalAreaResponse` (lines 18-25) and `FunctionalAreaListResponse` (lines 28-33) — no `member_count`
- **Service** (`backend/app/services/area_service.py`): bare `select(FunctionalArea)` — **no selectinloads at all**
- **List route**: `GET /api/areas/` returns `list[FunctionalAreaListResponse]` (id, name, description)
- **Frontend columns** (`frontend/src/components/functional-areas/functionalAreaColumns.tsx`): 2 columns (Name, Description) + actions
- **Frontend type** (`frontend/src/types/index.ts`): `FunctionalArea` interface — no `member_count`

### Teams (direct relationship)
- **Model** (`backend/app/models/team.py`): `Team.members` relationship exists (lines 51-55) — direct via `team_members.team_id` FK
- **Schema** (`backend/app/schemas/team.py`): `TeamResponse` (lines 24-34) and `TeamListResponse` (lines 41-46)
- **Service** (`backend/app/services/team_service.py`): `selectinload(Team.functional_area)` only — no `Team.members` load
- **List routes**: TWO endpoints:
  - `GET /api/teams/` → `list[TeamListResponse]` (id, name, functional_area_id) — used by MembersPage filter
  - `GET /api/areas/{id}/teams/` → `list[TeamResponse]` (full detail) — used by TeamsPage table
- **Frontend columns** (`frontend/src/components/teams/teamColumns.tsx`): 4 columns (Name, Functional Area, Lead, Description) + actions
- **Frontend type** (`frontend/src/types/index.ts`): `Team` interface — no `member_count`

### Agencies (indirect relationship — most complex)
- **Model** (`backend/app/models/agency.py`): Only `Agency.programs` relationship (line 34) — **NO direct relationship to members**
- **Path to members**: `Agency → programs → assignments → member_uuid` (two-level join)
- **Schema** (`backend/app/schemas/agency.py`): `AgencyResponse` (lines 18-25) and `AgencyListResponse` (lines 28-33) — no `member_count`
- **Service** (`backend/app/services/agency_service.py`): bare `select(Agency)` — **no selectinloads at all**
- **List route**: `GET /api/agencies/` returns `list[AgencyListResponse]` (id, name, description)
- **Frontend columns** (`frontend/src/components/agencies/agencyColumns.tsx`): 2 columns (Name, Description) + actions
- **Frontend type** (`frontend/src/types/index.ts`): `Agency` interface — no `member_count`

## Implementation Touch Points

### Per Entity (following feature 051 pattern)

| Entity | Schema to update | Service functions to update | Frontend column file | Relationship to load |
|--------|-----------------|---------------------------|---------------------|---------------------|
| Functional Areas | `FunctionalAreaListResponse` + `FunctionalAreaResponse` | `list_areas`, `get_area`, `create_area`, `update_area` | `functionalAreaColumns.tsx` | `selectinload(FunctionalArea.members)` |
| Teams | `TeamResponse` (NOT `TeamListResponse` — that's for filters) | `list_teams`, `get_team` (create/update delegate to get_team) | `teamColumns.tsx` | `selectinload(Team.members)` |
| Agencies | `AgencyListResponse` + `AgencyResponse` | `list_agencies`, `get_agency`, `create_agency`, `update_agency` | `agencyColumns.tsx` | `selectinload(Agency.programs).selectinload(Program.assignments)` |

### Total files to modify
- 3 backend schemas (functional_area.py, team.py, agency.py)
- 3 backend services (area_service.py, team_service.py, agency_service.py)
- 3 frontend column files
- 1 frontend types file (index.ts — 3 interfaces)
= **10 files total**

## Risks & Known Errors

- **MissingGreenlet (error index, feature 050)**: Area and agency services currently have ZERO selectinloads. Adding `member_count` to schemas means ALL service functions returning those schemas must add the selectinload. Missing any one will crash.
- **Agency double-counting**: A member assigned to two programs under the same agency would be counted twice. Must deduplicate: `len({a.member_uuid for p in agency.programs for a in p.assignments})`
- **TeamListResponse scope**: `TeamListResponse` is used by `useAllTeams()` for the MembersPage filter dropdown. Adding `member_count` there would require eager-loading members on that endpoint too, which is unnecessary overhead for a filter. Only add to `TeamResponse`.
- **`FunctionalAreaListResponse` is embedded**: It's used inside `TeamResponse.functional_area`. Adding `member_count` there means the team service would also need to load area members when serializing teams. Consider adding `member_count` only to `FunctionalAreaResponse` and a new list endpoint response, OR skip `FunctionalAreaListResponse` and only update the main response.

## Open Questions

1. **`FunctionalAreaListResponse` embedded in `TeamResponse`**: Should the embedded area inside a team response also show member_count? If yes, the team service needs to load `Team.functional_area.members` too. If no, we need separate schemas (one with count for the list page, one without for embedding).
2. **`AgencyListResponse` embedded in `ProgramResponse`**: Same issue — agency is embedded in program responses. Should it show member_count there too?

## Dependencies

- Feature 051 (program-member-count) — completed, provides the pattern to follow
