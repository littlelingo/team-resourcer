---
feature: 001-team-resourcer-app
phase: 3 - Interactive Tree Views
status: DRAFT
created: 2026-03-22
testing: implement-then-test
complexity: HIGH
depends_on: PRP-phase2
---

# PRP: Phase 3 — Interactive Tree Views

## Overview

Phase 3 adds three fully interactive tree/org-chart views on top of the Phase 1 API and Phase 2 React shell: a Program Tree (programs → assigned members), a Functional Area Tree (areas → teams → members), and an Organization Tree (supervisor → direct reports, recursive). Each view supports drag-and-drop reassignment, expand/collapse, zoom/pan, search/filter, and a minimap. Three new backend endpoints supply nested JSON trees. The library of choice is `@xyflow/react` v12.

---

## Library Selection

**Selected: `@xyflow/react` v12 (package name `@xyflow/react`)**

### Evaluation Matrix

| Criterion | @xyflow/react v12 | d3-org-chart | reactflow v11 |
|-----------|-------------------|--------------|----------------|
| React integration | Native — components, hooks, context | Imperative d3, wrapped in useEffect | Native but older API |
| Layout algorithms | Needs `dagre` or `elkjs` (both well-supported) | Built-in, purpose-built for org charts | Same as v12 but older |
| Drag-drop nodes | First-class, built-in `onNodeDragStop` | Manual DOM events | Built-in, older API |
| Zoom/pan | Built-in `<Controls />` and `useReactFlow()` | Built-in | Built-in |
| Minimap | Built-in `<MiniMap />` component | No | Built-in |
| Custom nodes | Full JSX components as nodes — trivial to style with Tailwind/shadcn | Limited templating | Same as v12 but older |
| Expand/collapse | Manual node/edge toggling via `setNodes`/`setEdges` — full control | Built-in | Same pattern |
| Bundle size | ~150 KB gzipped (includes dagre) | ~60 KB but adds d3 (~250 KB) | ~140 KB |
| Maintenance | Active, Xyflow org, v12 released 2024 | Minimal activity since 2023 | Superseded by v12 |
| TypeScript | Full types, first-party | Types via DefinitelyTyped | Full types |

**Rationale:** `@xyflow/react` v12 is the only option with a fully React-native API (nodes are React components), a built-in minimap, built-in zoom/pan controls, and an active maintainer team. `d3-org-chart` has purpose-built layout but forces imperative d3 mutations into React lifecycle hooks — a mismatch that creates subtle bugs when state changes occur outside d3. `reactflow` v11 is effectively the same library but superseded. The one gap in v12 — hierarchical layout — is filled by `@dagrejs/dagre`, which is the standard companion and has no meaningful bundle penalty.

**Required packages:**
- `@xyflow/react` — graph canvas, controls, minimap
- `@dagrejs/dagre` — Sugiyama-style hierarchical layout (top-down trees)
- `@xyflow/react` ships its own CSS; import `@xyflow/react/dist/style.css` once in the app entry point

---

## Backend Additions

### New Endpoints (3 total)

All three endpoints return **flat node + edge lists** formatted for direct consumption by `@xyflow/react`. This is simpler than converting nested JSON client-side and keeps transformation logic in one place (the backend service layer).

#### Response shape (shared by all three endpoints)

```
{
  "nodes": [
    {
      "id": "string",          // unique stable ID, e.g. "member-<uuid>", "program-<id>"
      "type": "string",        // node type key: "program", "member", "area", "team"
      "data": { ... },         // all fields the node component needs to render
      "position": { "x": 0, "y": 0 }  // backend sends zeros; layout runs client-side
    }
  ],
  "edges": [
    {
      "id": "string",          // e.g. "edge-program-1-member-abc"
      "source": "string",      // node id
      "target": "string"       // node id
    }
  ]
}
```

The `position` field is always `{"x": 0, "y": 0}` from the backend. The frontend dagre layout pass overwrites positions before rendering. This keeps the API simple and lets the client control layout direction and spacing.

#### `GET /api/org/tree`

Returns the full supervisor hierarchy. Nodes: all TeamMembers. Edges: `supervisor_id → member.uuid` for every member with a supervisor. Members with no supervisor are root nodes.

Node `data` payload per member node:
- `uuid`, `name`, `title`, `image`, `employee_id`, `email`, `functional_area_id`, `team_id`, `supervisor_id`

#### `GET /api/programs/{id}/tree`

Returns a single program's tree. Nodes: the Program node + all TeamMembers assigned to it. Edges: `program → member` for each assignment.

Node `data` payload:
- Program node: `id`, `name`, `description`
- Member node: `uuid`, `name`, `title`, `image`, `role` (from ProgramAssignment.role)

#### `GET /api/areas/{id}/tree`

Returns a single functional area's tree. Nodes: the Area node + all Team nodes within that area + all Members in those teams + unassigned members (members in the area with `team_id = null`). Edges: `area → team`, `team → member`, `area → unassigned_member`.

Node `data` payload:
- Area node: `id`, `name`
- Team node: `id`, `name`, `lead_id`, `lead_name` (joined from TeamMember)
- Member node: `uuid`, `name`, `title`, `image`

### Backend Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/app/routers/trees.py` | CREATE | FastAPI router with the three GET tree endpoints |
| `backend/app/services/tree_service.py` | CREATE | Service functions that query the DB and build node/edge lists |
| `backend/app/schemas/tree.py` | CREATE | Pydantic response schemas: `TreeNode`, `TreeEdge`, `TreeResponse` |
| `backend/app/main.py` | MODIFY | Register `trees` router with prefix `/api` |

---

## Frontend Architecture

### Routing

Phase 2 established a React router. Phase 3 adds three new routes:

| Route | Component |
|-------|-----------|
| `/tree/org` | `OrgTreePage` |
| `/tree/programs/:id` | `ProgramTreePage` |
| `/tree/areas/:id` | `AreaTreePage` |

A nav entry "Tree Views" in the sidebar (added in Phase 2) expands to show links for Org Chart, and dropdowns/lists for Programs and Areas populated from existing TanStack Query data.

### Component Structure

```
frontend/src/
  pages/
    trees/
      OrgTreePage.tsx           -- fetches /api/org/tree, renders OrgTreeCanvas
      ProgramTreePage.tsx       -- fetches /api/programs/:id/tree, renders ProgramTreeCanvas
      AreaTreePage.tsx          -- fetches /api/areas/:id/tree, renders AreaTreeCanvas
  components/
    trees/
      TreeCanvas.tsx            -- shared wrapper: ReactFlow + Controls + MiniMap + Background
      useTreeLayout.ts          -- hook: runs dagre layout on raw nodes/edges, returns positioned nodes
      useDragReassign.ts        -- hook: handles onNodeDragStop, shows confirmation dialog, fires PATCH
      useTreeSearch.ts          -- hook: filters/highlights nodes by search string
      nodes/
        MemberNode.tsx          -- custom node: avatar thumbnail, name, title, badge slot
        ProgramNode.tsx         -- custom node: program name, description snippet
        AreaNode.tsx            -- custom node: area name
        TeamNode.tsx            -- custom node: team name, lead name
      panels/
        MemberDetailPanel.tsx   -- slide-in panel shown on node click (reuses Phase 2 detail component)
        ReassignConfirmDialog.tsx -- confirmation dialog before committing drag-drop
        TreeSearchBar.tsx       -- search input that feeds useTreeSearch
```

### Frontend Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/pages/trees/OrgTreePage.tsx` | CREATE | Org chart page — fetches tree, wires canvas |
| `frontend/src/pages/trees/ProgramTreePage.tsx` | CREATE | Program tree page |
| `frontend/src/pages/trees/AreaTreePage.tsx` | CREATE | Area tree page |
| `frontend/src/components/trees/TreeCanvas.tsx` | CREATE | Shared ReactFlow canvas wrapper |
| `frontend/src/components/trees/useTreeLayout.ts` | CREATE | Dagre layout hook |
| `frontend/src/components/trees/useDragReassign.ts` | CREATE | Drag reassignment logic and confirmation |
| `frontend/src/components/trees/useTreeSearch.ts` | CREATE | Search/filter/highlight logic |
| `frontend/src/components/trees/nodes/MemberNode.tsx` | CREATE | Member custom node component |
| `frontend/src/components/trees/nodes/ProgramNode.tsx` | CREATE | Program custom node component |
| `frontend/src/components/trees/nodes/AreaNode.tsx` | CREATE | Area custom node component |
| `frontend/src/components/trees/nodes/TeamNode.tsx` | CREATE | Team custom node component |
| `frontend/src/components/trees/panels/MemberDetailPanel.tsx` | CREATE | Slide-in member detail |
| `frontend/src/components/trees/panels/ReassignConfirmDialog.tsx` | CREATE | Drag-drop confirmation dialog |
| `frontend/src/components/trees/panels/TreeSearchBar.tsx` | CREATE | Search input component |
| `frontend/src/api/trees.ts` | CREATE | TanStack Query hooks: `useOrgTree`, `useProgramTree`, `useAreaTree` |
| `frontend/src/main.tsx` | MODIFY | Add `import '@xyflow/react/dist/style.css'` |
| `frontend/src/App.tsx` (or router file) | MODIFY | Add three tree routes |
| `frontend/src/components/layout/Sidebar.tsx` | MODIFY | Add tree view nav links |
| `frontend/package.json` | MODIFY | Add `@xyflow/react`, `@dagrejs/dagre`, `@types/dagre` |

---

## Implementation Steps

### Step 1 — Install frontend dependencies
- File: `frontend/package.json`
- Run inside `frontend/`: `npm install @xyflow/react @dagrejs/dagre @types/dagre`
- Verify: `node_modules/@xyflow/react` exists, TypeScript compiles without errors on `npx tsc --noEmit`

### Step 2 — Backend: Pydantic schemas for tree responses
- File: `backend/app/schemas/tree.py`
- Define `TreeNodeData` as a flexible dict (`dict[str, Any]`) to accommodate different node types
- Define `TreeNode(id: str, type: str, data: TreeNodeData, position: dict)`
- Define `TreeEdge(id: str, source: str, target: str)`
- Define `TreeResponse(nodes: list[TreeNode], edges: list[TreeEdge])`
- Verify: `python -c "from app.schemas.tree import TreeResponse"` succeeds

### Step 3 — Backend: Tree service layer
- File: `backend/app/services/tree_service.py`
- Implement `build_org_tree(db: Session) -> TreeResponse`:
  - Query all `TeamMember` rows
  - Build one node per member: `id = f"member-{member.uuid}"`, `type = "member"`, `data` includes all fields listed in the endpoint spec above, `position = {"x": 0, "y": 0}`
  - Build one edge per member where `supervisor_id` is not null: `id = f"edge-{supervisor_id}-{member.uuid}"`, `source = f"member-{supervisor_id}"`, `target = f"member-{member.uuid}"`
  - Return `TreeResponse`
- Implement `build_program_tree(program_id: int, db: Session) -> TreeResponse`:
  - Query `Program` by id (raise 404 if not found)
  - Query `ProgramAssignment` rows joined to `TeamMember` where `program_id` matches
  - Build program node: `id = f"program-{program.id}"`, `type = "program"`
  - Build member nodes with `role` field from the join table
  - Build edges from program node to each member node
  - Return `TreeResponse`
- Implement `build_area_tree(area_id: int, db: Session) -> TreeResponse`:
  - Query `FunctionalArea` by id (raise 404 if not found)
  - Query all `Team` rows for this area, join `TeamMember` for lead name
  - Query all `TeamMember` rows where `functional_area_id = area_id`
  - Build area node, team nodes, member nodes
  - Edges: area → team, team → member (for members with team_id set), area → member (for members with team_id = null)
  - Return `TreeResponse`
- Verify: unit test each function with a seeded in-memory SQLite session or via pytest fixtures; confirm node count and edge count match expected values for a known data set

### Step 4 — Backend: Tree router
- File: `backend/app/routers/trees.py`
- Create `APIRouter(prefix="/org", tags=["trees"])` — note: org tree lives under `/api/org/tree` so prefix is `/org`
- `GET /tree` → calls `build_org_tree`, returns `TreeResponse`
- Create additional `APIRouter` entries for programs and areas, OR add these endpoints to existing `programs.py` and `areas.py` routers as new path operations — prefer adding to existing routers to avoid prefix confusion:
  - In `backend/app/routers/programs.py`: add `GET /{id}/tree` → `build_program_tree`
  - In `backend/app/routers/areas.py`: add `GET /{id}/tree` → `build_area_tree`
  - `backend/app/routers/trees.py` is only needed for the org tree endpoint
- Register `trees` router in `backend/app/main.py` with `app.include_router(trees_router, prefix="/api")`
- Verify:
  - `GET /api/org/tree` returns 200 with `{"nodes": [...], "edges": [...]}`
  - `GET /api/programs/1/tree` returns 200 (with at least a program node)
  - `GET /api/areas/1/tree` returns 200
  - Test with `curl` or the FastAPI `/docs` Swagger UI

### Step 5 — Frontend: TanStack Query hooks for tree data
- File: `frontend/src/api/trees.ts`
- Implement `useOrgTree()`: `useQuery({ queryKey: ['org-tree'], queryFn: () => fetch('/api/org/tree').then(r => r.json()) })`
- Implement `useProgramTree(id: number)`: same pattern, `queryKey: ['program-tree', id]`, url `/api/programs/${id}/tree`, enabled only when `id` is defined
- Implement `useAreaTree(id: number)`: same pattern
- Types: define `TreeNode`, `TreeEdge`, `TreeData` TypeScript interfaces matching the backend schema — place in `frontend/src/types/trees.ts`
- Verify: TypeScript compiles. In a browser console after Phase 2 shell is running, `fetch('/api/org/tree')` returns the expected shape

### Step 6 — Frontend: dagre layout hook
- File: `frontend/src/components/trees/useTreeLayout.ts`
- Accept `(nodes: TreeNode[], edges: TreeEdge[], direction: 'TB' | 'LR' = 'TB')` as parameters
- Use `dagre.graphlib.Graph`, set `rankdir` to direction, `ranksep: 80`, `nodesep: 60`
- Set each node in the dagre graph using a fixed estimated size (`width: 200, height: 80`) — the actual rendered node size will be close to this; it can be tuned after seeing output
- Call `dagre.layout(g)`
- Return a new `nodes` array with `position` set from `g.node(id).x` and `g.node(id).y`
- This hook must be called after `nodes` and `edges` are loaded; it is a pure transformation (not a React hook that fires effects) — implement as a plain function exported alongside the hook for testability
- Verify: given a known 3-node linear chain `[A→B→C]`, the returned positions have strictly increasing Y values (for TB direction)

### Step 7 — Frontend: custom node components
- Files: `frontend/src/components/trees/nodes/*.tsx`

**MemberNode.tsx**
- Props: standard ReactFlow `NodeProps` with `data: { uuid, name, title, image, employee_id, role? }`
- Render: avatar (`<img>` with `image` url or fallback initials), name (bold), title (muted), optional role badge
- Include two `<Handle>` elements: `Position.Top` (type `target`) and `Position.Bottom` (type `source`) — required by ReactFlow for edge connections; set `style={{ opacity: 0 }}` to hide them visually since edges are structural, not user-drawn
- Apply Tailwind classes consistent with Phase 2 card styling (rounded-lg, shadow-sm, bg-white, border)
- Clicking the node body (not the handle) sets `selectedMemberId` in parent state via a passed-in `onSelect` callback threaded through `data`

**ProgramNode.tsx**
- Props: `data: { id, name, description }`
- Render: program name large, description truncated to 2 lines
- Style: distinct background color (e.g. `bg-blue-50 border-blue-200`) to visually separate from member nodes
- Handles: `Position.Bottom` source only (programs are always roots)

**AreaNode.tsx**
- Props: `data: { id, name }`
- Render: area name, no description needed
- Style: `bg-green-50 border-green-200`
- Handle: `Position.Bottom` source only

**TeamNode.tsx**
- Props: `data: { id, name, lead_name }`
- Render: team name bold, "Lead: [lead_name]" below in muted text
- Style: `bg-amber-50 border-amber-200`
- Handles: `Position.Top` target + `Position.Bottom` source

**Verification:** Import each node in a Storybook story or in a temporary test page and confirm they render without TypeScript errors.

### Step 8 — Frontend: shared TreeCanvas component
- File: `frontend/src/components/trees/TreeCanvas.tsx`
- Accept props:
  - `nodes: Node[]` (ReactFlow's own Node type)
  - `edges: Edge[]`
  - `nodeTypes: Record<string, ComponentType>` — passed in per-page
  - `onNodeClick?: (node: Node) => void`
  - `onNodeDragStop?: (node: Node, newParentId: string | null) => void`
  - `className?: string`
- Render:
  ```
  <ReactFlowProvider>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={...}
      onNodeDragStop={...}
      fitView
      minZoom={0.1}
      maxZoom={2}
    >
      <Controls />
      <MiniMap nodeStrokeWidth={3} zoomable pannable />
      <Background variant="dots" gap={16} size={1} />
    </ReactFlow>
  </ReactFlowProvider>
  ```
- The canvas must be inside a container with explicit height (e.g. `h-[calc(100vh-4rem)]`) — ReactFlow requires a non-zero height on its parent; this is a common first-run mistake
- Verify: renders with `nodes=[]` and `edges=[]` without errors; zoom and pan respond to mouse input; minimap appears in corner

### Step 9 — Frontend: drag-drop reassignment hook
- File: `frontend/src/components/trees/useDragReassign.ts`
- Accepts: `(treeType: 'org' | 'program' | 'area', onSuccess: () => void)`
- Returns: `{ pendingReassign, confirmReassign, cancelReassign, handleNodeDragStop }`
- `handleNodeDragStop(draggedNode: Node, nodes: Node[], edges: Edge[])`:
  - Identify the closest node to the dragged node's new position that is a valid parent type for this tree:
    - org tree: any other member node (new supervisor)
    - program tree: any program node (new program)
    - area tree: any team node or area node (new team or unassign from team)
  - Use ReactFlow's `getNodesBounds` or simple distance calculation: find the node whose center is within 60px of the dragged node's center
  - If a valid drop target is found, set `pendingReassign = { draggedNodeId, targetNodeId, draggedNodeData, targetNodeData }`
  - If no valid target, snap node back (call `setNodes` to restore original position)
- `confirmReassign()`:
  - Fires the appropriate PATCH call based on `treeType`:
    - org tree: `PATCH /api/members/{uuid}` with `{ supervisor_id: targetMemberUuid }` (or `null` to remove supervisor)
    - program tree: `POST /api/programs/{id}/assignments` with `{ member_uuid, program_id }` — and `DELETE` the old assignment
    - area tree: `PATCH /api/members/{uuid}` with `{ team_id: targetTeamId }` (or `null`)
  - On success: call `onSuccess()` (which triggers TanStack Query invalidation to refetch tree)
  - On error: show a toast notification with the error message; do not move the node
  - Clear `pendingReassign`
- `cancelReassign()`: clears `pendingReassign`, snaps node back to original position
- Verify: mock the PATCH endpoint and confirm that a drag followed by confirm fires the right API call; a drag followed by cancel does not

### Step 10 — Frontend: search/filter hook
- File: `frontend/src/components/trees/useTreeSearch.ts`
- Accepts: `(nodes: Node[], searchQuery: string)`
- Returns: `{ filteredNodes }` — same nodes array but with `style` modified:
  - Matching nodes (where `data.name` includes the query, case-insensitive): unchanged style
  - Non-matching nodes: add `style: { opacity: 0.2 }` to dim them
  - When `searchQuery` is empty: all nodes returned with original styles
- The hook does NOT filter edges — edges should stay visible to preserve structure
- Verify: given 5 nodes where 2 match, `filteredNodes` has length 5 but 3 have `opacity: 0.2`

### Step 11 — Frontend: confirmation dialog and search bar panel components
- File: `frontend/src/components/trees/panels/ReassignConfirmDialog.tsx`
- Use shadcn/ui `<Dialog>` component (already available from Phase 2)
- Props: `{ open, draggedNode, targetNode, onConfirm, onCancel }`
- Display: "Move [name] to report to [target name]?" with Confirm and Cancel buttons
- The message should be context-aware — pass a `verb` prop ("report to", "assign to program", "move to team") from the parent page
- File: `frontend/src/components/trees/panels/TreeSearchBar.tsx`
- Use shadcn/ui `<Input>` with a search icon (lucide-react `Search`)
- Props: `{ value, onChange }` — controlled component
- Position: top-right corner overlay on the canvas, using absolute positioning inside the ReactFlow container
- File: `frontend/src/components/trees/panels/MemberDetailPanel.tsx`
- Use shadcn/ui `<Sheet>` component (slide-in from right)
- Props: `{ memberId: string | null, onClose: () => void }`
- Fetch member detail via `useQuery(['member', memberId], ...)` when `memberId` is non-null
- Render the same detail fields used in the Phase 2 card view detail expansion
- Verify: dialog renders with correct names; sheet opens and closes; search input is controlled

### Step 12 — Frontend: OrgTreePage
- File: `frontend/src/pages/trees/OrgTreePage.tsx`
- Fetch data with `useOrgTree()`
- Run `useTreeLayout(rawNodes, rawEdges, 'TB')` to get positioned nodes
- Use `useTreeSearch(layoutNodes, searchQuery)` to apply search dimming
- Use `useDragReassign('org', () => queryClient.invalidateQueries(['org-tree']))` for drag handling
- Wire `TreeCanvas` with `nodeTypes = { member: MemberNode }`
- Render `TreeSearchBar` overlaid on canvas
- Render `ReassignConfirmDialog` controlled by `pendingReassign` state from the hook
- Render `MemberDetailPanel` when a node is clicked (`selectedMemberId` state)
- Page title: "Organization Chart"
- Verify: page loads, shows all members positioned in a hierarchy, minimap visible, search dims non-matching nodes

### Step 13 — Frontend: ProgramTreePage
- File: `frontend/src/pages/trees/ProgramTreePage.tsx`
- Read `id` param from URL with `useParams()`
- Additionally render a `<Select>` (shadcn/ui) at top of page to switch between programs, populated by `usePrograms()` (existing Phase 2 query hook)
- Fetch with `useProgramTree(id)`
- Layout direction: `'TB'`
- `nodeTypes = { program: ProgramNode, member: MemberNode }`
- Drag reassign type: `'program'`
- Reassign verb: "assign to program"
- Verify: page loads for a valid program id; switching program via select updates the tree

### Step 14 — Frontend: AreaTreePage
- File: `frontend/src/pages/trees/AreaTreePage.tsx`
- Same pattern as ProgramTreePage — `<Select>` at top to switch areas, populated by `useAreas()`
- `nodeTypes = { area: AreaNode, team: TeamNode, member: MemberNode }`
- Drag reassign type: `'area'`
- Reassign verb: "move to team"
- Verify: area with teams and members renders a 3-level hierarchy; unassigned members connect directly to the area node

### Step 15 — Frontend: routing and navigation wiring
- File: `frontend/src/App.tsx` (or wherever the router is defined in Phase 2)
- Add routes:
  - `/tree/org` → `<OrgTreePage />`
  - `/tree/programs/:id` → `<ProgramTreePage />`
  - `/tree/areas/:id` → `<AreaTreePage />`
  - `/tree/programs` (no id) → redirect to first program or show a "select a program" empty state
  - `/tree/areas` (no id) → redirect to first area or show empty state
- File: `frontend/src/components/layout/Sidebar.tsx`
- Add a "Tree Views" section with three entries: "Org Chart" (links to `/tree/org`), "Programs" (links to `/tree/programs`), "Areas" (links to `/tree/areas`)
- Verify: all three routes render without 404; sidebar links navigate correctly; back button works

### Step 16 — (Nice-to-have) Export tree as image
- File: `frontend/src/components/trees/TreeCanvas.tsx` — add optional `showExportButton?: boolean` prop
- Use the `toPng` function from the `html-to-image` package (add `npm install html-to-image`) applied to the ReactFlow container's DOM node via a `ref`
- Add an "Export PNG" button inside the `<Controls>` area using ReactFlow's custom controls API
- Trigger download via a transient `<a>` element with `href = dataUrl` and `download = "tree.png"`
- This step is OPTIONAL — skip if time-constrained. Do not block Steps 12–15 on this.

---

## File Manifest

### New backend files
- `backend/app/schemas/tree.py`
- `backend/app/services/tree_service.py`
- `backend/app/routers/trees.py`

### Modified backend files
- `backend/app/routers/programs.py` — add `GET /{id}/tree`
- `backend/app/routers/areas.py` — add `GET /{id}/tree`
- `backend/app/main.py` — register trees router

### New frontend files
- `frontend/src/types/trees.ts`
- `frontend/src/api/trees.ts`
- `frontend/src/pages/trees/OrgTreePage.tsx`
- `frontend/src/pages/trees/ProgramTreePage.tsx`
- `frontend/src/pages/trees/AreaTreePage.tsx`
- `frontend/src/components/trees/TreeCanvas.tsx`
- `frontend/src/components/trees/useTreeLayout.ts`
- `frontend/src/components/trees/useDragReassign.ts`
- `frontend/src/components/trees/useTreeSearch.ts`
- `frontend/src/components/trees/nodes/MemberNode.tsx`
- `frontend/src/components/trees/nodes/ProgramNode.tsx`
- `frontend/src/components/trees/nodes/AreaNode.tsx`
- `frontend/src/components/trees/nodes/TeamNode.tsx`
- `frontend/src/components/trees/panels/MemberDetailPanel.tsx`
- `frontend/src/components/trees/panels/ReassignConfirmDialog.tsx`
- `frontend/src/components/trees/panels/TreeSearchBar.tsx`

### Modified frontend files
- `frontend/package.json` — add `@xyflow/react`, `@dagrejs/dagre`, `@types/dagre`
- `frontend/src/main.tsx` — add `@xyflow/react/dist/style.css` import
- `frontend/src/App.tsx` — add tree routes
- `frontend/src/components/layout/Sidebar.tsx` — add tree view nav section

---

## Validation Criteria

### Backend
- [ ] `GET /api/org/tree` returns 200 with `nodes` and `edges` arrays; all TeamMembers appear as nodes; edges correctly reflect `supervisor_id` relationships
- [ ] `GET /api/programs/{id}/tree` returns 200; program node present; one member node per assignment; edges go from program to each member
- [ ] `GET /api/areas/{id}/tree` returns 200; area node, team nodes, member nodes all present; unassigned members have edge to area node, not team node
- [ ] All three endpoints return 404 for non-existent IDs
- [ ] All `position` values in responses are `{"x": 0, "y": 0}`
- [ ] Run: `cd backend && pytest tests/test_tree_endpoints.py -v`

### Frontend build
- [ ] `cd frontend && npx tsc --noEmit` — zero errors
- [ ] `cd frontend && npm run lint` — zero errors
- [ ] `cd frontend && npm run build` — clean production build, no warnings about missing types

### Browser validation
- [ ] `/tree/org` loads; all members render as nodes; supervisor edges connect correctly
- [ ] `/tree/programs/:id` loads; program node at root; member nodes below
- [ ] `/tree/areas/:id` loads; 3-level hierarchy for area with teams
- [ ] Minimap renders in all three views
- [ ] Zoom in/out with mouse wheel works; pan with click-drag works
- [ ] Controls panel (zoom buttons, fit view) functional
- [ ] Typing in search bar dims non-matching nodes and highlights matching ones
- [ ] Dragging a member node near another valid target highlights the target; releasing shows confirmation dialog
- [ ] Confirming reassignment fires the PATCH/POST API call and tree refreshes
- [ ] Cancelling reassignment snaps node back to original position
- [ ] Clicking a member node opens the MemberDetailPanel slide-in
- [ ] Expand/collapse: clicking a non-leaf node collapses its subtree; clicking again expands
- [ ] Sidebar "Tree Views" section links navigate to correct routes
- [ ] Switching program via select on ProgramTreePage loads the new program's tree

---

## Testing Plan

Testing strategy is **implement-then-test** per the project default.

### Backend tests (`backend/tests/test_tree_endpoints.py`)

Write after all backend steps (Steps 2–4) are complete.

**Test: org tree structure**
- Seed: create 3 members — Alice (no supervisor), Bob (supervisor=Alice), Carol (supervisor=Alice)
- Call `GET /api/org/tree`
- Assert: 3 nodes with type "member"; 2 edges (`Alice→Bob`, `Alice→Carol`); node data includes `name` and `uuid`

**Test: org tree with no members**
- Seed: empty DB
- Assert: 200 response, `nodes=[]`, `edges=[]`

**Test: program tree structure**
- Seed: 1 program, 2 members assigned to it with different roles
- Call `GET /api/programs/{id}/tree`
- Assert: 3 nodes (1 program + 2 members); 2 edges; member nodes have `role` in data

**Test: program tree 404**
- Call `GET /api/programs/99999/tree`
- Assert: 404

**Test: area tree structure**
- Seed: 1 area, 2 teams, 2 members in team 1, 1 member unassigned (in area, no team)
- Call `GET /api/areas/{id}/tree`
- Assert: 1 area node + 2 team nodes + 3 member nodes = 6 nodes; unassigned member has edge from area node (not from a team node)

**Test: area tree 404**
- Call `GET /api/areas/99999/tree`
- Assert: 404

### Frontend tests (`frontend/src/components/trees/*.test.ts`)

Write after all frontend steps (Steps 5–15) are complete.

**Test: useTreeLayout positions nodes**
- Input: 3 nodes with `position: {x:0, y:0}`, 2 edges forming a chain A→B→C
- Assert: returned nodes have distinct Y values in increasing order (TB layout)

**Test: useTreeSearch dims non-matching nodes**
- Input: 5 nodes with names ["Alice", "Bob", "Carol", "Dave", "Eve"], query "a"
- Matching: Alice, Carol, Dave (contains "a" case-insensitive)
- Assert: 2 nodes have `style.opacity === 0.2` (Bob and Eve), 3 nodes are unchanged

**Test: useDragReassign sets pendingReassign on valid drop**
- Mock: org tree nodes, simulate `handleNodeDragStop` with dragged node within 60px of target
- Assert: `pendingReassign` is set with correct draggedNodeId and targetNodeId

**Test: useDragReassign fires PATCH on confirm**
- Mock: `fetch` (or `axios`) for `PATCH /api/members/{uuid}`
- Call `confirmReassign()` after setting `pendingReassign`
- Assert: PATCH called with `{ supervisor_id: targetUuid }`

**Test: ReassignConfirmDialog renders correct names**
- Mount with `draggedNode.data.name = "Alice"`, `targetNode.data.name = "Bob"`, `verb = "report to"`
- Assert: dialog text includes "Alice" and "Bob" and "report to"

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| ReactFlow requires explicit container height — blank canvas if height is 0 | High (common first-run issue) | Step 8 explicitly calls out the `h-[calc(100vh-4rem)]` requirement; verify in Step 8 before building pages |
| Dagre layout produces overlapping nodes if `nodesep`/`ranksep` are too small for wide org charts | Medium | Use `ranksep: 80, nodesep: 60` as starting values; expose them as optional props on `useTreeLayout` so they can be tuned without code changes |
| Drag-drop: identifying the "drop target" without a real drop zone API (ReactFlow does not do parent-assignment natively) | High | Use distance-based proximity detection in `useDragReassign` (Step 9); snap back if no target within threshold — this is the most complex piece and should be spiked first |
| Program reassignment requires DELETE old + POST new (not a simple PATCH) — easy to leave dangling assignments | Medium | `confirmReassign` in `useDragReassign` must execute DELETE before POST and handle partial failure with a rollback toast |
| org chart with 100+ members becomes cluttered and dagre layout produces very wide trees | Medium | `fitView` on load shrinks to fit; minimap enables navigation; expand/collapse lets users focus on subtrees |
| `@xyflow/react` v12 CSS must be imported once globally — forgetting it produces invisible/broken nodes | Medium | Step 1 and Step 8 both call this out; put it in `main.tsx` not in component files |
| Custom node `Handle` elements must be present or ReactFlow throws a warning and edges do not render | Medium | Step 7 explicitly documents which handles to add to each node type |
