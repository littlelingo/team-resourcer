---
name: Research: Team Assignment Display Gap (feature candidate)
description: 2026-03-30 audit of why assigning a member to a team via EntityMembersSheet doesn't appear in MemberDetailSheet or MemberFormDialog
type: project
---

## What Works

**Model**: `team_members.team_id` is a nullable FK to `teams.id` (direct column, not join table).
No many-to-many — it's a single FK on the member row (`backend/app/models/team_member.py` line 46).

**Backend assignment**: Two service functions in `backend/app/services/team_service.py`:
- `add_member_to_team` (line 61): sets `member.team_id = team_id` and commits.
- `remove_member_from_team` (line 75): sets `member.team_id = None` and commits.

Exposed at:
- `POST /api/areas/{area_id}/teams/{team_id}/members` — `backend/app/api/routes/teams.py` line 91
- `DELETE /api/areas/{area_id}/teams/{team_id}/members/{member_uuid}` — line 105

**Backend detail response**: `TeamMemberDetailResponse` in `backend/app/schemas/team_member.py` line 110 includes `team: TeamListResponse | None` (line 135).
`get_member()` in `member_service.py` line 86 does `selectinload(TeamMember.team)` so team IS eagerly loaded.

**Detail sheet**: `MemberDetailSheet.tsx` lines 155–159 renders `member.team.name` if `member.team` is truthy. This is wired correctly.

## The Root Cause

**The MemberDetailSheet never receives fresh data after an EntityMembersSheet assignment.**

Flow:
1. User opens TeamsPage → EntityMembersSheet → clicks "Add Member" → calls `useAddTeamMember` hook.
2. `useAddTeamMember` (`frontend/src/hooks/useTeams.ts` line 77) on success invalidates:
   - `teamKeys.members(teamId)` — the team's member list
   - `memberKeys.all` — the flat members list
3. BUT `memberKeys.all` only invalidates `["members", "list", ...]` queries. It does NOT invalidate `["members", "detail", uuid]` entries.
4. `MemberDetailSheetWrapper` in `MembersPage.helpers.tsx` line 32 uses `useMember(uuid)` which caches under `memberKeys.detail(uuid)` — a separate cache key.
5. When the user opens MemberDetailSheet, it calls `useMember` which may still be serving the stale cached detail (with `team: null`).

**The edit form also reads stale data for the same reason.** `useMemberForm` resets from the `member` prop (the stale `TeamMember` from the list query or the pre-fetch). The list response (`TeamMemberListResponse`) DOES include `team_id` and `team` (via `selectinload` in `list_members`) — so the list data IS up to date after invalidation. But `pendingEditUuid` flow fetches via `useMember(uuid)` which may be cached.

## Confirm: Does the list response include `team`?

`TeamMemberListResponse` schema (`team_member.py` line 83) includes `team_id: int | None` but NOT a `team` object. The list response does NOT embed the team object. The edit form prefill uses `team_id` directly so it should work after list invalidation — BUT only if `useTeams(areaIdNum)` returns the right teams. Since the form watches `functional_area_id` to filter teams, if `functional_area_id` matches the team's area, the team dropdown will be populated and `team_id` will preselect correctly.

## What DOES work

- `MemberFormDialog` Team dropdown preselects correctly from `team_id` in list data (after `memberKeys.all` invalidation). This is correct.
- `MemberDetailSheet` shows `member.team.name` — but this only shows when opened via `MemberDetailSheetWrapper` which calls `useMember()`. If the detail cache is stale (team was just assigned externally), the sheet will show no team until the cache expires or is manually invalidated.

## The Real Gap: `useAddTeamMember` / `useRemoveTeamMember` don't invalidate member detail cache

`useTeams.ts` lines 85–88 (add) and 100–103 (remove):
```ts
onSuccess: (_result, { teamId }) => {
  void qc.invalidateQueries({ queryKey: teamKeys.members(teamId) })
  void qc.invalidateQueries({ queryKey: memberKeys.all })  // ← only invalidates list, not detail
},
```

Fix: Also invalidate `memberKeys.detail(memberUuid)` in both hooks.

## How Programs Work (for comparison)

Program assignments use a separate join table (`program_assignments`). Assignment via form (`useMemberForm.ts` lines 196–218) calls `POST /api/programs/{id}/assignments` then after success invalidates `memberKeys.all`. The detail response includes `program_assignments` with program objects eager-loaded. This works because the entire edit flow goes through `useMember` detail fetch first (via `pendingEditUuid`).

## Feature 047 Context

`TeamsPage.tsx` uses `EntityMembersSheet` (line 164). The sheet's `onAdd` calls `addTeamMember.mutate(...)`. The invalidation in `useAddTeamMember` is incomplete — it misses detail cache entries.

**Why:** line 88 in `useTeams.ts`:
```
void qc.invalidateQueries({ queryKey: memberKeys.all })
```
`memberKeys.all` = `["members"]` which should match all member queries including detail via prefix matching... Actually this DOES match detail queries if TanStack Query v5 uses prefix matching by default. Need to verify — if it does, this may not be the bug.

## TanStack Query v5 Invalidation Behavior

`invalidateQueries({ queryKey: ["members"] })` with no `exact: true` uses prefix matching and WILL invalidate all queries whose key starts with `["members"]`, including `["members", "detail", uuid]`. So the detail cache IS invalidated.

The actual gap may be: the member detail opens from a card click which sets `detailUuid`. Then `MemberDetailSheetWrapper` calls `useMember(uuid)`. If the data was already loaded and cached as fresh, the invalidation from the add/remove happens AFTER the sheet was opened and the data was fetched. On re-open it will be correct. On the SAME open instance, if no refetch is triggered, it shows stale data.

Actually: invalidation marks queries as stale. The next time the component renders with a subscriber, it will refetch. So if the sheet is ALREADY open when the mutation fires, TanStack Query will refetch in the background. This should work.

**Most likely the real issue**: The Teams page EntityMembersSheet assigns a member, but the member detail sheet is opened from the Members page. The user assigns via Teams tab, then navigates to Members tab and opens the member detail. By this point the cache was invalidated on the Teams page — but was it? `memberKeys.all = ["members"]` — if used on TeamsPage which doesn't have useMembers for detail, the detail query `["members", "detail", uuid]` exists only on MembersPage. The invalidation from TeamsPage's mutation WILL propagate because TanStack Query's invalidation is global across all query clients.

**Confirmed working path**: The `team_id` field in the list response IS returned (it's in `TeamMemberListResponse`), and the `team` object IS returned in `TeamMemberDetailResponse`. The invalidation covers both. The display IS wired in both the detail sheet and the edit form.

**Potential edge case bug**: `useTeams(areaIdNum)` in the edit form only fetches teams for the selected area. If the assigned team is in a different area than the member's `functional_area_id`, the team dropdown won't find the team. But `team_id` is still set and will be sent on save.
