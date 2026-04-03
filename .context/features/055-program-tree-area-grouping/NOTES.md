# Feature 055: Program Tree — Group Members by Functional Area

## Goal

Update the program tree visualization from a flat star (program → members) to a grouped hierarchy: **Program → Functional Areas → Members**. Members are organized under their functional area within the program.

## Current State

### Backend — `build_program_tree` (tree_service.py lines 51-102)
- Emits one `program` root node and one `member` node per assignment
- Direct edges from program to each member — **flat star, no grouping**
- Query joins `ProgramAssignment` + `TeamMember` but does NOT load `TeamMember.functional_area`
- `functional_area_id` is available on `TeamMember` (non-nullable FK) but unused
- Member data includes `role` from `ProgramAssignment.role`

### Frontend — ProgramTreePage.tsx
- `nodeTypes` map: only `{ program: ProgramNode, member: MemberNode }` — no area node type
- Uses `useProgramTree` hook → `useTreeLayout` (Dagre, TB) → `useTreeSearch` → injects `onSelect` on member nodes
- `useDragReassign` wired with context `'program'`

### Existing Components
- **AreaNode.tsx**: exists with green styling (`border-green-200 bg-green-50`), but only has a `source` handle (bottom) — needs `target` handle (top) to serve as mid-level grouping node
- **ProgramNode.tsx**: blue styling, source handle only (root node)
- **MemberNode.tsx**: has `role` badge support, `onSelect` click handler

## Implementation Touch Points

### Backend (1 file)
| File | Change |
|------|--------|
| `backend/app/services/tree_service.py` | Rewrite `build_program_tree`: load `TeamMember.functional_area`, group members by area, emit area grouping nodes + edges |

**New tree structure:**
```
program-{id}           (program node — root)
  ├── area-{area_id}   (functional area node — grouping)
  │   ├── member-{uuid} (member node — leaf)
  │   └── member-{uuid}
  ├── area-{area_id}
  │   └── member-{uuid}
  └── unassigned       (members with no functional_area — edge case, shouldn't happen since FK is non-nullable)
```

**Query change:** Add `selectinload(TeamMember.functional_area)` to the member query, or join `FunctionalArea` directly.

**Grouping logic:**
1. Collect all members from assignments
2. Group by `member.functional_area_id`
3. For each unique area: emit an area node + edge from program
4. For each member in that area: emit a member node + edge from area node

### Frontend (2 files)
| File | Change |
|------|--------|
| `frontend/src/components/trees/nodes/AreaNode.tsx` | Add `target` handle (top) so it can receive edges from parent program node |
| `frontend/src/pages/trees/ProgramTreePage.tsx` | Register `area: AreaNode` in `nodeTypes` map |

## Risks & Known Errors

- **MissingGreenlet (error index, feature 050)**: If `selectinload(TeamMember.functional_area)` is missing, accessing `member.functional_area.name` during tree building will crash. Must eager-load.
- **AreaNode shared component**: Adding a `target` handle to `AreaNode.tsx` affects the area tree too (where it's the root). However, having an unused target handle on a root node is harmless — React Flow simply won't draw an edge to it.
- **useDragReassign**: Adding a new `area` node type may affect drag behavior. Need to verify `useDragReassign` doesn't treat area nodes as valid drop targets for member reassignment.
- **useTreeSearch**: Area nodes should be searchable by name — the search hook operates on `node.data.name` generically, so this should work automatically.

## Open Questions

1. Should members with no functional area be grouped under an "Unassigned" node? (`functional_area_id` is non-nullable, so this shouldn't happen)
2. Should the area grouping nodes be clickable? (Probably not — they're just organizational)
3. Should area nodes show a member count? (Nice to have, but not required for initial implementation)

## Dependencies

- Feature 053 (tree-lead-on-team-node) established the pattern for modifying tree_service.py
- AreaNode.tsx already exists — just needs a target handle
