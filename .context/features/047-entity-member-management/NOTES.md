# Research: Add/Remove Members from Entity Tabs

## Problem

Users want to manage member assignments directly from each entity tab (Programs, Agencies, Areas, Teams). Currently only Programs shows a read-only member list; no entity tab supports adding or removing members.

## Current State by Entity

### Programs — Partially Implemented (read-only)

| Layer | State |
|-------|-------|
| Backend endpoints | `GET /{id}/members`, `POST /{id}/assignments`, `DELETE /{id}/assignments/{uuid}` — all working |
| Frontend hooks | `useProgramMembers`, `useAssignProgram`, `useUnassignProgram` — all exist |
| UI | `ProgramMembersSheet` in ProgramsPage.tsx — read-only slide-out showing avatar + name + title. No add/remove controls |

**What's needed**: Add "Add Member" button and per-member "Remove" button to the existing `ProgramMembersSheet`.

**Bug found**: `useAssignProgram` invalidates `programKeys.all` and `memberKeys.all` but NOT `programKeys.members(id)` — the sheet query wouldn't refresh after assignment.

### Agencies — No Direct Member Relationship

| Layer | State |
|-------|-------|
| Backend | No member endpoints. Agency connects to members only indirectly through programs (Program has agency_id FK) |
| Frontend | CRUD only (name, description, actions) |

**Important**: There is no `agency_id` on the member table. The relationship is `Member → ProgramAssignment → Program → Agency`. Managing "members on an agency" would mean managing program assignments, which is complex and potentially confusing.

**Recommendation**: Skip agencies for direct member management. If needed, could show a read-only list of members who are on programs belonging to the agency (computed view, no assignment action).

### Functional Areas — Backend Missing, Frontend Missing

| Layer | State |
|-------|-------|
| Backend | No `GET /api/areas/{id}/members` endpoint. The FK `team_members.functional_area_id` exists so the query is trivial |
| Frontend | CRUD only. No member hooks, no member UI |

**What's needed**:
1. Backend: Add `GET /api/areas/{id}/members` service + route
2. Frontend: Add `useAreaMembers(id)` hook
3. Frontend: Add member management sheet (same pattern as Programs)
4. Member assignment = setting `functional_area_id` on the member via `PUT /api/members/{uuid}`

### Teams — Backend Partial, Frontend Missing

| Layer | State |
|-------|-------|
| Backend | `POST /api/areas/{area_id}/teams/{id}/members` and `DELETE .../members/{uuid}` exist. **No GET list endpoint** |
| Frontend | `useTeams.ts` has zero member hooks. Page uses `useMembers()` only to resolve lead names in columns |

**What's needed**:
1. Backend: Add `GET /api/areas/{area_id}/teams/{id}/members` route
2. Frontend: Add `useTeamMembers`, `useAddTeamMember`, `useRemoveTeamMember` hooks
3. Frontend: Add member management sheet
4. Member assignment = setting `team_id` on the member via existing endpoints

## Shared UI Pattern

All four entity pages use the same structural pattern: `DataTable` + `FormDialog` + `ConfirmDialog` + `ImportWizard`. The member management UI should follow a consistent pattern across all entities:

1. Click entity name in table → opens a right-side sheet
2. Sheet shows member list with avatars
3. "Add Member" button opens a member picker (select from all members)
4. Each member row has a "Remove" action
5. Changes take effect immediately (no save button needed)

Programs already has the sheet UI (`ProgramMembersSheet` in ProgramsPage.tsx, lines 20-101) — this can serve as the template.

## Complexity Assessment: HIGH

This feature spans:
- 2 backend routes to add (areas members list, teams members list)
- 3-4 frontend hooks to add
- 3 entity pages to modify (Programs, Areas, Teams; skip Agencies)
- 1 shared member management sheet component (or 3 similar ones)
- Member picker/selector sub-component

**Recommendation**: Break into phases:
1. **Phase 1**: Programs — add assign/remove UI to existing sheet (hooks already exist)
2. **Phase 2**: Functional Areas — add backend endpoint + frontend sheet
3. **Phase 3**: Teams — add backend list endpoint + frontend sheet

## Files to Modify

### Phase 1 (Programs)
| File | Change |
|------|--------|
| `frontend/src/pages/ProgramsPage.tsx` | Add add/remove controls to ProgramMembersSheet |
| `frontend/src/hooks/usePrograms.ts` | Fix invalidation to include `programKeys.members(id)` |

### Phase 2 (Areas)
| File | Change |
|------|--------|
| `backend/app/services/area_service.py` | Add `list_area_members` function |
| `backend/app/api/routes/areas.py` | Add `GET /{id}/members` route |
| `frontend/src/hooks/useFunctionalAreas.ts` | Add `useAreaMembers` hook |
| `frontend/src/pages/FunctionalAreasPage.tsx` | Add member sheet |

### Phase 3 (Teams)
| File | Change |
|------|--------|
| `backend/app/services/team_service.py` | Add `list_team_members` function |
| `backend/app/api/routes/teams.py` | Add `GET /{id}/members` route |
| `frontend/src/hooks/useTeams.ts` | Add `useTeamMembers`, `useAddTeamMember`, `useRemoveTeamMember` hooks |
| `frontend/src/pages/TeamsPage.tsx` | Add member sheet |

## Dependencies

- Member picker needs all members list (`useMembers()`) filtered to exclude already-assigned
- Areas → Teams dependency: setting `team_id` requires knowing which area the team belongs to
- Program assignment uses separate join table; Area/Team assignment uses FK on member

## Risks

- Inconsistent assignment mechanisms: Programs use a join table (many-to-many), Areas/Teams use FK (one-to-many). The UI should feel the same but the backend calls differ.
- Removing a member from an area should also clear their team_id (since teams belong to areas)
- Invalidation must cover both the entity's member list query AND the member detail query
