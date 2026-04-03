# PRP: Show Team Lead on Team Node, Remove Duplicate Member Node

## Status: COMPLETE

## Testing Strategy: implement-then-test

## Context
In the area tree, team leads appeared as both a label on the team node and a separate member node. Remove the duplicate and make the team node clickable to open the lead's detail panel.

## Steps
- [x] Step 1: Backend — build `lead_team_map`, skip leads from member node loop in `build_area_tree`
- [x] Step 2: Frontend — add `lead_id`, `onSelect` to TeamNode; add click handler with conditional cursor
- [x] Step 3: Frontend — inject `onSelect` for team nodes in AreaTreePage

## Files
- `backend/app/services/tree_service.py`
- `frontend/src/components/trees/nodes/TeamNode.tsx`
- `frontend/src/pages/trees/AreaTreePage.tsx`

## Verification
- [x] Backend tests pass (175/175)
- [x] Frontend tests pass (135/135)
- [x] Lint: no new errors
- [x] Code review: APPROVED (0 critical)
- [x] Manual: lead removed from member nodes, team node clickable, detail panel opens

## Review Notes
- Warning: no test for cross-team lead exclusion scoping (lead of Team A + member of Team B)
- Warning: minor click handler pattern divergence between TeamNode (conditional) and MemberNode (unconditional)
- Both are non-blocking; cross-team test recommended as follow-up
