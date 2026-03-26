---
name: project_017_agency_review
description: 017-program-agency (Agency entity, program FK, import support): key findings from review on 2026-03-25
type: project
---

Agency entity feature reviewed on 2026-03-25. Backend (model, schemas, service, routes, migration) is correct. The main blocking issue is the program form making agency required while legacy/import programs will have null agency_id — editing any existing null-agency program is broken because the form submits agency_id=0 which passes zod but sends 0 to the backend.

**Why:** Reviewed for correctness, security, edge cases, pattern compliance, and simplification.
**How to apply:** Use as baseline when reviewing future changes to agency or program form.

## Critical / Fragile Areas

1. **ProgramFormDialog agency_id=0 on edit of null-agency program** — `defaultValues: { agency_id: 0 }` and `reset({ agency_id: program?.agency_id ?? 0 })`. If a program has `agency_id: null` (existing seed reset, import without agency_name), editing it resets to 0. Zod `min(1)` blocks submit — user is forced to pick an agency to save ANY other field. Also `values.agency_id || undefined` sends `undefined` (treated as no-update) for `agency_id=0` — so if user somehow submits, it won't clear to null. The sentinel 0 approach is fragile; the PRP recommended `__none__` sentinel or making field optional in the form.

2. **PreviewStep missing `agency` invalidation** — After an agency import commit, PreviewStep has no `entity_type === 'agency'` branch, so `agencyKeys.all` is never invalidated. The AgenciesPage will not refresh after a successful import until the user navigates away. Also, program imports that set agency_id should arguably also invalidate agencies (minor).

## Warnings

- `_commit_agencies` increments `updated` even when only `description` is blank/absent (the no-op update issue flagged in 013 review also exists here for the same reason as `_commit_areas`).
- The `Agency` model has no `updated_at` trigger in SQLAlchemy `onupdate` beyond the server-side default. The `onupdate=func.now()` is Python-side and requires the ORM to issue an UPDATE — this is correct for ORM updates but will not fire for raw SQL updates (low risk, same pattern as all other models).
- `useAgencies` query key structure: `agencyKeys.list()` returns `["agencies", "list"]` but `agencyKeys.all` is `["agencies"]`. The `invalidateQueries({ queryKey: agencyKeys.all })` correctly invalidates all `["agencies", *]` subtrees. Pattern is consistent with `areaKeys`.
