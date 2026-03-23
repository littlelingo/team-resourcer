---
name: TeamsPage useDeleteTeam stale hook initialization
description: useDeleteTeam is initialized with area_id=0 placeholder; area changes when deleteTeam state changes but the hook captures areaId in a closure at render time
type: feedback
---

In `TeamsPage`:
```ts
const deleteAreaId = deleteTeam?.functional_area_id ?? 0
const deleteMutation = useDeleteTeam(deleteAreaId)
```

`useDeleteTeam(areaId)` closes over `areaId` in the `mutationFn`. When `deleteTeam` is set to a team object, `deleteAreaId` updates and the component re-renders, so the hook will re-initialize with the correct area ID before `mutate` is called. This is safe in practice because state update + re-render happens synchronously before the user can click Confirm.

However, if the mutation is called in the same render cycle that changes `deleteAreaId` (e.g., via `mutateAsync` in an effect), it would use the stale 0 value. Flag as a warning about fragility.

**How to apply:** Prefer passing the dynamic value into `mutationFn` directly rather than closing over a prop, to avoid this class of issue entirely.
