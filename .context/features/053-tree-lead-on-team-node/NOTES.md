# Feature 053: Show Team Lead on Team Node, Remove Duplicate Member Node

## Goal

In the area tree visualization:
1. Remove the team lead from appearing as a separate member node under the team
2. Show the team lead name on the team node itself (already done — `lead_name` is displayed)
3. Make the team node clickable so clicking it opens the lead's member detail panel

## Current State

### Backend — Tree Service
- **File**: `backend/app/services/tree_service.py`
- `build_area_tree` (lines 105-194) builds the tree with two queries:
  - Teams query with `selectinload(Team.lead)` — gets team + lead info
  - Members query — gets ALL members in the area, including leads
- Team nodes emit `data` with `lead_id` (str UUID) and `lead_name` (line ~150)
- Member nodes emit every member as a child node (line ~163) — **no guard to exclude leads**
- **Root cause**: the member loop does not cross-reference `team.lead_id` to skip lead members

### Frontend — Node Components
- **TeamNode** (`frontend/src/components/trees/nodes/TeamNode.tsx`):
  - Renders team name + `lead_name` (if present)
  - Has NO click handler, NO `onSelect` callback, NO `cursor-pointer` class
  - `TeamNodeData` type only declares `id`, `name`, `lead_name` — does NOT include `lead_id`
- **MemberNode** (`frontend/src/components/trees/nodes/MemberNode.tsx`):
  - Has `onSelect` in data, calls `data.onSelect?.(data.uuid)` on click
  - Has `cursor-pointer` class for clickability
  - Opens `MemberDetailPanel` via the page-level state

### Frontend — Page
- **AreaTreePage** (`frontend/src/pages/trees/AreaTreePage.tsx`):
  - Line 53: injects `onSelect` only for `node.type === 'member'` — team nodes get nothing
  - `selectedMemberId` state drives `MemberDetailPanel`

### Frontend — Detail Panel
- **MemberDetailPanel** (`frontend/src/components/trees/panels/MemberDetailPanel.tsx`):
  - Accepts `memberId: string | null` — works with any UUID
  - No changes needed — team node click can reuse this directly

## Implementation Touch Points (3 files)

| Layer | File | Change |
|-------|------|--------|
| Backend | `backend/app/services/tree_service.py` | Skip lead members from member node loop; collect `lead_uuids` set |
| Frontend | `frontend/src/components/trees/nodes/TeamNode.tsx` | Add `lead_id` to data type; add click handler calling `onSelect(lead_id)` |
| Frontend | `frontend/src/pages/trees/AreaTreePage.tsx` | Inject `onSelect` for team nodes too (not just member nodes) |

## Risks

- **Lead assigned to multiple teams**: A member could theoretically be lead of one team and a regular member of another. Excluding by UUID would hide them entirely. Need to only exclude the lead from the team they lead, not from all teams.
- **Team with no lead**: `lead_id` is nullable — click handler must guard against null. TeamNode should only show click behavior when `lead_id` is present.
- **Org tree unaffected**: `build_org_tree` is supervisor-hierarchy only (all member nodes, no teams) — this change does not apply there.

## Open Questions

1. Should the team node visually change when it has a lead (e.g., different styling to hint it's clickable)? Or just add cursor-pointer?
2. What if a lead is also a regular member of a different team in the same area? Should they still appear as a member node under that other team?

## Dependencies

None — all infrastructure exists.
