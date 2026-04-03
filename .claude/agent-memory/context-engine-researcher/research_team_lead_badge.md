---
name: research_team_lead_badge
description: 2026-04-03 research on adding a team lead badge in EntityMembersSheet for the Teams page
type: project
---

## Finding: Team lead badge in EntityMembersSheet

**Why:** The user wants a visual indicator (badge/icon) on the lead member row inside EntityMembersSheet when opened from TeamsPage.

### Data flow

1. `TeamsPage.tsx` — `selectedTeam` is a `Team` object; `Team.lead_id` (string | null) is available at line 44.
2. `EntityMembersSheet` is rendered at lines 164–185. Currently it receives no `lead_id` prop — it only receives `title`, `members`, `isLoading`, `allMembers`, `onAdd`, `onRemove`.
3. `useTeamMembers(teamId)` (line 57) calls `GET /api/members/?team_id={id}` — returns `TeamMemberList[]` from `TeamMemberListResponse`. **No lead information is in the member objects.**
4. `lead_id` lives on the `Team` object (already in-memory on `selectedTeam`), not on any member object.

### EntityMembersSheet — current render loop
- `frontend/src/components/shared/EntityMembersSheet.tsx` lines 112–146: renders a `<ul>` of member rows; each row shows avatar, name, title, and a remove button. No role/badge column exists.
- Props interface (lines 10–19): `open`, `onOpenChange`, `title`, `members: TeamMemberList[]`, `isLoading`, `allMembers`, `onAdd`, `onRemove`. No `leadId` prop.

### Team type
- `frontend/src/types/index.ts` lines 28–38: `Team` has `lead_id: string | null`. `TeamMemberList` (lines 81–99) does NOT have a `is_lead` or similar field.

### What needs to change

Frontend-only change — no backend work required:

1. **`EntityMembersSheet` props**: add optional `leadId?: string | null`
2. **Member row**: when `member.uuid === leadId`, render a badge (e.g. "Lead" chip or a Crown/Star icon from lucide-react)
3. **TeamsPage**: pass `leadId={selectedTeam?.lead_id}` to `<EntityMembersSheet>`

### No existing role/badge pattern in EntityMembersSheet
The component has no existing role rendering — it's a clean slate. The program assignments `ProgramAssignment.role` field exists in the type but is not rendered anywhere in EntityMembersSheet (the component always receives `TeamMemberList[]` regardless of caller).

### Suggested badge approach
- Lucide `Crown` icon (already available from lucide-react) placed to the left of the name, or
- A small `"Lead"` text badge (e.g. `<span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Lead</span>`)
- Place it inline in the `<div className="min-w-0 flex-1">` block, after the name `<p>`
