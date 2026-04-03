---
name: research_tree_lead_duplicate
description: Full pipeline audit for area/org tree visualization — team lead appears as duplicate member node; team node clickability
type: project
---

## Finding: The Duplicate Lead Root Cause

`build_area_tree` in `backend/app/services/tree_service.py` (lines 163–192) emits **every member** in the area as a member node unconditionally. The lead is a team member too, so they get a member node AND their name appears on the team node. There is no exclusion of the lead from the member loop.

**Why:** The query at line 122 selects all TeamMembers where `functional_area_id = area_id` — the team lead is one of those members. No filter exists to skip them.

**How to apply:** The fix belongs in `build_area_tree`: skip emitting a member node (and edge) for any member whose `uuid == team.lead_id` for that member's team. The lead's identity is already embedded in the team node's `data.lead_id` (line 150) and `data.lead_name` (line 151).

---

## Full Pipeline

### Backend

- **Schema**: `backend/app/schemas/tree.py` — `TreeNode(id, type, data, position)`, `TreeEdge(source, target)`, `TreeResponse(nodes, edges)`
- **Service**: `backend/app/services/tree_service.py`
  - `build_area_tree` (line 105): area → teams (with lead via selectinload) → all members. Team node `data` carries `lead_id` (str UUID) and `lead_name`. Member nodes carry `uuid, name, title, image_path`. No lead exclusion.
  - `build_org_tree` (line 17): flat supervisor hierarchy, member-only nodes, no teams involved.
  - `build_program_tree` (line 51): program + assigned members.

### Frontend — Data Flow

- **Fetch**: `frontend/src/hooks/useTrees.ts` — `useAreaTree(id)` → `/api/areas/{id}/tree`
- **Layout**: `frontend/src/components/trees/useTreeLayout.ts` — dagre layout, pure transform, no node filtering
- **Search**: `useTreeSearch` — opacity filter only, no removal
- **Page**: `frontend/src/pages/trees/AreaTreePage.tsx` (line 49–55) — injects `onSelect` callback into member nodes only (`node.type === 'member'`); team nodes get `onSelect: undefined`

### Frontend — Node Components

- **TeamNode**: `frontend/src/components/trees/nodes/TeamNode.tsx`
  - Has `lead_name` in `TeamNodeData` type (line 7) and renders it (line 19–21)
  - Has `lead_id` in backend data but **NOT in `TeamNodeData` type** — type needs `lead_id?: string | null`
  - No click handler, no `onSelect` prop in type definition — **not clickable**
  - No `Handle type="target"` missing — wait, it does have both target and source handles
- **MemberNode**: `frontend/src/components/trees/nodes/MemberNode.tsx`
  - `onSelect?: (uuid: string) => void` in data type (line 12)
  - Click calls `data.onSelect?.(data.uuid)` (line 22)
  - `cursor-pointer hover:shadow-md` styling
- **AreaNode**: no click handler, no onSelect
- **ProgramNode**: no click handler, no onSelect

### Click Handler Pattern

`MemberDetailPanel` (`frontend/src/components/trees/panels/MemberDetailPanel.tsx`) opens a slide-in dialog. It takes `memberId: string | null`. `AreaTreePage` holds `selectedMemberId` state and passes it to both the `onSelect` injector and `MemberDetailPanel`.

---

## What Needs to Change

### 1. Backend — filter lead from member nodes (tree_service.py lines 163–192)

Build a set of lead UUIDs per team. In the member loop, skip any member whose UUID is in that set. The member still exists in the DB; they just don't get a duplicate node.

```python
lead_uuids = {str(team.lead_id) for team in teams if team.lead_id}

for member in members:
    if str(member.uuid) in lead_uuids:
        continue   # shown on the team node, not as a separate node
    ...
```

### 2. Frontend — make TeamNode clickable (TeamNode.tsx + AreaTreePage.tsx)

**TeamNode.tsx**: Add `onSelect?: (uuid: string) => void` and `lead_id?: string | null` to `TeamNodeData`. Add `cursor-pointer hover:shadow-md` and an `onClick` that calls `data.onSelect?.(data.lead_id)`.

**AreaTreePage.tsx line 53**: Change the `onSelect` injection condition from `node.type === 'member'` to also handle `node.type === 'team'`, passing the team's `lead_id` UUID.

MemberDetailPanel already handles UUID → detail sheet, so clicking the team node would open the lead's detail panel — no other infrastructure needed.
