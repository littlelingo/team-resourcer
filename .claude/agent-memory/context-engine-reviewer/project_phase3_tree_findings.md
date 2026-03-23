---
name: Phase 3 tree views review findings
description: Security and simplification findings from the Phase 3 tree views review (2026-03-23)
type: project
---

Phase 3 adds three tree-view pages (OrgTreePage, ProgramTreePage, AreaTreePage) backed by tree_service.py and a useDragReassign hook for reassignment via drag events.

**Why:** Review of Phase 3 implementation for security and simplification issues.
**How to apply:** When reviewing future changes to tree views, drag-reassign, or org/program/area data endpoints, use these as the known baseline.

## Critical bugs found

1. **useDragReassign.ts:83** — Drag-drop for 'org' case calls `PATCH /api/members/${draggedUuid}` but the backend members router only has `PUT /members/{uuid}`. PATCH will return 405. This is the same HTTP method mismatch documented in Phase 2 (feedback_http_method_mismatch.md).

2. **MemberNode.tsx:10,19** — `MemberNodeData` type declares field `image` but `tree_service.py` builds the node data dict with key `image_path`. `data.image` is always undefined; all member profile images are silently blank in tree views.

3. **tree_service.py:17-19** — `build_org_tree` issues a bare `select(TeamMember)` with no limit. On a large org this loads every member into memory in a single query — no pagination, no cap. More importantly, it loads salary, bonus, and pto_used into ORM objects even though those fields are never added to the node data dict. This is safe as written but fragile — any future expansion of the data dict risks accidentally exposing sensitive fields.

4. **useDragReassign.ts:76,82** — `draggedUuid` is cast from `node.data?.uuid as string | undefined` without any format validation before being interpolated into API paths (`/api/members/${draggedUuid}`). A node with a missing or malformed uuid would produce a garbled URL. Same issue as Phase 2 useMember raw UUID pattern.

## Warnings

1. **tree_service.py:36-39** — Org tree node data includes `employee_id`, `email`, `functional_area_id`, `team_id`, and `supervisor_id` for every member. `email` and `employee_id` are PII fields being broadcast to the client inside the tree payload. The program-tree and area-tree member nodes do not include these — the exposure is inconsistent and unintentional.

2. **useDragReassign.ts:98** — Area reassign sets `team_id: null` when the target is an area node (`targetNode.type === 'area'`), silently removing team membership. This is a destructive side-effect not surfaced to the user in the confirmation dialog verb ("move to team" is always shown). If a member is dropped on an area node, the dialog says "move to team [area name]" which is incorrect.

3. **useDragReassign.ts:61-65** — The closest-node search never applies a `SNAP_DISTANCE` early-out before the full O(N) loop. For large orgs this is fine, but the distance check only gates the final `setPendingReassign` — any drag-stop over a large graph still iterates every node.

4. **useTreeSearch.ts:18-19** — `_opacity` is destructured out and then immediately `void`-ed to silence the unused-variable lint error. This is a code smell; the intent is to remove the `opacity` key from the style object. A cleaner approach is `const { opacity: _, ...restStyle } = ...` using `_` as the discard convention, or just omitting the destructure and using `Object.fromEntries(Object.entries(...).filter(...))`.

5. **OrgTreePage.tsx:62** — `rawEdges` is passed directly to `TreeCanvas` after `layoutNodes` and `searchedNodes` have been derived from `rawNodes`. This means edge rendering is always based on the original (non-layout-adjusted) positions. For ReactFlow this is fine since edges reference node IDs not coordinates, but it creates a subtle inconsistency: searched/dimmed nodes still have visible full-opacity edges. This is a UX gap, not a bug.

## Simplification findings

1. **ProgramTreePage.tsx and AreaTreePage.tsx** — These two pages are nearly identical: same state shape (searchQuery, selectedMemberId, numericId), same hooks (useTreeLayout, useTreeSearch, useDragReassign, invalidation), same conditional render pattern (no ID → empty state → loading spinner → canvas), same inline Select dropdown with ~50 lines of identical JSX. The only differences are the data hook, nodeTypes dict, verb string, and area/program label. A shared `EntityTreePage` component accepting `treeHook`, `entityListHook`, `nodeTypes`, `verb`, `title`, and `treeType` would reduce ~120 lines of duplication.

2. **OrgTreePage.tsx** — Has its own loading state while ProgramTreePage/AreaTreePage use a ternary conditional. The loading state is rendered outside the canvas area (replaces entire page) in OrgTreePage but inside the canvas area in the other two. Inconsistent.

3. **AreaNode.tsx, ProgramNode.tsx, TeamNode.tsx** — All three are nearly identical: a `w-[200px] rounded-lg border bg-* shadow-sm` wrapper with a `p-3` inner div and a source Handle. Only colors and an optional subtitle line differ. A single `EntityNode` component with a `color` and optional `subtitle` prop would eliminate ~50 lines.

4. **useTrees.ts** — Clean and appropriately thin. No over-abstraction.

5. **useTreeLayout.ts** — Exports both `layoutTree` (pure function) and `useTreeLayout` (memoized hook). The pure function is unused outside the hook. Fine as-is but the export is unnecessary unless tests are planned.
