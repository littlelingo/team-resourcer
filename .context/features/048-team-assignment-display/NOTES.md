# Research: Team Assignment Not Reflected in Member Detail/Edit

## Bug
After assigning a member to a team via the Teams page EntityMembersSheet, the assignment is not reflected in the member detail sheet or member edit form.

## Architecture

### Backend (correct)
- `add_member_to_team` (`team_service.py:61-72`): Sets `member.team_id = team_id`, commits. Works correctly.
- `get_member` (`member_service.py:86-104`): Uses `selectinload(TeamMember.team)` — correctly eager-loads team relationship.
- `TeamMemberDetailResponse` (`schemas/team_member.py:110-139`): Includes both `team_id: int | None` and `team: TeamListResponse | None`.
- `TeamMemberListResponse` (`schemas/team_member.py:83-99`): Includes `team_id: int | None` (but no `team` object).

### Frontend Detail Sheet (looks correct)
- `MemberDetailSheetWrapper` (`MembersPage.helpers.tsx:21-41`): Uses `useMember(uuid)` for fresh detail fetch.
- `MemberDetailSheet` (`MemberDetailSheet.tsx:155-159`): Renders `member.team.name` if `member.team` is truthy.
- Data flow: `useMember(uuid)` → GET `/api/members/{uuid}` → includes `team` object → renders team name.

### Frontend Edit Form (potential issues)
- `useMemberForm` (`useMemberForm.ts:82-84`): Team dropdown scoped by member's area:
  ```typescript
  const selectedAreaId = form.watch('functional_area_id')
  const areaIdNum = selectedAreaId ? parseInt(selectedAreaId, 10) : undefined
  const { data: teams = [] } = useTeams(areaIdNum)
  ```
- Form prefills `team_id: member?.team_id != null ? String(member.team_id) : null` (line 72, 117).
- Team options come from `useTeams(areaIdNum)` — only teams in the member's functional area.

### Cache Invalidation (correct)
- `useAddTeamMember` (`useTeams.ts:85-88`): Invalidates `teamKeys.members(teamId)` and `memberKeys.all`.
- `memberKeys.all = ["members"]` prefix-matches both list and detail queries in TanStack Query v5.

## Root Cause Analysis

### Issue 1: Cross-area team assignment (EDIT FORM)
**`add_member_to_team` sets ONLY `team_id` — does NOT update `member.functional_area_id`.**

If a member in area 5 is assigned to a team in area 8:
- `member.team_id` → set to team in area 8
- `member.functional_area_id` → remains 5
- Edit form's `useTeams(5)` → fetches teams in area 5 only
- Team (in area 8) does NOT appear in dropdown options
- Radix Select shows "Select team" placeholder (value exists but no matching option)

The EntityMembersSheet on TeamsPage shows ALL members (`useMembers()` with no filters), so cross-area assignment IS possible.

### Issue 2: Detail sheet should work but...
The detail sheet uses `member.team` object (not `team_id`), loaded via `selectinload`. This should work regardless of area mismatch. If the user reports the detail sheet also doesn't show the team, it may be:
- A cache timing issue (old cached data served briefly before refetch)
- Or the user may be looking at the member CARD (which uses list data without `team` object) rather than the detail sheet

### Issue 3: MembersPage Teams filter is broken (separate bug)
`MembersPage.tsx:83`: `const { data: teams = [] } = useTeams()` — called with NO `areaId`.
`useTeams()` with no `areaId` returns `Promise.resolve([] as Team[])` — always empty.
The "Team" filter dropdown on MembersPage has zero options.

## Key Files

| File | Line | Role |
|------|------|------|
| `backend/app/services/team_service.py` | 61-72 | `add_member_to_team` — sets team_id only |
| `backend/app/services/member_service.py` | 86-104 | `get_member` — eager loads team |
| `backend/app/schemas/team_member.py` | 110-139 | Detail response with team object |
| `frontend/src/components/members/MemberDetailSheet.tsx` | 155-159 | Renders team name |
| `frontend/src/components/members/useMemberForm.ts` | 82-84 | Team dropdown scoped to member's area |
| `frontend/src/components/members/MemberFormDialog.tsx` | 211-225 | Team field in edit form |
| `frontend/src/hooks/useTeams.ts` | 77-89 | `useAddTeamMember` with invalidation |
| `frontend/src/pages/MembersPage.tsx` | 83 | `useTeams()` — broken, no areaId |
| `frontend/src/pages/TeamsPage.tsx` | 170 | EntityMembersSheet shows ALL members |

## Fix Options

### For Issue 1 (primary fix):
**Option A (recommended):** When assigning a member to a team, also update their `functional_area_id` to match the team's area. This keeps the member's area consistent with their team. Change `add_member_to_team` to set both `member.team_id` AND `member.functional_area_id = team.functional_area_id`.

**Option B:** In `EntityMembersSheet` on TeamsPage, filter available members to only those in the same functional area as the team. Prevents cross-area assignment entirely.

**Option C:** In the edit form, change `useTeams(areaIdNum)` to fetch ALL teams (not scoped by area) when the member already has a `team_id`. Or always show the currently assigned team in the dropdown regardless of area filtering.

### For Issue 3 (MembersPage filter):
Change `useTeams()` on MembersPage line 83 to fetch all teams across all areas (backend already supports `GET /api/areas/{areaId}/teams/` per area but there's no "all teams" endpoint). Options:
- Add a backend endpoint for all teams (no area filter)
- Use `useAllTeams()` pattern from TeamsPage
- Scope the teams filter to the selected area filter (chain filters)

## Open Questions
1. Is the user's member in the SAME area as the team, or a different area? This determines which fix path to prioritize.
2. Should the EntityMembersSheet on TeamsPage restrict assignment to same-area members?
