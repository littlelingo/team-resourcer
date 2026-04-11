# TanStack Query v5

> Last updated: 2026-04-09
> Source: Discovered during features 046, 047, and 057.

## Quirks & Gotchas

### Hierarchical key invalidation is not automatic parent→child

Given hierarchical query keys like `["programs", "members", id]`, invalidating `["programs"]` **does** cover subkeys like `["programs", "list"]` — but only because TanStack Query's default `exact: false` does prefix matching on array position. The gotcha is that keys like `["programs", "list"]` and `["programs", "members", 1]` are **siblings**, not parent-child:

- Invalidating `programKeys.all` (`["programs"]`) covers both.
- Invalidating `programKeys.list` (`["programs", "list"]`) does NOT cover `members(id)` because they diverge at position 1.

**Rule**: always invalidate the most specific affected key in addition to the broad prefix. For calibrations, the project uses a helper:

```ts
// frontend/src/hooks/useCalibrationCycles.ts lines 21-32
export function invalidateAllCalibrationViews(
  qc: QueryClient,
  memberUuid?: string,
) {
  qc.invalidateQueries({ queryKey: calibrationKeys.all })
  if (memberUuid) {
    qc.invalidateQueries({ queryKey: memberKeys.detail(memberUuid) })
  }
}
```

Every calibration mutation's `onSuccess` calls this. The helper centralizes the "what needs invalidating when calibrations change" question in exactly one place.

### Raw `apiFetch` calls bypass mutation-hook cache invalidation

When a form submit handler calls `apiFetch` directly in a loop instead of using the mutation hook's `mutateAsync`, the hook's `onSuccess` never fires — so cache invalidation is silently skipped. The UI shows stale data after save.

**Fix**: either (a) use `mutateAsync` inside the loop (even though it's more ceremony) or (b) manually call `qc.invalidateQueries({ queryKey: ... })` after the loop completes. Both work; the mutation-hook approach is preferred because it keeps invalidation logic co-located with the hook definition.

First hit in features 046/047 (program member assignment).

## Workarounds

**Problem**: Calibration grid shows stale data after import commits or ambiguity resolutions.
**Fix**: Every mutation in `useCalibrations.ts` calls `invalidateAllCalibrationViews(qc, memberUuid)` in `onSuccess`. This includes `createCalibration`, `updateCalibration`, `deleteCalibration`, and — less obviously — the resolve-ambiguous path in the import wizard.
**Why**: The import wizard bypasses `useCalibrations` entirely and calls the resolve endpoint via `apiFetch`. Without explicit invalidation, the 9-box grid keeps serving the pre-resolve TanStack cache.

## Patterns We Use

### Query key structure

```ts
// frontend/src/hooks/useMembers.ts lines 5-9
export const memberKeys = {
  all: ["members"] as const,
  list: (params?: Record<string, string>) => ["members", "list", params] as const,
  detail: (uuid: string) => ["members", "detail", uuid] as const,
}

// frontend/src/hooks/useCalibrationCycles.ts lines 7-15
export const calibrationKeys = {
  all: ['calibrations'] as const,
  cycles: ['calibrations', 'cycles'] as const,
  latest: (filters?) => ['calibrations', 'latest', filters ?? {}] as const,
  movement: (from, to) => ['calibrations', 'movement', from, to] as const,
  trends: (n) => ['calibrations', 'trends', n] as const,
  byMember: (uuid) => ['calibrations', 'member', uuid] as const,
}
```

Conventions:
- `.all` is always the entity prefix as a single-element tuple.
- Factory functions for keys with parameters (`list`, `detail`, `movement`, `trends`).
- `as const` on every literal array so TanStack's key comparison is exact.
- One `<entity>Keys` constant per hook file; re-exported from `useCalibrationCycles.ts` as the SSoT for the calibration feature.

### Shared invalidation helpers

When a feature has multiple query keys and multiple mutation hooks, extract an `invalidateAll<Feature>Views(qc, ...args)` helper. This prevents the "added a new cached query but forgot to update all the mutation hooks" regression class.

## Version Notes

TanStack Query v5 (`@tanstack/react-query ^5.95.0`). No v4 compatibility shims.
