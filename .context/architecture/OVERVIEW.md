# Architecture Overview

team-resourcer is a full-stack workforce management application that organises people
(TeamMembers) into a hierarchy of Agencies, Programs, Functional Areas, and Teams, tracks
financial history and supervisor relationships, and provides 9-box calibration analytics with
a CSV/Google-Sheets import pipeline.

## Component Map

```
team-resourcer/
├── backend/                      FastAPI async API + service layer
│   ├── app/
│   │   ├── main.py               App factory: CORS, lifespan, router registration
│   │   ├── core/
│   │   │   ├── config.py         Pydantic settings (CORS_ORIGINS, UPLOAD_DIR, DB URL)
│   │   │   └── database.py       Async SQLAlchemy engine + get_db dependency
│   │   ├── models/               SQLAlchemy ORM models (one file per table)
│   │   ├── schemas/              Pydantic request/response schemas (separate from models)
│   │   ├── services/             All DB work; routes are thin pass-throughs
│   │   └── api/routes/           FastAPI APIRouter handlers
│   ├── alembic/                  Migration scripts and alembic.ini
│   └── tests/
│       ├── integration/          HTTP-level tests via HTTPX + async SQLite in-memory DB
│       └── unit/                 Pure-logic tests (parser, mapper, session utilities)
│
├── frontend/                     React 19 SPA served by Vite
│   └── src/
│       ├── api/                  Raw apiFetch wrappers per domain (calibrationApi.ts, importApi.ts)
│       ├── hooks/                TanStack Query hooks (useMembers.ts, useCalibrations.ts, …)
│       ├── components/           Feature-grouped UI: members/, calibration/, import/, trees/, shared/
│       ├── pages/                Route-level page components
│       ├── types/                Shared TypeScript interfaces (index.ts)
│       └── lib/                  Utilities: api-client.ts, format-utils.ts, member-utils.ts
│
├── docker-compose.yml            Three-service topology: db, backend, frontend
└── Makefile                      Dev workflow targets (up, test, migrate, reset-db, …)
```

## Request Data Flow

**Example: creating a new team member**

1. React form (`MemberFormDialog.tsx`) calls `useCreateMember()` (TanStack Query mutation).
2. The hook calls `apiFetch<TeamMember>("/api/members/", { method: "POST", body: … })` via
   `lib/api-client.ts`, which prepends `VITE_API_BASE_URL` (default `http://localhost:8000`).
3. FastAPI router handler `create_member_route` in `api/routes/members.py` validates the
   request body against `TeamMemberCreate` (Pydantic) and calls `create_member(db, data)`
   from the service layer.
4. `member_service.create_member` validates FK constraints, writes the ORM object, calls
   `create_history_entry` for financial fields, and calls `db.commit()`. It then re-fetches
   with full `selectinload` chains and returns the ORM object.
5. FastAPI serialises the return value against `TeamMemberDetailResponse` (response_model)
   and returns HTTP 201.
6. On `onSuccess`, `useCreateMember` calls `qc.invalidateQueries({ queryKey: memberKeys.all })`,
   triggering a refetch of any open list views.

**Example: importing calibrations from CSV**

1. Frontend `ImportWizard.tsx` posts the file to `POST /api/import/upload` → session created,
   headers returned.
2. User maps columns; frontend posts `POST /api/import/preview` → `import_mapper.py` applies
   mappings, `import_preview.py` computes unassignment previews; rows returned.
3. User confirms; frontend posts `POST /api/import/commit` → `import_commit.py` (or
   `import_commit_calibrations.py`) runs upserts inside a single async transaction with
   savepoint-guarded `_get_or_create_*` helpers.
4. Ambiguous rows (name collision) are returned in `CommitResult.ambiguous_rows`; user
   resolves via `POST /api/calibrations/resolve-ambiguous`.

## Integration Points

- **PostgreSQL 16.6** (docker service `db`, port 5432) — primary data store with UUID PKs for
  members, integer PKs for all other entities.
- **Google Sheets** (optional) — `import_sheets.py` fetches a sheet via Google Service Account
  credentials; injected into the container as a secret file or base64 env var. Returns 422 if
  neither credential is set.
- **Static file serving** — profile images written to the `uploads/` volume, served at
  `/uploads/<path>` via `StaticFiles` mounted in `main.py`.
- **Background task** — `import_session.py` starts an asyncio cleanup task at startup
  (`lifespan`) to expire stale upload sessions.

## Docker Compose Topology

```
  [Browser :5173]
       │ VITE_API_BASE_URL=http://localhost:8000
       ▼
  [frontend :5173]  ── npm run dev (Vite HMR, bind-mount ./frontend)
       │
  [backend  :8000]  ── uvicorn --reload (bind-mount ./backend); depends_on: db healthy
       │
  [db       :5432]  ── postgres:16.6-alpine, volume pgdata
```

CORS is controlled by `CORS_ORIGINS` env var in `.env`; default compose value is
`http://localhost:5173,http://localhost:3000`.

## Constraints

- **Upload limit**: 10 MB enforced in `import_router.py` (line 29); larger files must be
  imported via Google Sheets.
- **Single-worker assumption**: import sessions are stored in an in-process Python dict
  (`import_session.py`). Running multiple uvicorn workers (production) would produce
  session-not-found errors. The dev compose uses `--reload` (single worker); a production
  compose override would need sticky sessions or a shared session store.
- **SQLite for tests only**: integration tests run against `sqlite+aiosqlite:///:memory:`.
  Postgres-specific constructs (e.g., `UUID(as_uuid=True)`, `pg_isready` health check) are
  absent from the test layer. Savepoint-based race helpers are only exercised against real
  Postgres.
- **Calibration MissingGreenlet guard**: `calibrations` relationship must only be eager-loaded
  in `get_member()` (detail), never on list queries — accessing the relationship without
  `selectinload` raises `MissingGreenlet` in async SQLAlchemy. See errors/INDEX.md #4.
- **CORS on 500s**: `CORSMiddleware` runs after `ServerErrorMiddleware`; uncaught 500s shed
  CORS headers, causing the browser to surface a network error instead of the actual message.
