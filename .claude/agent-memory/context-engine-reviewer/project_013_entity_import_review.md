---
name: project_013_entity_import_review
description: 013-entity-import (per-section CSV/Sheets import for programs, areas, teams): key findings from review on 2026-03-25
type: project
---

Per-section entity import reviewed on 2026-03-25. Feature is largely correct; entity_type flows end-to-end with backward compat default "member".

**Why:** Reviewed for correctness, security, edge cases, pattern compliance, and simplification.
**How to apply:** Use as baseline when reviewing future changes to import subsystem.

## Critical / Fragile Areas

1. **Cache invalidation uses wrong query keys** — `PreviewStep.tsx` calls `invalidateQueries({ queryKey: ['members'] })`, `['programs']`, `['functional-areas']`, `['teams']`. The actual registered keys are `areaKeys.all = ["areas"]`, `teamKeys.all = ["teams"]`, `programKeys.all = ["programs"]`, `memberKeys.all = ["members"]`. The areas key is `["areas"]` not `["functional-areas"]`; the member key happens to be correct by coincidence. After an area import, FunctionalAreasPage will not refresh its data.

2. **Blanket invalidation of all four queries on every commit** — PreviewStep always fires all four invalidateQueries calls regardless of entity_type, causing unnecessary network requests on every import.

3. **skipped_count counts error rows only, not in-batch duplicates** — `commit_import` returns `skipped_count=len(error_rows)`. Rows that were valid but deduplicated out by `_dedup_rows` are silently dropped with no count in the result. Users importing 10 rows where 3 are duplicates see "0 skipped" when 3 were actually skipped.

4. **`_commit_areas`/`_commit_programs` existing-entity update logic is a no-op when description is absent** — If a row has no description column mapped, the `if desc is not None and desc != "":` block is skipped and `updated += 1` is still incremented — so the result says "1 updated" but nothing was actually written. Minor mislead but could confuse users.

## Warnings

- `MappingConfig.entity_type` is `Optional[EntityType]` in importApi.ts (`entity_type?: EntityType`) but required (with default) in the Pydantic schema. If a caller omits it from the JSON body the backend defaults to "member", which is correct, but TypeScript allows `undefined` which `JSON.stringify` will drop the key entirely — this is actually fine and intentional but the asymmetry is worth noting.
- `_commit_teams` calls `_get_or_create_functional_area(db, "Unassigned")` directly when no area name is provided, duplicating the same fallback logic already in `_get_or_create_team`. The two paths could diverge in future.
- No tests for `_commit_areas`, `_commit_programs`, `_commit_teams` dispatch paths. Existing tests only cover member commit. The strategy is implement-then-test so this is expected but fragile given the new area-scoped invalidation issue.
- `AREA_TARGET_FIELDS` and `PROGRAM_TARGET_FIELDS` are identical; they are separate constants which is correct for future divergence but should be documented.
