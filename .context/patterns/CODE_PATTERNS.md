# Code Patterns

Conventions observed in the codebase with file-path and line-number evidence.

---

## Naming Conventions

**Python modules** — `snake_case` nouns, one module per concept.
- Models: `team_member.py`, `calibration_cycle.py`, `program_assignment.py`
- Services: `member_service.py`, `calibration_service.py`, `import_commit_calibrations.py`
- Routes: `members.py`, `calibration_cycles.py`, `import_router.py`

**Python classes** — `PascalCase` matching the table/concept name.
- `TeamMember`, `CalibrationCycle`, `ProgramAssignment` (models)
- `TeamMemberCreate`, `TeamMemberDetailResponse`, `CalibrationResponse` (schemas)

**TypeScript files** — `camelCase` for utilities/hooks/api, `PascalCase` for components.
- `useMembers.ts`, `calibrationApi.ts`, `format-utils.ts`
- `MemberDetailSheet.tsx`, `ImportWizard.tsx`, `NineBoxGrid.tsx`

**React components** — `PascalCase`, one component per file as the default export (with small
  co-located helpers as named exports).
- `MemberFormDialog`, `EntityMembersSheet`, `ComboboxField`

**Hook files** — `use<Domain>.ts` prefix. Domain matches the API resource.
- `useMembers.ts`, `useCalibrationCycles.ts`, `useFunctionalAreas.ts`

**Query key constants** — exported `const <entity>Keys` object with factory functions.
```typescript
// frontend/src/hooks/useMembers.ts lines 5-9
export const memberKeys = {
  all: ["members"] as const,
  list: (params?: Record<string, string>) => ["members", "list", params] as const,
  detail: (uuid: string) => ["members", "detail", uuid] as const,
}

// frontend/src/hooks/useCalibrationCycles.ts lines 7-15
export const calibrationKeys = {
  all: ['calibrations'] as const,
  cycles: ['calibrations', 'cycles'] as const,
  latest: (filters?) => ['calibrations', 'latest', filters ?? {}] as const,
  movement: (from, to) => ['calibrations', 'movement', from, to] as const,
  trends: (n) => ['calibrations', 'trends', n] as const,
  byMember: (uuid) => ['calibrations', 'member', uuid] as const,
}
```

---

## File Organization

Max 300 lines per file — split into modules at that threshold.

**Backend: service layer does DB work; routes are thin.**

`backend/app/services/member_service.py` contains all query logic, `selectinload` chains,
FK validation, and `db.commit()` calls. `backend/app/api/routes/members.py` only validates
path params, calls the service function, and raises `HTTPException` on `None` returns:

```python
# members.py (routes) lines 40-49 — thin handler, no DB logic
@router.get("/{member_uuid}", response_model=TeamMemberDetailResponse)
async def get_member_route(member_uuid: UUID, db: AsyncSession = Depends(get_db)):
    member = await get_member(db, member_uuid)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member
```

**Sub-resource routers**: nested resources use a dedicated router file included with a path
prefix. `history.py` handles `/api/members/{member_uuid}/history`; `member_calibrations.py`
handles `/api/members/{member_uuid}/calibrations`. Both are mounted in `main.py` with the
parent-entity prefix.

**Schemas separate from models**: `backend/app/models/team_member.py` (ORM) and
`backend/app/schemas/team_member.py` (Pydantic) are always separate files. Schemas use
`model_config = ConfigDict(from_attributes=True)` to hydrate from ORM instances.

**Frontend: hooks and api clients colocated by feature.**
- `src/hooks/useCalibrations.ts` imports from `src/api/calibrationApi.ts` and
  `src/hooks/useCalibrationCycles.ts`.
- `src/components/calibration/widgets/` contains all nine widget components plus a
  `registry.ts`, `constants.ts`, and `types.ts` — the entire calibration widget system in
  one directory.

**Test colocation**:
- Backend integration tests: `backend/tests/integration/test_<resource>_routes.py`
- Backend unit tests: `backend/tests/unit/test_<module>.py`
- Frontend hook/component tests: `src/hooks/__tests__/<hook>.test.ts` and
  `src/components/<feature>/__tests__/<Component>.test.tsx`

---

## Error Handling

**Backend HTTP errors** — always `HTTPException` with an explicit `status_code` and `detail`
string. 404 is the standard "not found" response; 422 for invalid input from import routes.

```python
# api/routes/teams.py line 58
raise HTTPException(status_code=404, detail="Team not found")

# api/routes/import_router.py lines 45-46
raise HTTPException(status_code=422, detail=str(exc)) from exc
```

**Race-safe get-or-create with savepoints** — any helper that inserts a row guarded by a
unique constraint uses `async with db.begin_nested()` (SQLAlchemy savepoint) so that a
concurrent insert's `IntegrityError` is caught and the outer transaction's prior work is
preserved. Do NOT use `await db.rollback()` inside a batch loop.

```python
# backend/app/services/import_commit.py::_get_or_create_program_team (lines 68-95)
try:
    async with db.begin_nested():
        team = ProgramTeam(...)
        db.add(team)
        await db.flush()
    return team
except IntegrityError:
    result = await db.execute(select(ProgramTeam).where(...))
    return result.scalar_one()
```

Same pattern in `calibration_cycle_service.py::get_or_create_cycle` and
`import_commit_calibrations.py::_upsert_calibration_row`. See LEARNINGS.md
"Savepoint pattern for race-safe get_or_create (2026-04-08)".

**Frontend query error states** — TanStack Query exposes `isLoading`, `isError`, and `error`
from every `useQuery` call. Example from `useMembers.ts` (line 11): callers destructure
`{ data, isLoading, error }`. `apiFetch` in `lib/api-client.ts` (lines 16-23) throws an
`Error` with the backend's `detail` string for all non-2xx responses.

---

## Testing Patterns

**Backend** — pytest with `asyncio_mode = "auto"` (pyproject.toml). Integration tests use a
real async SQLite in-memory DB wired through a FastAPI `dependency_overrides[get_db]`. Each
test gets a clean DB via the `_clean_tables` autouse fixture (DELETE-after, not rollback —
see `conftest.py` lines 53-69 for rationale). `conftest.py` also provides `area`, `team`,
`member`, `program` fixtures.

Unit tests in `tests/unit/` are pure Python — no HTTP, no DB. Example:
`tests/unit/test_import_parser.py`, `tests/unit/test_import_mapper.py`.

**Frontend** — vitest with jsdom environment. MSW intercepts HTTP via `test/msw/server.ts`
(setup in `test/setup.ts`). API handlers are in `test/msw/handlers.ts`. Tests live under
`__tests__/` directories alongside the feature:
- `hooks/__tests__/useMembers.test.ts`
- `components/shared/__tests__/DataTable.test.tsx`
- `components/members/__tests__/MemberCard.test.tsx`

**File naming**: `test_*.py` for Python; `*.test.ts[x]` for TypeScript.

---

## API Patterns

**RESTful conventions** (enforced in CLAUDE.md):
- `status_code=201` on all `POST` create routes (e.g., `teams.py` line 62, `members.py` line 52)
- `Response(status_code=204)` on all DELETE routes (e.g., `teams.py` lines 89-100)
- `PUT` for updates, never `PATCH` (e.g., `members.py` line 61, `teams.py` line 72)

**Response model on every endpoint** — every route handler declares `response_model=` to
ensure serialisation is explicit. Examples:
- `@router.get("/", response_model=list[TeamMemberListResponse])` (`members.py` line 29)
- `@router.get("/latest", response_model=list[CalibrationResponse])` (`calibrations.py` line 19)

**`selectinload` chains for all relationships in response schemas** — the service layer must
eager-load every relationship that appears in the Pydantic response schema, or async
SQLAlchemy will raise `MissingGreenlet`. The canonical example is `get_member()` in
`member_service.py` (lines 91-113), which chains:
```python
selectinload(TeamMember.functional_area),
selectinload(TeamMember.team),
selectinload(TeamMember.supervisor),
selectinload(TeamMember.functional_manager),
selectinload(TeamMember.history),
selectinload(TeamMember.program_assignments).selectinload(ProgramAssignment.program),
selectinload(TeamMember.program_assignments).selectinload(ProgramAssignment.program_team),
selectinload(TeamMember.calibrations).selectinload(Calibration.cycle),
```
Calibrations must only appear on the detail response schema, never the list schema (guard
documented in errors/INDEX.md).

**TanStack Query key structure** — `{entity}Keys.all | .list(params) | .detail(id)` pattern
for members (`useMembers.ts` lines 5-9); `calibrationKeys.latest(filters) | .cycles |
.movement(from, to) | .trends(n)` for calibrations (`useCalibrationCycles.ts` lines 7-15).
Hierarchical prefix: `memberKeys.all = ["members"]` covers all subkeys when used with
`exact: false` (the TanStack default).

**Mutation invalidation** — every mutation's `onSuccess` invalidates the relevant query keys.
For calibrations, the shared `invalidateAllCalibrationViews(qc, memberUuid)` helper
(defined in `useCalibrationCycles.ts` lines 21-32) is called from every mutation in
`useCalibrations.ts`. It invalidates `calibrationKeys.all` (all calibration queries by
prefix) plus `memberKeys.detail(uuid)` (member detail cache, which embeds calibrations).

**Frontend constants mirror backend single-source-of-truth** — user-visible constants that
correspond to backend data live in a single `constants.ts` with a docstring pointing at the
canonical backend source. Example: `frontend/src/components/calibration/widgets/constants.ts`
exports `BOX_LABELS`, `BOX_TO_AXES`, and `AXIS_LABELS`, each with a comment pointing to
`backend/app/schemas/calibration.py`. The backend schema is authoritative; the frontend file
mirrors it.
