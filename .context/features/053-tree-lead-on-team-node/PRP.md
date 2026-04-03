# PRP: Show Team Lead on Team Node, Remove Duplicate Member Node

## Status: APPROVED

## Testing Strategy: implement-then-test

## Context
In the area tree, team leads appear as both a label on the team node and a separate member node. Remove the duplicate and make the team node clickable to open the lead's detail panel.

## Steps
- [ ] Step 1: Backend — build `lead_team_map`, skip leads from member node loop in `build_area_tree`
- [ ] Step 2: Frontend — add `lead_id`, `onSelect` to TeamNode; add click handler
- [ ] Step 3: Frontend — inject `onSelect` for team nodes in AreaTreePage

## Files
- `backend/app/services/tree_service.py`
- `frontend/src/components/trees/nodes/TeamNode.tsx`
- `frontend/src/pages/trees/AreaTreePage.tsx`
