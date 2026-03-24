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

### Import commit cycle detection (backend)
- `_has_cycle()` in `import_commit.py` checks both directions of a mutual A↔B cycle. Both links get skipped (result: 0 supervisors set), not just one. Tests must assert `== 0`, not `<= 1`.

## 002-test-coverage-frontend (2026-03-24)

### Vitest + MSW v2 setup pattern
- MSW v2 uses `http` from `'msw'` and `HttpResponse` from `'msw'` (not `rest`/`ctx` from v1).
- Handler pattern: `http.get(url, () => HttpResponse.json(data))`. For 204: `new HttpResponse(null, { status: 204 })`.
- Server lifecycle must be in every file that uses MSW: `beforeAll(() => server.listen())`, `afterEach(() => server.resetHandlers())`, `afterAll(() => server.close())`.

### TanStack Query hook testing
- Each test needs a fresh `QueryClient` with `{ retry: false }` to prevent timeout on error paths.
- Use `React.createElement(QueryClientProvider, { client, children })` in `.ts` files to avoid needing `.tsx` extension.
- Mutation tests: call `.mutate()` then `waitFor(() => isSuccess)` — no `act()` wrapping needed.

### MapColumnsStep: duplicate text matching
- Component renders headers both as `<span>` labels and as `<option>` text in selects. `getByText('Employee ID')` finds multiple elements.
- Fix: use `getAllByText()` and filter by tag, or use more specific selectors.

### Coverage config scope matters
- Setting `coverage.include: ['src/lib/**', 'src/hooks/**']` means ALL files in those dirs count toward thresholds, including hooks not in the PRP scope.
- Either test everything in the included dirs, or narrow the include pattern. We chose to test everything — resulted in 100% coverage.
