# Feature 054: Team Lead Badge in Members Sheet

## Goal

When clicking a team on the Teams page and the EntityMembersSheet opens, visually denote which member is the team lead with a badge.

## Current State

- **TeamsPage** (`frontend/src/pages/TeamsPage.tsx`): `selectedTeam` is a full `Team` object with `lead_id` (UUID string or null). Passed to `EntityMembersSheet` at lines 164-185 but `lead_id` is NOT passed.
- **EntityMembersSheet** (`frontend/src/components/shared/EntityMembersSheet.tsx`): Props interface (lines 10-19) has no `leadId` prop. Member render loop at lines 112-146 shows name, title, and remove button — no badge/role mechanism.
- **Team type** (`frontend/src/types/index.ts`): `Team.lead_id: string | null` (line 31)
- **Member type**: `TeamMemberList.uuid` is a string — direct equality comparison with `lead_id` works.

## Implementation Touch Points (2 files, frontend only)

| File | Change |
|------|--------|
| `frontend/src/components/shared/EntityMembersSheet.tsx` | Add optional `leadId` prop; render "Lead" badge when `member.uuid === leadId` |
| `frontend/src/pages/TeamsPage.tsx` | Pass `leadId={selectedTeam?.lead_id}` to EntityMembersSheet |

## Design Options

1. **Text badge** (amber, matching team node styling): `<span className="...bg-amber-100 text-amber-700">Lead</span>`
2. **Crown icon** from `lucide-react` (already installed) inline with name
3. Both — icon + badge

## Risks

- None significant. `leadId` prop is optional, so program/area usages of EntityMembersSheet are unaffected.
- If `lead_id` points to a member not in the team, the badge simply doesn't render (safe no-op).
- No backend changes needed — `lead_id` is already on the `Team` object.

## Dependencies

None.
