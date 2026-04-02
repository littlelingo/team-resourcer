# Learnings

## 2026-04-02: Dynamic ORM attribute injection for Pydantic computed fields (feature 051)

When adding a computed field (e.g., `member_count`) to a Pydantic response schema with `from_attributes=True`, there are two approaches:

1. **Service-side injection** (used in 051): Set a transient attribute on the ORM object (`program.member_count = len(program.assignments)`) before returning. Pydantic reads it via `from_attributes`. Requires `# type: ignore[attr-defined]` since the attribute isn't on the SQLAlchemy model.

2. **Pydantic `@computed_field`**: Declare the relationship on the schema and compute the count there. Cleaner type-wise but risks leaking the raw relationship data into the API response unless explicitly excluded.

**Key insight**: If using approach 1, the schema default (`member_count: int = 0`) silently masks bugs — if a future code path forgets to set the attribute, Pydantic returns `0` instead of raising an error. This is both a feature (graceful degradation) and a risk (silent incorrectness).

**Recommendation**: Approach 1 is fine for isolated cases. If the pattern spreads to multiple entities, consider standardizing on `@computed_field` with `exclude` for the raw relationship.
