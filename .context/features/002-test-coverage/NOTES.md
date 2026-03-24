# Test Coverage — Research Notes

Snapshot date: 2026-03-23

---

## 1. Existing Test Infrastructure

### Backend

| Item | Status |
|---|---|
| `backend/tests/` directory | Does NOT exist |
| `conftest.py` | Does NOT exist |
| Any `test_*.py` files | None found anywhere in the project |
| pytest config (`pyproject.toml`) | EXISTS — `asyncio_mode = "auto"`, `testpaths = ["tests"]` |
| pytest installed | YES — `pytest==8.3.4`, `pytest-asyncio==0.24.0`, `httpx==0.28.1` |

The pytest stack is fully installed and configured but the `tests/` directory and all test files are absent.

### Frontend

| Item | Status |
|---|---|
| `*.test.tsx` / `*.spec.tsx` files in `src/` | None found |
| vitest installed | NO |
| @testing-library/react installed | NO |
| jsdom / happy-dom installed | NO |
| vitest config block in `vite.config.ts` | NOT present — config contains only plugin + path alias |
| Test script in `package.json` | NOT present — only `dev`, `build`, `lint`, `preview` |

No frontend test tooling is installed or configured at all.

---

## 2. Backend Test Gaps

### 2a. Services — all untested

| File | Notable test targets |
|---|---|
| `app/services/import_parser.py` | `parse_upload()` — CSV/XLSX routing, UTF-8/latin-1 fallback, unsupported extension errors, `.xls` rejection |
| `app/services/import_session.py` | `create_session()`, `get_session()` (TTL expiry), `delete_session()`, cleanup task no-op |
| `app/services/import_mapper.py` | `apply_mapping()` — unknown target fields error, required-field validation, email regex, numeric validation, duplicate employee_id warning |
| `app/services/import_commit.py` | `commit_import()` — get-or-create helpers, two-pass upsert, supervisor cycle detection (`_has_cycle`), history recording, rollback on DB error |
| `app/services/import_sheets.py` | `_extract_sheet_id()` (URL vs bare ID), `_load_credentials()` (file path / base64 JSON / missing), `fetch_sheet()` (404 / HTTP error / empty sheet) |
| `app/services/member_service.py` | `list_members()` filters, `create_member()` + history entry, `update_member()` financial field diff, `delete_member()` not-found |
| `app/services/org_service.py` | `get_org_tree()` tree build, `set_supervisor()` self-reference guard, cycle detection (`_check_no_cycle`) |
| `app/services/team_service.py` | CRUD + `add_member_to_team`, `remove_member_from_team` |
| `app/services/area_service.py` | CRUD |
| `app/services/program_service.py` | CRUD + `assign_member`, `unassign_member`, `get_program_members` |
| `app/services/history_service.py` | `get_member_history()` with optional field filter |
| `app/services/image_service.py` | `save_profile_image()` validation and file write |
| `app/services/tree_service.py` | `build_org_tree()`, `build_program_tree()` (not-found returns None), `build_area_tree()` (area→teams→members edges) |

Priority: `import_parser`, `import_mapper`, `import_session` are pure functions with no DB dependency — ideal first targets. `import_commit` and `org_service` contain complex logic (cycle detection) that warrants dedicated unit tests.

### 2b. API Routes — all untested

| Router file | Endpoints | Notable edge cases |
|---|---|---|
| `app/api/routes/members.py` | GET `/`, GET `/{uuid}`, POST `/`, PUT `/{uuid}`, DELETE `/{uuid}`, POST `/{uuid}/image` | 404 on unknown UUID, image upload 400 on invalid file |
| `app/api/routes/teams.py` | GET `/`, GET `/{id}`, POST `/`, PUT `/{id}`, DELETE `/{id}`, POST `/{id}/members`, DELETE `/{id}/members/{uuid}` | `area_id` path param must match team's `functional_area_id`; 404 otherwise |
| `app/api/routes/areas.py` | GET `/`, GET `/{id}`, POST `/`, PUT `/{id}`, DELETE `/{id}`, GET `/{id}/tree` | Mounts teams sub-router; tree 404 when area missing |
| `app/api/routes/programs.py` | GET `/`, GET `/{id}`, POST `/`, PUT `/{id}`, DELETE `/{id}`, GET `/{id}/tree`, GET `/{id}/members`, POST `/{id}/assignments`, DELETE `/{id}/assignments/{uuid}` | Tree 404, assign ValueError → 404 |
| `app/api/routes/org.py` | GET `/tree`, PUT `/members/{uuid}/supervisor` | Cycle → 400, self-reference → 400, not-found → 404 |
| `app/api/routes/history.py` | GET `/` (on `/api/members/{uuid}/history`) | Optional `field` enum filter |
| `app/api/routes/import_router.py` | POST `/upload`, POST `/google-sheets`, POST `/preview`, POST `/commit` | 10 MB limit → 413, parse error → 422, session not found → 404, unknown fields → 422 |

### 2c. Models — validation / constraint coverage

No model unit tests exist. Key constraints worth testing at integration level:

- `TeamMember`: `employee_id` unique + index, self-referential `supervisor_id` FK
- `Team`: `lead_id` nullable FK to `team_members.uuid`
- `ProgramAssignment`: unique composite `(member_uuid, program_id)` if enforced
- `MemberHistory`: `field` enum values (`salary`, `bonus`, `pto_used`)

### 2d. Schemas — no Pydantic validation tests

| Schema file | Worth testing |
|---|---|
| `app/schemas/import_schemas.py` | `MappingConfig`, `MappedRow` field types |
| `app/schemas/team_member.py` | `TeamMemberCreate` / `TeamMemberUpdate` — required vs optional fields |
| `app/schemas/tree.py` | `TreeNode`, `TreeEdge`, `TreeResponse` shape |
| All others | Low priority — straightforward models |

---

## 3. Frontend Test Gaps

### 3a. Hooks — all untested

| File | What to test |
|---|---|
| `src/hooks/useMembers.ts` | `useMembers`, `useMember`, `useCreateMember`, `useUpdateMember`, `useDeleteMember` — query key structure, cache invalidation on mutation success |
| `src/hooks/useTeams.ts` | Same pattern |
| `src/hooks/usePrograms.ts` | Same pattern |
| `src/hooks/useFunctionalAreas.ts` | Same pattern |
| `src/hooks/useTrees.ts` | `useOrgTree`, `useProgramTree` (disabled when `id <= 0`), `useAreaTree` |

### 3b. Components — all untested

**High priority (complex logic):**

| File | What to test |
|---|---|
| `src/components/trees/useDragReassign.ts` | `isValidTarget` per tree type, snap distance threshold, `confirmReassign` API calls per tree type (org/program/area), cycle/cancel flows |
| `src/components/trees/useTreeLayout.ts` | Dagre layout calculation |
| `src/components/trees/useTreeSearch.ts` | Search filtering logic |
| `src/components/import/ImportWizard.tsx` | Step transitions, state passed between steps |
| `src/components/import/MapColumnsStep.tsx` | Column mapping UI logic |

**Medium priority (form dialogs):**

| File |
|---|
| `src/components/members/MemberFormDialog.tsx` |
| `src/components/teams/TeamFormDialog.tsx` |
| `src/components/programs/ProgramFormDialog.tsx` |
| `src/components/functional-areas/FunctionalAreaFormDialog.tsx` |
| `src/components/shared/ConfirmDialog.tsx` |

**Lower priority (display-only):**

`MemberCard.tsx`, `MemberDetailSheet.tsx`, `DataTable.tsx`, `SearchFilterBar.tsx`, `RowActionsMenu.tsx`, `ImageUpload.tsx`, `PageError.tsx`, layout components, tree node components

### 3c. Pages — all untested

| File | Test targets |
|---|---|
| `src/pages/MembersPage.tsx` | Filter bar integration, create/edit/delete flows |
| `src/pages/TeamsPage.tsx` | Area scoping, CRUD |
| `src/pages/ProgramsPage.tsx` | Assign/unassign members |
| `src/pages/FunctionalAreasPage.tsx` | CRUD |
| `src/pages/ImportPage.tsx` | Import wizard integration |
| `src/pages/trees/OrgTreePage.tsx` | Drag-reassign integration |
| `src/pages/trees/AreaTreePage.tsx` | Area/team node interactions |
| `src/pages/trees/ProgramTreePage.tsx` | Program node interactions |

### 3d. API/lib — all untested

| File | What to test |
|---|---|
| `src/lib/api-client.ts` | `apiFetch` — 204 returns undefined, non-ok extracts `detail`, FormData skips Content-Type header; `getImageUrl` — null/undefined returns undefined, absolute paths pass through, relative paths prepend BASE_URL |
| `src/api/importApi.ts` | `uploadFile` uses FormData, `fetchGoogleSheet`, `previewMapping`, `commitImport` — all delegate to `apiFetch` with correct paths/methods |
| `src/lib/member-utils.ts` | `getInitials` — single word, two words, multiple words |

---

## 4. Test Dependencies

### Backend — installed, nothing missing for basic testing

```
pytest==8.3.4
pytest-asyncio==0.24.0       # asyncio_mode = "auto" already set
httpx==0.28.1                 # for FastAPI TestClient / AsyncClient
```

**Missing for integration tests against a real DB:**

- `pytest-postgresql` or a Docker-based test DB override via `conftest.py`
- `aiosqlite` (for an in-memory async SQLite DB — simpler alternative to test Postgres)

There is no `anyio` in requirements but `pytest-asyncio` covers `asyncio_mode = "auto"` directly.

### Frontend — nothing installed

Must add to `devDependencies`:

```json
"vitest": "^2.x",
"@vitest/coverage-v8": "^2.x",
"@testing-library/react": "^16.x",
"@testing-library/user-event": "^14.x",
"@testing-library/jest-dom": "^6.x",
"jsdom": "^25.x",
"msw": "^2.x"          // for API mocking in hook/component tests
```

`vite.config.ts` needs a `test` block added:

```ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
}
```

---

## 5. Database Test Setup

No conftest exists. For backend integration tests the recommended pattern given the existing stack:

**Option A — Async SQLite (zero infrastructure, fastest):**
- Add `aiosqlite` to requirements
- `conftest.py` creates an in-memory SQLite engine, runs `Base.metadata.create_all`, yields `AsyncSession`, rolls back after each test
- Override `get_db` FastAPI dependency via `app.dependency_overrides`

**Option B — Real test Postgres (closer to production):**
- Requires a second DB (e.g. `team_resourcer_test`) reachable in CI
- `conftest.py` reads a `TEST_DATABASE_URL` env var, applies migrations via Alembic before the session, truncates tables between tests

The `asyncio_mode = "auto"` setting in `pyproject.toml` means all `async def test_*` functions are automatically awaited with no `@pytest.mark.asyncio` decorator needed.

---

## 6. Test Data / Fixtures

No fixture files (CSV, JSON, SQL) exist anywhere in the project. There is a `backend/app/seed.py` that presumably populates dev data — it could be a source of fixture patterns but is not yet a test fixture.

For the import pipeline specifically, the following fixture files would be useful to create:

- `backend/tests/fixtures/valid_members.csv` — happy-path import
- `backend/tests/fixtures/invalid_members.csv` — rows with missing employee_id, bad email, non-numeric salary
- `backend/tests/fixtures/duplicate_ids.csv` — duplicate employee_id rows
- `backend/tests/fixtures/supervisor_cycle.csv` — A supervises B supervises A

---

## 7. Summary of What Needs to Be Created

### Backend

```
backend/tests/
  __init__.py
  conftest.py                          # DB fixtures, app client setup
  unit/
    test_import_parser.py              # no DB needed
    test_import_session.py             # no DB needed
    test_import_mapper.py              # no DB needed (uses session store)
    test_import_sheets.py              # mock google API
  integration/
    test_members_routes.py
    test_teams_routes.py
    test_areas_routes.py
    test_programs_routes.py
    test_org_routes.py
    test_history_routes.py
    test_import_routes.py
    test_member_service.py
    test_org_service.py                # cycle detection
    test_import_commit.py              # two-pass upsert, cycles
    test_tree_service.py
  fixtures/
    valid_members.csv
    invalid_members.csv
    duplicate_ids.csv
    supervisor_cycle.csv
```

### Frontend

```
frontend/src/test/
  setup.ts                             # @testing-library/jest-dom import
unit/
  lib/
    api-client.test.ts
    member-utils.test.ts
  hooks/
    useMembers.test.ts
    useTeams.test.ts
    usePrograms.test.ts
    useFunctionalAreas.test.ts
    useTrees.test.ts
  components/
    trees/useDragReassign.test.ts
    trees/useTreeLayout.test.ts
    trees/useTreeSearch.test.ts
    import/ImportWizard.test.tsx
    shared/ConfirmDialog.test.tsx
  pages/
    MembersPage.test.tsx
    ImportPage.test.tsx
```

---

## 8. Recommended Implementation Order

1. **Backend unit tests first** (no DB, no infra): `import_parser`, `import_session`, `import_mapper` — these are pure Python and will demonstrate the testing pattern immediately.
2. **Backend conftest + DB fixture** — establish the async DB session fixture and `AsyncClient` for FastAPI.
3. **Backend integration tests** — CRUD routes (members, areas, teams, programs), then the complex flows (import commit, supervisor cycle, tree builds).
4. **Frontend tooling setup** — install vitest, testing-library, msw; add `test` block to `vite.config.ts`; add `test` script to `package.json`.
5. **Frontend unit tests** — `api-client`, `member-utils`, hooks with msw mocks.
6. **Frontend component/page tests** — form dialogs, import wizard, drag-reassign.
