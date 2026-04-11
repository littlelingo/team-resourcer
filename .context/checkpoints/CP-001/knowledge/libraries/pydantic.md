# Pydantic v2

> Last updated: 2026-04-09
> Source: Discovered during features 051, 052, and 057.

## Quirks & Gotchas

### `from_attributes=True` + dynamic ORM attribute injection

When adding a computed field (e.g., `member_count`) to a Pydantic response schema with `model_config = ConfigDict(from_attributes=True)`, two approaches work:

1. **Service-side injection** (used in feature 051): Set a transient attribute on the ORM object before returning. Pydantic reads it via `from_attributes`:
   ```python
   program.member_count = len(program.assignments)  # type: ignore[attr-defined]
   return program
   ```
   Requires `# type: ignore[attr-defined]` since the attribute isn't on the SQLAlchemy model.

2. **Pydantic `@computed_field`**: Declare the relationship on the schema and compute the count there. Cleaner type-wise but risks leaking the raw relationship data into the API response unless explicitly excluded.

**Gotcha with approach 1**: A schema default (`member_count: int = 0`) silently masks bugs. If a future code path forgets to set the attribute, Pydantic returns `0` instead of raising. This is both graceful degradation and silent incorrectness — pick your poison.

**Recommendation**: Approach 1 is fine for isolated cases. Once the pattern spreads to 3+ entities, standardize on `@computed_field` with `exclude` on the underlying relationship.

### Embedded schema ripple effect

Adding a field to a Pydantic `ListResponse` schema that is used **both** as a list endpoint response AND embedded in other schemas (e.g., `FunctionalAreaListResponse` embedded in `TeamResponse`) ripples to all consumers. Tests that assert exact dict equality on embedded objects will break even though the API is backward-compatible (the field has a default).

**Mitigation**: Use `= 0` defaults (or `= None`) for additive fields. Accept that embedded usages will show the default value. Plan to update assertions when the shape changes.

First hit in feature 052 (entity member counts).

## Workarounds

**Problem**: `@computed_field` on a class with `from_attributes=True` triggers mypy errors on the decorator (`prop-decorator`).
**Fix**: Add `# type: ignore[prop-decorator]` above each `@computed_field` decorator. See `backend/app/schemas/calibration.py` for examples (`box`, `label`, `performance`, `potential` all use this pattern).
**Why**: mypy's property-decorator rule doesn't fully understand Pydantic's computed fields as of Pydantic 2.x + mypy current. The ignore is the officially recommended workaround until Pydantic ships a mypy plugin that handles it natively.

## Patterns We Use

- **Schemas live in `backend/app/schemas/`, never imported from `models/`**. The model file (`team_member.py`) and the schema file (`schemas/team_member.py`) are always a matched pair, same filename.
- **`model_config = ConfigDict(from_attributes=True)`** on every response schema so Pydantic can hydrate from ORM instances.
- **Computed fields for derived data**: `CalibrationResponse` stores only `box` (1-9) and computes `label`, `performance`, `potential` via `@computed_field` using `BOX_LABELS` and `BOX_TO_AXES` constants defined at module level in `schemas/calibration.py`. This is the project's single-source-of-truth pattern for enum-like data.

## Version Notes

Using Pydantic v2 (`BaseModel`, `ConfigDict`, `computed_field`). No v1 compatibility code in the project.
