# Learnings

## 2026-04-08: Savepoint pattern for race-safe get_or_create in async SQLAlchemy (post-057 refactor)

When a `get_or_create` helper is called from inside a batch loop, the race-loss handler must NOT use `await db.rollback()` — that discards the entire transaction's flushed work, including unrelated rows the loop has already processed. Use a **savepoint** instead via `async with db.begin_nested()`:

```python
try:
    async with db.begin_nested():
        thing = Thing(...)
        db.add(thing)
        await db.flush()
    return thing
except IntegrityError:
    # SAVEPOINT auto-rolled back; outer transaction (including earlier
    # batch work) is preserved.
    result = await db.execute(select(Thing).where(...))
    return result.scalar_one()
```

The DB issues a `SAVEPOINT` before the flush and `ROLLBACK TO SAVEPOINT` on exception — so only the racing insert is reverted, not the entire transaction. The outer batch's prior work survives, and the eventual `db.commit()` is a single atomic write of all successful rows.

**Project-wide locations using this pattern** (post-validation of feature 057):
- `import_commit.py::_get_or_create_program_team` (existing, refactored)
- `calibration_cycle_service.py::get_or_create_cycle` (feature 057)
- `import_commit_calibrations.py::_upsert_calibration_row` (feature 057)

The other `_get_or_create_*` helpers in `import_commit.py` (`_functional_area`, `_team`, `_program`) do not currently catch `IntegrityError` at all — they're vulnerable to race-loss but won't lose batch work since they have no rollback. Adding the savepoint pattern to them is a follow-up that needs the underlying tables to also have unique constraints, which several already do.

## 2026-04-08: ORM cascade must reflect DB FK intent, not contradict it (feature 057)

When the database FK uses `ON DELETE RESTRICT` to make a parent table append-only (cycles, audit logs, immutable references), the ORM relationship must NOT use `cascade="all, delete-orphan"`. SQLAlchemy's cascade runs *before* the database FK constraint — it deletes child rows in Python, then issues the parent DELETE, and the FK never has a chance to fire. The "RESTRICT" safety net silently does nothing.

The fix is `cascade="save-update, merge"` + `passive_deletes=True`, which tells SQLAlchemy "don't touch the children — let the database decide." Now the FK fires and the parent DELETE raises `IntegrityError`, which is what RESTRICT was supposed to do all along.

This is a latent bug in feature 057's `CalibrationCycle` model — there's no cycle-delete route today, so the wrong cascade hasn't bitten anything yet. Caught by code review and fixed pre-commit. Worth grepping the codebase for `cascade="all, delete-orphan"` next to a FK with `ondelete="RESTRICT"` — the combination is always wrong.

## 2026-04-08: Frontend data constants must mirror the backend single-source-of-truth (feature 057)

Three calibration widgets each defined their own `BOX_LABELS: Record<number, string>` inline. Within the same PR, two of the three diverged from each other and from the backend's canonical labels — and one widget swapped "Consistent Star" from box 1 to box 7, completely changing the taxonomy users would see. Reviewer caught the duplication; the actual divergence was worse than the duplication suggested.

The rule: **any user-visible constants that mirror backend data go in exactly one frontend file** (`<feature>/constants.ts`) with a docstring pointing at the canonical backend source. Three identical inline constants across files is the smell that should trigger the extraction. Drift between the duplicates is a near-certainty given enough time.

## 2026-04-08: Visx 3.12 + React 19 requires `--legacy-peer-deps` (feature 057)

Visx 3.12 still declares `peer react@^18`, but the runtime is fully forward-compatible with React 19 — Visx only uses stable hooks, refs, and SVG primitives. The peer-deps cap is a stale package.json declaration, not a real incompatibility. `npm install --legacy-peer-deps` is the standard workaround until Visx ships a 4.x. Pin documented in `.context/knowledge/dependencies/PINS.md`. Removal criteria: when `npm install` (no flag) succeeds with Visx 4.x.

## 2026-04-08: Worktree-isolated agents leak Docker containers (feature 057)

When an agent runs in a `git worktree` and uses Docker Compose, Compose names the project after the worktree directory (`agent-<hash>`). The containers persist after the agent exits, holding ports (5432, 5173, 8000) and bind-mount file ownership. Removing the git worktree without first stopping the containers leaves: (a) Docker-uid-owned files in the orphaned dir that block normal `rm`, (b) port conflicts the next time the main project tries `make up`. **Fix**: before removing a worktree, run `docker compose -p <agent-project> down -v` from the worktree dir or by name.

## 2026-04-06: Replace-semantics imports must distinguish "unmapped" from "mapped-but-empty" (feature 056)

When an import path supports replace semantics (existing rows not in the incoming set are deleted), the gate that decides whether to run the delete loop must be `bool(value)` — not `key in dict`. An empty list and an unmapped column look identical in payload, but they mean opposite things to the user:

- **Unmapped**: "I'm not touching programs in this import." → preserve all existing assignments.
- **Mapped-but-empty cell**: "This member happens to have no programs in my source data." → almost always a data hole, not an authoritative empty set.

Treating both as "preserve" is the safe default. Forcing the user to explicitly opt into mass-delete (e.g., a separate "clear all" column) is even safer but out of scope for 056. The reviewer caught this in feature 056 — the implementer used `key in data` and a blank cell would have wiped every assignment for that member.

## 2026-04-06: Positional list alignment requires preserving blank tokens (feature 056)

A common CSV pattern for "parallel optional lists" is `"Alpha; Beta"` paired with `";Team2"` (meaning "Alpha gets no team, Beta gets Team2"). The naive split helper drops empty tokens, which collapses `";Team2"` to `["Team2"]` (length 1) and breaks length-equality validation against `["Alpha", "Beta"]` (length 2).

Fix pattern: a `keep_blanks=True` mode on the split helper that preserves empty positions but trims a single trailing empty token (so `"Team1;Team2;"` stays length 2, not 3). This is the only way to express "no team for position N" without inventing per-cell escape syntax.

## 2026-04-02: Dynamic ORM attribute injection for Pydantic computed fields (feature 051)

When adding a computed field (e.g., `member_count`) to a Pydantic response schema with `from_attributes=True`, there are two approaches:

1. **Service-side injection** (used in 051): Set a transient attribute on the ORM object (`program.member_count = len(program.assignments)`) before returning. Pydantic reads it via `from_attributes`. Requires `# type: ignore[attr-defined]` since the attribute isn't on the SQLAlchemy model.

2. **Pydantic `@computed_field`**: Declare the relationship on the schema and compute the count there. Cleaner type-wise but risks leaking the raw relationship data into the API response unless explicitly excluded.

**Key insight**: If using approach 1, the schema default (`member_count: int = 0`) silently masks bugs — if a future code path forgets to set the attribute, Pydantic returns `0` instead of raising an error. This is both a feature (graceful degradation) and a risk (silent incorrectness).

**Recommendation**: Approach 1 is fine for isolated cases. If the pattern spreads to multiple entities, consider standardizing on `@computed_field` with `exclude` for the raw relationship.

## 2026-04-03: Embedded schema ripple effect when adding fields (feature 052)

Adding a field to a Pydantic `ListResponse` schema that is used **both** as a list endpoint response AND embedded in other schemas (e.g., `FunctionalAreaListResponse` in `TeamResponse`) will ripple to all consumers. Tests that assert exact dict equality on embedded objects will break even though the API is backward-compatible (the field has a default).

**Mitigation**: Use `= 0` defaults for additive fields. Accept that embedded usages will show the default value. Tests need updating for the new shape.

## 2026-04-03: TanStack Query granular key invalidation (features 046/047)

When using hierarchical query keys like `["programs", "members", id]`, invalidating the parent prefix `["programs"]` does NOT automatically invalidate child keys unless you use `{ queryKey: ["programs"], exact: false }` (which is the default). However, keys like `["programs", "list"]` and `["programs", "members", 1]` are siblings, not parent-child — invalidating `programKeys.all` (`["programs"]`) covers `list` but NOT `members(id)` because TanStack Query's prefix matching considers array position.

**Rule**: Always invalidate the specific query key (`programKeys.members(id)`) in addition to broader keys. Raw `apiFetch` calls in form submit handlers bypass mutation hook `onSuccess` invalidation — either use the mutation hooks' `mutateAsync` or manually invalidate affected keys after the loop.

## 2026-04-03: Extract duplicated React Hook Form defaultValues (feature 045)

When a form uses both `useForm({ defaultValues })` and a `useEffect` with `form.reset(...)`, the values object is often duplicated verbatim. Extract into a `buildDefaultValues(entity?)` helper to ensure both paths stay in sync. Missing a field in one location causes silent bugs: the form either doesn't prefill on first open or doesn't reset correctly on subsequent opens.

## 2026-04-03: Scoped exclusion for multi-role entities in tree graphs (feature 053)

When excluding entities from one context (e.g., a team lead from member nodes), scope the exclusion to only the specific relationship. A naive `if uuid in lead_set: skip` would hide the person from ALL teams, breaking the case where they lead Team A but are a regular member of Team B.

**Pattern**: Use a mapping (`lead_team_map = {uuid: team_id}`) and check both conditions: `uuid in map AND map[uuid] == current_team_id`.

## 2026-04-03: Optional props for entity-specific features in shared components (feature 054)

When a shared component (e.g., `EntityMembersSheet`) is used by multiple entity pages (Teams, Programs, Areas), add entity-specific features via optional props (`leadId?: string | null`). Only the relevant page passes the prop — other consumers are completely unaffected. This avoids creating entity-specific forks of the shared component.

## 2026-04-03: Alembic auto-generated migration noise and FK naming (feature 055)

Alembic's `--autogenerate` detects model drift beyond your intended changes. In feature 055, the generated migration included unrelated FK recreations (dropping `ondelete='SET NULL'` from `programs.agency_id`, recreating `fk_teams_lead_id`). These silently alter existing constraints.

**Always review and trim auto-generated migrations.** Remove operations that don't relate to the feature. Also: Alembic uses `None` for auto-generated FK constraint names — the downgrade's `drop_constraint(None, ...)` will fail at runtime because Postgres auto-names the constraint and Alembic can't reverse-lookup it. Always give FKs explicit names (e.g., `fk_program_assignments_program_team_id`).

**Related**: When a child FK has no `ON DELETE` clause, PostgreSQL defaults to `RESTRICT`. If you need nullable FK cleanup on parent delete, either add `ondelete="SET NULL"` on the FK or null out children in the service layer before deleting.

## 2026-04-08: Calibration architecture decisions captured in ADR-001 (feature 057)

The 9-box calibration feature introduced several non-obvious architectural choices. Full rationale in `.context/decisions/ADR-001-calibration-architecture.md`. Key learnings:

1. **Store `box`, compute axes in Pydantic**: CSV provides box (1-9) directly. Storing it eliminates a parsing round-trip and keeps the CHECK constraint trivial. `performance` and `potential` are `@computed_field` properties derived from `BOX_TO_AXES` — the single source of truth lives in `backend/app/schemas/calibration.py`.

2. **MissingGreenlet guard**: `calibrations` must ONLY be on `TeamMemberDetailResponse`, never `TeamMemberListResponse`. The list route doesn't eagerly load calibrations, so accessing the relationship there would trigger a `MissingGreenlet` error. Guard: `selectinload(TeamMember.calibrations).selectinload(Calibration.cycle)` only in `get_member()`.

3. **Name-only member matching (no employee_id in calibration CSV)**: Use `scalars().all()` — never `scalar_one_or_none()` — for member lookup. 0 matches → `unmatched_rows`, 2+ matches → `ambiguous_rows` with candidate context. `cycle_id` must be embedded in each `ambiguous_row` dict so the resolve UI can call `POST /api/calibrations/resolve-ambiguous` correctly (the commit result doesn't expose cycle_ids separately).

4. **Wizard constant-value affordance**: `MapColumnsStep` gained a `source: 'constant'` field type. The constant value is sent as `ConstantMapping` objects in the `MappingConfig` and applied to every row before validation. This is intentionally generic — any future import where metadata applies to an entire file can use the same mechanism.

5. **Widget registry pattern**: 9 widgets registered in `WIDGET_REGISTRY` as `React.lazy()` components. Widget visibility persisted to `localStorage` under `team-resourcer:calibration:visibleWidgets:v1` (versioned key). Data-source gating (`dataSource` field on `WidgetDef`) prevents unnecessary API calls for hidden widgets.

6. **Race-safe get-or-create for cycles**: `get_or_create_cycle` uses try-insert + `IntegrityError` catch + re-fetch, same pattern as `import_commit.py`. Required because concurrent imports could race to create the same cycle label.

7. **`invalidateAllCalibrationViews` helper**: Every calibration mutation `onSuccess` must call this helper. It invalidates `calibrationKeys.all` (covers all calibration queries by prefix) plus the member detail cache. Not calling it leads to stale 9-box grids after import.

8. **`@visx/sankey` is not needed for Sankey-style diagrams**: The standard approach (hand-rolled SVG cubic bezier paths with `M x y C ...`) produces equivalent visual output. Use `@visx/group` + plain `<path>` elements. Stroke width proportional to flow count gives depth cues. This avoids an extra dependency with uncertain API stability. See `MovementSankey.tsx` for the pattern.
