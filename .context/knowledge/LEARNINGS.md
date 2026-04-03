# Learnings

## 2026-04-02: Dynamic ORM attribute injection for Pydantic computed fields (feature 051)

When adding a computed field (e.g., `member_count`) to a Pydantic response schema with `from_attributes=True`, there are two approaches:

1. **Service-side injection** (used in 051): Set a transient attribute on the ORM object (`program.member_count = len(program.assignments)`) before returning. Pydantic reads it via `from_attributes`. Requires `# type: ignore[attr-defined]` since the attribute isn't on the SQLAlchemy model.

2. **Pydantic `@computed_field`**: Declare the relationship on the schema and compute the count there. Cleaner type-wise but risks leaking the raw relationship data into the API response unless explicitly excluded.

**Key insight**: If using approach 1, the schema default (`member_count: int = 0`) silently masks bugs — if a future code path forgets to set the attribute, Pydantic returns `0` instead of raising an error. This is both a feature (graceful degradation) and a risk (silent incorrectness).

**Recommendation**: Approach 1 is fine for isolated cases. If the pattern spreads to multiple entities, consider standardizing on `@computed_field` with `exclude` for the raw relationship.

## 2026-04-03: Embedded schema ripple effect when adding fields (feature 052)

Adding a field to a Pydantic `ListResponse` schema that is used **both** as a list endpoint response AND embedded in other schemas (e.g., `FunctionalAreaListResponse` in `TeamResponse`) will ripple to all consumers. Tests that assert exact dict equality on embedded objects will break even though the API is backward-compatible (the field has a default).

**Mitigation**: Use `= 0` defaults for additive fields. Accept that embedded usages will show the default value. Tests need updating for the new shape.

## 2026-04-03: Scoped exclusion for multi-role entities in tree graphs (feature 053)

When excluding entities from one context (e.g., a team lead from member nodes), scope the exclusion to only the specific relationship. A naive `if uuid in lead_set: skip` would hide the person from ALL teams, breaking the case where they lead Team A but are a regular member of Team B.

**Pattern**: Use a mapping (`lead_team_map = {uuid: team_id}`) and check both conditions: `uuid in map AND map[uuid] == current_team_id`.

## 2026-04-03: Optional props for entity-specific features in shared components (feature 054)

When a shared component (e.g., `EntityMembersSheet`) is used by multiple entity pages (Teams, Programs, Areas), add entity-specific features via optional props (`leadId?: string | null`). Only the relevant page passes the prop — other consumers are completely unaffected. This avoids creating entity-specific forks of the shared component.
