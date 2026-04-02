# PRP: Fix Team Assignment Display in Member Detail/Edit

## Status: COMPLETE
## Testing Strategy: implement-then-test

## Context
After assigning a member to a team via the Teams page, the assignment wasn't reflected in the member edit form. Three related issues: (1) cross-area assignment broke the area-scoped team dropdown, (2) detail sheet had potential cache timing issues, (3) MembersPage team filter was completely broken.

## Changes Made

### 1. Backend: Sync `functional_area_id` on team assignment
**File:** `backend/app/services/team_service.py`
- `add_member_to_team` now sets both `member.team_id` AND `member.functional_area_id = team.functional_area_id`

### 2. Backend: New `GET /api/teams/` endpoint
**Files:** `backend/app/api/routes/teams.py`, `backend/app/main.py`
- Top-level endpoint returning all teams (not scoped by area)
- Returns `TeamListResponse` (id, name, functional_area_id)

### 3. Frontend: `useAllTeams()` hook
**File:** `frontend/src/hooks/useTeams.ts`
- New hook fetching `GET /api/teams/` for all teams across areas

### 4. Frontend: Fixed MembersPage team filter
**File:** `frontend/src/pages/MembersPage.tsx`
- Replaced `useTeams()` (always returned []) with `useAllTeams()`

### 5. Frontend: Filtered EntityMembersSheet to same-area members
**File:** `frontend/src/pages/TeamsPage.tsx`
- Prevents cross-area assignment by filtering available members

## Verification
- 173 backend tests pass (2 new: area sync test + all-teams endpoint test)
- 135 frontend tests pass
