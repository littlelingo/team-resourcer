# Learnings

## 002-test-coverage-backend (2026-03-24)

### SQLite + aiosqlite test isolation
- **Transaction rollback doesn't work** with SQLite in-memory + `StaticPool` when service layer calls `db.commit()`. Savepoints (`join_transaction_mode="create_savepoint"`) fail silently on SQLite.
- **DELETE-after isolation** (truncate all tables in `autouse` fixture) is reliable and fast (<1s for 108 tests).
- Use `StaticPool` to ensure a single connection to the in-memory DB across all fixtures.

### SQLAlchemy async lazy-loading bug pattern
- `db.refresh(obj)` only reloads scalar columns, NOT relationships. Accessing unloaded relationships in async mode raises `MissingGreenlet`.
- **Fix**: Use `get_<entity>(db, id)` with `selectinload()` instead of `db.refresh()` when the response schema includes relationship fields.
- This bug existed in `member_service.create_member`, `member_service.update_member`, `team_service.create_team`, `team_service.update_team`, and `program_service.assign_member`.

### Duplicate index on SQLite
- The `Team` model has both `index=True` on `functional_area_id` column AND an explicit `Index("ix_teams_functional_area_id", ...)` in `__table_args__`. PostgreSQL tolerates this (different internal names), but SQLite's `CREATE INDEX` fails on the duplicate name.
- **Fix**: Use `@compiles(CreateIndex, "sqlite")` to emit `CREATE INDEX IF NOT EXISTS`.

### FastAPI router prefix + trailing slash
- History routes mounted at prefix `/api/members/{uuid}/history` with `@router.get("/")` require a trailing slash in test URLs: `/api/members/{uuid}/history/`. Without it, FastAPI returns 307 redirect.

### Import commit cycle detection
- `_has_cycle()` in `import_commit.py` checks both directions of a mutual A↔B cycle. Both links get skipped (result: 0 supervisors set), not just one. Tests must assert `== 0`, not `<= 1`.
