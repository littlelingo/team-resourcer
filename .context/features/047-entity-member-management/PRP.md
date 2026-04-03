# PRP: Add/Remove Members from Entity Tabs

## Status: COMPLETE

## Context

Users want to manage member assignments directly from Programs, Areas, and Teams tabs. Previously only Programs had a read-only member sheet.

## Testing Strategy: implement-then-test

## Changes

### Created
- `frontend/src/components/shared/EntityMembersSheet.tsx` — Reusable right-side slide-out sheet with member list, add (SelectField picker), and remove (trash icon) controls

### Modified
- `frontend/src/hooks/useFunctionalAreas.ts` — Added `useAreaMembers` hook, `areaKeys.members` query key
- `frontend/src/hooks/useTeams.ts` — Added `useTeamMembers`, `useAddTeamMember`, `useRemoveTeamMember` hooks, `teamKeys.members` query key
- `frontend/src/pages/ProgramsPage.tsx` — Replaced inline ProgramMembersSheet with EntityMembersSheet, wired assign/unassign
- `frontend/src/pages/FunctionalAreasPage.tsx` — Added member sheet, selection state, area member add/remove via member update
- `frontend/src/pages/TeamsPage.tsx` — Added member sheet, selection state, team member add/remove
- `frontend/src/components/functional-areas/functionalAreaColumns.tsx` — Made name clickable (onSelect)
- `frontend/src/components/teams/teamColumns.tsx` — Made name clickable (onSelect)

## Verification

- `npx tsc --noEmit` — clean
- `cd frontend && npx vitest run` — 135 tests pass
