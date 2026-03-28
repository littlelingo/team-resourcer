# Learnings

## 022-remove-main-import-button (2026-03-28)

Clean removal — no new patterns or errors encountered. Reviewer noted that the catch-all redirect only covers `/` (index route), not arbitrary unknown paths like `/import`. A `<Route path="*">` catch-all would be a useful follow-up.

## 013-entity-import (2026-03-25)

### TanStack Query invalidation must use exported key constants
- `queryClient.invalidateQueries({ queryKey: ['functional-areas'] })` does NOT match queries registered under `areaKeys.all = ["areas"]`. Always import and use the exported `*Keys.all` constants from hooks, never bare string literals. This was a stale-data bug caught in review.

### Dedup-skipped rows should be surfaced in CommitResult
- `_dedup_rows` silently removes duplicates from valid rows before commit. If the removed count isn't added to `skipped_count`, users see a total that doesn't add up (e.g., 10 rows uploaded but only 7 created + 0 skipped). Always compute `dedup_skipped = len(valid_rows) - len(deduped_valid)` and include it.

## 012-adapt-security-2 (2026-03-25)

### Pillow verify() invalidates the image object
- After `img.verify()`, the Image object cannot be reused — Pillow's documented behavior. Must call `Image.open()` a second time to read `.format`. This double-open is intentional and should not be collapsed into a single open.

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

### Docker image tag pinning: pin both runtime AND distro
- `node:20.20.1-alpine` pins the Node patch but floats the Alpine version. If Docker Hub remaps `-alpine` to a new distro release, the OS packages shift silently.
- Pin both: `node:20.20.1-alpine3.23`. This matches the backend convention (`python:3.12.8-slim-bookworm`).
- `node:20.20.1-alpine3.21` does NOT exist — Node 20.20.1 was only built against Alpine 3.23. Always verify the tag exists before committing.

### Coverage config scope matters
- Setting `coverage.include: ['src/lib/**', 'src/hooks/**']` means ALL files in those dirs count toward thresholds, including hooks not in the PRP scope.
- Either test everything in the included dirs, or narrow the include pattern. We chose to test everything — resulted in 100% coverage.
