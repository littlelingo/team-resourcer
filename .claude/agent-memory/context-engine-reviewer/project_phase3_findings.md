---
name: phase3_review_findings
description: Phase 3 (Interactive Tree Views) review findings: critical bugs, fragile areas, and patterns to watch (2026-03-23)
type: project
---

Phase 3 adds three tree views with @xyflow/react v12 + dagre. Backend adds three GET endpoints returning flat node/edge lists.

**Why:** Second review pass — establishes what Phase 3 introduces and what fragile areas to watch for Phase 4.

**How to apply:** When reviewing Phase 4 work, check these areas especially if drag-reassign or tree data is touched.

## Critical bugs found

1. **useDragReassign.ts:83** — `confirmReassign` for org tree uses `PATCH /api/members/{uuid}` but the backend only exposes `PUT /api/members/{uuid}`. There is NO PATCH route — this will return 405 on every drag reassignment. The CORS middleware also only lists GET/POST/PUT/DELETE/OPTIONS — PATCH is not in `allow_methods`, so the preflight will fail too.

2. **useDragReassign.ts:83** — The org reassignment payload sends `{ supervisor_id }` to `PUT /api/members/{uuid}` (the general update endpoint), but `PUT /api/members/{uuid}` expects a full `MemberUpdate` schema. Sending only `supervisor_id` may leave all other fields as unset (fine if `exclude_unset=True` is used) but actually the correct endpoint for supervisor changes already exists: `PUT /api/org/members/{uuid}/supervisor`. Using the wrong endpoint bypasses any supervisor-specific validation in `set_supervisor`.

3. **useDragReassign.ts:99** — The area tree reassignment also uses `PATCH /api/members/{uuid}` for `{ team_id }`. Same 405 failure as above.

4. **MemberNode.tsx:19** — `MemberNode` reads `data.image` but the backend tree_service.py sends `image_path` as the field name. All member nodes in all three trees will render the initials fallback even when a photo exists.

5. **useDragReassign.ts:89-93** — Program reassignment fires a POST to create a new assignment but does NOT delete the old assignment first. A member can accumulate multiple assignments to the same program, violating the PRP's intent ("DELETE old + POST new") and potentially creating duplicate ProgramAssignment rows (FK allows it if no unique constraint on (program_id, member_uuid)).

## Warnings

1. **useTreeLayout.ts:29** — `layoutTree` calls `g.setEdge(edge.source, edge.target)` without first checking that both nodes exist in the graph. For the org tree, a dangling `supervisor_id` pointing to a deleted or cross-area member would produce a dagre error or silently place nodes at position (0, 0). No guard.

2. **org.py:15-19** — `GET /api/org/tree` calls `build_org_tree` which does a bare `select(TeamMember)` — no ordering. Node order is non-deterministic, making the layout output non-deterministic between backend restarts (session ordering).

3. **AppLayout.tsx:55-70** — The `NavLink` for `/tree/programs` and `/tree/areas` uses exact `to` prop so it matches active when on `/tree/programs` but NOT when on `/tree/programs/42`. The `isActive` highlight will drop out when a user actually selects a specific program. Consider using `end={false}` on these links.

4. **OrgTreePage.tsx:62-63** — `rawEdges` (un-laid-out) are passed to TreeCanvas but `nodesWithSelect` (laid-out, searched) are passed. ReactFlow requires that edges reference node IDs in the current nodes array — this works because IDs don't change, but passing stale edge objects while nodes are freshly mapped is a subtle mismatch that could cause issues if edges are ever enriched with node-level metadata.

5. **MemberDetailPanel.tsx:16** — `useMember(memberId ?? '')` is called with an empty string when memberId is null; the `enabled: Boolean(uuid)` guard in `useMember` handles this (empty string is falsy), but it means a query with key `['members', 'detail', '']` is registered in the cache on every mount. Minor noise.

6. **tree_service.py:178-193** — `build_area_tree` creates a `team → member` edge using `member.team_id` as the source node ID (`f"team-{member.team_id}"`). If a member has a `team_id` set to a team that is NOT in this area (data integrity issue), the edge will reference a non-existent node ID. Dagre and ReactFlow will not crash but the edge will render without a valid source.

## Patterns to watch in Phase 4

- `useDragReassign` uses `PATCH` for all member mutations — this pattern is wrong for the existing backend. If Phase 4 adds more drag mutations, verify HTTP method against backend route decorator each time.
- The `image` vs `image_path` field name discrepancy in node data is a pattern risk. Backend schema always uses `image_path`; the MemberNodeData type uses `image`. Any new tree node type that embeds member image data should be checked.
- No circular supervisor detection in `build_org_tree` — if a circular reference is created via the drag-reassign API, the dagre layout will loop indefinitely or produce a broken graph.
- `nodeTypes` records are defined as module-level constants (not inside the component) in all three page files — this is correct and avoids React re-creating the nodeTypes object on every render (a ReactFlow anti-pattern that causes node re-mounting).
