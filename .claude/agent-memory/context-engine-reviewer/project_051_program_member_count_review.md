---
name: 051-program-member-count review
description: 051-program-member-count (member_count on ProgramResponse, selectinload on 4 service fns, Members column): key findings from review on 2026-04-02
type: project
---

## Key Findings (2026-04-02)

### Correctness
- All 4 `ProgramResponse`-returning service functions (list, get, create, update) have `selectinload(Program.assignments)` — MissingGreenlet risk is fully mitigated.
- `update_program` calls `get_program` internally (which sets `member_count`) and then re-queries (which sets it again). Second write is a no-op, not a bug, but it is a hidden double-query.
- `member_count` is set as a dynamic attribute on the SQLAlchemy ORM model (`# type: ignore[attr-defined]`). It is NOT declared on the `Program` model — it's a transient attribute injected at the service layer and read by Pydantic via `from_attributes=True`. This works but is an undeclared coupling.
- `delete_program` calls `get_program` (which does the `selectinload` work unnecessarily for a delete path), but has no correctness issue since `ProgramResponse` is not returned by the delete endpoint.

### Pattern Issues
- The `# type: ignore[attr-defined]` pattern (dynamic attribute injection onto ORM models) is a code smell. Preferred approach: use a Pydantic `@computed_field` (v2) or a SQL `func.count` scalar subquery. The injected attribute is invisible to mypy and to anyone reading the `Program` model.
- The frontend `member_count: number` type is non-optional, which is correct since the backend always provides it with a default of 0.

### Edge Cases
- 0-member programs: schema default `= 0` and `len([]) == 0` both return 0 — correct.
- New programs (just created): `create_program` re-queries after commit, assignments will be empty, count is 0 — correct.
- After `assign_member` / `unassign_member`: these endpoints do NOT return `ProgramResponse`, they return `ProgramAssignmentResponse`. The Programs list is re-fetched by the frontend via TanStack Query invalidation (not verified in this review, but not a concern of this feature).

**Why:** Review on commit d18f343 for feature 051.
**How to apply:** The dynamic-attribute-injection pattern (type: ignore[attr-defined] on ORM model) is a fragile coupling to watch for in future service reviews.
