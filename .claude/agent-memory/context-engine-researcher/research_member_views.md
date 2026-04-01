---
name: research_member_views
description: 2026-03-31 full audit of member views — why functional_area, programs, and team don't appear in card/table views
type: project
---

## Root Cause: List vs. Detail Response Schema Mismatch

The list endpoint (`GET /api/members/`) returns `TeamMemberListResponse`, which only includes
`functional_area_id` (int) and `team_id` (int) — NOT the nested objects. The backend service
DOES eager-load `functional_area` and `team` via `selectinload`, but the Pydantic response
schema (`TeamMemberListResponse`) strips them because those nested fields are not declared.

The detail endpoint (`GET /api/members/{uuid}`) returns `TeamMemberDetailResponse`, which
includes `functional_area`, `team`, and `program_assignments` as nested objects.

## Schema Summary

**TeamMemberListResponse** (backend/app/schemas/team_member.py lines 83–99):
- Has: uuid, employee_id, first_name, last_name, title, city, state, image_path, email,
  slack_handle, functional_area_id, team_id, supervisor_name, functional_manager_name
- Missing: functional_area (object), team (object), program_assignments

**TeamMemberDetailResponse** (lines 110–139):
- Has everything including functional_area, team, program_assignments, history, supervisor,
  functional_manager

## Frontend Types

**TeamMemberList** (frontend/src/types/index.ts lines 77–92):
- Mirrors list schema: has functional_area_id, team_id, supervisor_name, functional_manager_name
- No nested objects

**TeamMember** (extends TeamMemberList, lines 94–113):
- Adds nested: functional_area?, team?, program_assignments?, supervisor?, functional_manager?

## Data Flow Per View

### Card View (MemberCard.tsx)
- Fed `filteredMembers` from `useMembers()` — list endpoint → `TeamMemberList[]`
- MemberCard.tsx lines 97–109: renders `member.functional_area?.name` and
  `member.program_assignments?.map(...)` — will always be undefined/empty from list data
- team is NOT rendered in MemberCard at all (only functional_area and programs badges)
- functional_manager_name IS rendered (line 131) — works because it's a flat string in list schema

### Table View (memberColumns.tsx)
- Also fed from the same `useMembers()` list query
- Uses local extended type `MemberRow` (lines 10–18) that adds optional nested objects —
  but these never arrive from the API because list schema doesn't include them
- functional_area column (lines 68–81): `row.functional_area?.name` — always "—"
- team column (lines 83–95): `row.team?.name` — always "—"
- programs column (lines 111–127): `row.program_assignments` — always "—"

### Detail Sheet (MemberDetailSheet.tsx)
- MemberDetailSheetWrapper in MembersPage.helpers.tsx calls `useMember(uuid)` — hits detail
  endpoint which DOES return nested objects
- functional_area, team, program_assignments, supervisor, functional_manager all render
  correctly here (lines 142–208)

## Fix Options

1. **Extend the list response schema** — add `functional_area`, `team`, and
   `program_assignments` to `TeamMemberListResponse`. The backend service already eager-loads
   them; only the Pydantic schema needs updating. This is a small change but makes list
   responses heavier.

2. **Frontend-side join** — use `functional_area_id` and `team_id` already in the list
   response to look up names from the separately-fetched `areas` and `teams` lists
   (MembersPage.tsx already fetches both at lines 82–83). No backend change needed.
   Programs cannot be resolved this way since program_assignments aren't in the list response.

3. **Switch card/table to batch detail fetches** — expensive, not recommended.

Option 2 is the lightest fix for functional_area and team. Programs require option 1.

## Why

**How to apply:** When asked to fix the card/table display, recommend option 2 for area/team
(zero backend change, data already available in MembersPage) and option 1 for programs
(requires backend schema change to add program_assignments to list response).
