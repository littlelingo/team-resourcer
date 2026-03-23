---
name: phase3_progress
description: Phase 3 PRP implementation progress — Steps 1-15 complete as of 2026-03-23 (all tree pages, routing, sidebar navigation)
type: project
---

Phase 3 Steps 1-15 complete as of 2026-03-23. Step 16 (optional PNG export) is remaining.

**Why:** Phase 3 adds interactive tree views using @xyflow/react v12 + dagre.

**How to apply:** All backend (Steps 2-4), frontend foundation (Steps 1, 5-8), hooks + panels (Steps 9-11), and tree pages + routing (Steps 12-15) are complete. Only optional Step 16 (PNG export) remains.

## Steps 2-4 (2026-03-23) — Backend

Files created:
- `backend/app/schemas/tree.py` — TreeNodePosition, TreeNode, TreeEdge, TreeResponse Pydantic models
- `backend/app/services/tree_service.py` — build_org_tree, build_program_tree, build_area_tree (all async, return None on 404)

Files modified:
- `backend/app/schemas/__init__.py` — added tree schema exports
- `backend/app/services/__init__.py` — added tree service exports
- `backend/app/api/routes/org.py` — replaced get_org_tree handler (now TreeResponse)
- `backend/app/api/routes/programs.py` — added GET /{program_id}/tree
- `backend/app/api/routes/areas.py` — added GET /{area_id}/tree

Key decisions:
- Tree service functions return None on not-found (routes handle 404)
- No new router file needed; tree endpoints added to existing routers
- selectinload(Team.lead) for eager-load in build_area_tree

Verified: GET /api/org/tree, /api/programs/1/tree, /api/areas/1/tree all return correct shape.

## Step 1 — Frontend Dependencies (2026-03-23)

Installed: `@xyflow/react`, `@dagrejs/dagre` (runtime), `@types/dagre` (devDep).

Import pattern for dagre (use @dagrejs/* packages, not the old `dagre` package):
```typescript
import { Graph } from '@dagrejs/graphlib'
import { layout } from '@dagrejs/dagre'
```

`g.node(id)` returns `NodeLabel | undefined` — cast to `{ x: number; y: number } | undefined`.

CSS import in `main.tsx`: `import '@xyflow/react/dist/style.css'` (already done).

## Steps 5-8 (2026-03-23) — Frontend Foundation

### Step 5 — Types + Hooks
- `frontend/src/types/trees.ts` — TreeNodePosition, TreeNodeData, TreeNode, TreeEdge, TreeData
- `frontend/src/hooks/useTrees.ts` — useOrgTree, useProgramTree(id>0), useAreaTree(id>0) using apiFetch

Note: hooks go in `src/hooks/` (not `src/api/`) to match existing project pattern.

### Step 6 — Dagre layout hook
- `frontend/src/components/trees/useTreeLayout.ts`
- Exports `layoutTree()` (plain fn) and `useTreeLayout()` (useMemo wrapper)
- Node size: width=220, height=90. Dagre returns centers; subtract half to get ReactFlow top-left.
- ranksep=80, nodesep=60

### Step 7 — Custom nodes
In `frontend/src/components/trees/nodes/`:
- `MemberNode.tsx` — avatar + initials fallback, name, title, role badge; data.onSelect callback
- `ProgramNode.tsx` — bg-blue-50/border-blue-200, source handle only (root node)
- `AreaNode.tsx` — bg-green-50/border-green-200, source handle only (root node)
- `TeamNode.tsx` — bg-amber-50/border-amber-200, top target + bottom source handles

Each file exports a typed `Node<DataType, 'typename'>` type alias.

### Step 8 — TreeCanvas
- `frontend/src/components/trees/TreeCanvas.tsx`
- ReactFlowProvider + ReactFlow + Controls + MiniMap + Background (BackgroundVariant.Dots)
- Container MUST have explicit height: `relative h-[calc(100vh-4rem)]`
- Props: nodes, edges, nodeTypes, onNodeClick (NodeMouseHandler), onNodeDragStop (OnNodeDrag), className, children

`tsc --noEmit` exits 0 after all steps. Lint issues in new files: zero (pre-existing Phase 2 issues remain).

## Steps 9-11 (2026-03-23) — Hooks + Panel components

### Step 9 — useDragReassign
- `frontend/src/components/trees/useDragReassign.ts`
- Exports `PendingReassign` interface and `useDragReassign(treeType, onSuccess)`
- Distance calc uses `node.measured?.width ?? node.width ?? 220` (ReactFlow v12 stores measured dimensions in `node.measured`)
- Snap threshold: 60px from center to center
- Valid target types: org=>'member', program=>'program', area=>('team'|'area')
- API calls: org uses PATCH /api/members/{uuid}, program uses POST /api/programs/{id}/assignments, area uses PATCH /api/members/{uuid} with team_id (null if target is area node)

### Step 10 — useTreeSearch
- `frontend/src/components/trees/useTreeSearch.ts`
- Returns same-length array with style.opacity=0.2 on non-matching nodes
- Empty query returns nodes unchanged (no opacity mutation)
- Matching logic: `data.name.toLowerCase().includes(query.toLowerCase())`

### Step 11 — Panel components (in `frontend/src/components/trees/panels/`)
- `ReassignConfirmDialog.tsx` — wraps @radix-ui/react-alert-dialog (same as ConfirmDialog); blue Confirm button (not red); verb prop for context-aware message
- `TreeSearchBar.tsx` — absolute top-4 right-4 z-10, white bg + shadow, lucide Search icon, 48px wide input
- `MemberDetailPanel.tsx` — slide-in from right using @radix-ui/react-dialog (same as MemberDetailSheet); fetches via useMember(memberId); shows avatar, contact, org, programs sections; no edit button (read-only panel)

## Steps 12-15 (2026-03-23) — Tree Pages + Routing

### Key interface notes
- `useTreeSearch(nodes, query)` returns `Node[]` directly (not `{ filteredNodes }`)
- `ReassignConfirmDialog` takes `draggedNode: Node | null` and `targetNode: Node | null` (not name strings)
- `useDragReassign` returns `confirmReassign` as an async function — call as `void confirmReassign()`
- Node `onSelect` callback injected into node.data after layout/search, just before passing to TreeCanvas

### Step 12 — OrgTreePage
- `frontend/src/pages/trees/OrgTreePage.tsx`
- Page title "Organization Chart" in a header div above TreeCanvas
- Container structure: `flex flex-col h-[calc(100vh-4rem)]` with `flex-1 relative` inner div for TreeCanvas
- Loading spinner centered while `isLoading` is true
- MemberNode onSelect wired via `nodesWithSelect` mapping after useTreeSearch

### Step 13 — ProgramTreePage
- `frontend/src/pages/trees/ProgramTreePage.tsx`
- `@radix-ui/react-select` (not shadcn/ui Select — no shadcn installed; project uses radix primitives directly)
- Navigates via `useNavigate()` to `/tree/programs/:id` on select change
- `numericId = id ? parseInt(id, 10) : 0` — 0 shows empty state, >0 fetches tree
- Empty state: "Select a program to view its tree"

### Step 14 — AreaTreePage
- `frontend/src/pages/trees/AreaTreePage.tsx`
- Same pattern as ProgramTreePage; uses `useFunctionalAreas()` hook (not `useAreas()`)
- Navigates to `/tree/areas/:id` on select change
- nodeTypes: area, team, member

### Step 15 — Routing + Sidebar
- `frontend/src/App.tsx` — added 5 routes: `/tree/org`, `/tree/programs`, `/tree/programs/:id`, `/tree/areas`, `/tree/areas/:id`
- `frontend/src/components/layout/AppLayout.tsx` — added `treeNavItems` array + section label "Tree Views"; added `GitBranch` to lucide imports; changed nav `<nav>` to include `overflow-y-auto`
- `@xyflow/react/dist/style.css` was already imported in `main.tsx` — no change needed

`tsc --noEmit` exits 0 after all steps.
