# Tech Stack

## Languages

| Language | Version | Where |
|----------|---------|-------|
| Python | 3.12.8 (from `backend/Dockerfile`) | Backend |
| TypeScript | ~5.9.3 (from `frontend/package.json`) | Frontend |
| Node.js | 20.20.1-alpine3.23 (from `frontend/Dockerfile`) | Frontend build/runtime |

## Backend

| Library | Version | Role |
|---------|---------|------|
| FastAPI | latest compatible with Python 3.12 | HTTP framework, dependency injection, OpenAPI docs |
| SQLAlchemy | async (`sqlalchemy.ext.asyncio`) | ORM; `Mapped`/`mapped_column` declarative style |
| Alembic | via `requirements.txt` | Schema migrations (`alembic upgrade head`) |
| Pydantic v2 | `BaseModel`, `ConfigDict`, `computed_field` | Request/response validation and serialisation |
| uvicorn | `--reload` in dev (docker-compose.yml line 39), plain CMD in Dockerfile | ASGI server |
| pytest | `asyncio_mode = "auto"` (pyproject.toml) | Test runner |
| httpx + aiosqlite | test dependencies | Async HTTP client and in-memory SQLite for integration tests |
| ruff | target `py312`, line-length 100, rules E/F/I/UP | Lint + format |
| mypy | `python_version = "3.12"`, `strict = false` | Type checking |

All backend config lives in `backend/pyproject.toml` (ruff, mypy, pytest sections).

## Frontend

| Library | Version | Role |
|---------|---------|------|
| React | ^19.2.4 | UI framework |
| Vite | ^8.0.1 | Dev server + bundler |
| TypeScript | ~5.9.3 | Type safety |
| TanStack Query | ^5.95.0 | Server state, caching, mutations |
| TanStack Table | ^8.21.3 | Headless table primitives (`DataTable.tsx`) |
| React Hook Form | ^7.72.0 | Form state |
| Zod | ^3.25.76 | Schema validation (with `@hookform/resolvers`) |
| Radix UI | ^1–2.x (per component) | Accessible primitives: Dialog, Select, Tabs, Tooltip, Popover, etc. |
| Tailwind CSS | ^3.4.17 | Utility-first styling |
| framer-motion | ^12.38.0 | Animation (calibration filter transitions) |
| @xyflow/react | ^12.10.1 | Org/program tree graph canvas |
| @visx/* | ^3.12.0 | SVG charting: axis, group, hierarchy, responsive, shape, text, sankey, scale |
| cmdk | ^1.1.1 | Command-palette / combobox primitive (`ComboboxField.tsx`) |
| lucide-react | ^0.469.0 | Icon set |
| sonner | ^1.7.4 | Toast notifications |
| react-router-dom | ^6.30.3 | Client-side routing |
| vitest | ^2.1.0 | Test runner |
| msw | ^2.7.0 | API mocking in tests (`test/msw/server.ts`, `handlers.ts`) |
| @testing-library/react | ^16.1.0 | Component testing utilities |
| jsdom | ^25.0.0 | DOM environment for vitest |

**Dependency pin**: `npm install --legacy-peer-deps` is required because `@visx/` 3.12.x
declares `peerDependencies: { react: "^18" }` while the runtime is React 19. This is a
stale peer-dep declaration — Visx is forward-compatible. See
`.context/knowledge/dependencies/PINS.md` for removal criteria (when Visx ships 4.x and
`npm install` succeeds without the flag).

## Database

| Component | Version |
|-----------|---------|
| PostgreSQL | 16.6-alpine (docker-compose.yml line 2) |

## Dev Commands

| Action | Command |
|--------|---------|
| Install (backend) | `pip install -r backend/requirements.txt` |
| Install (frontend) | `cd frontend && npm ci --legacy-peer-deps` |
| Start all | `make up` |
| Stop all | `make down` |
| Backend test | `make test` |
| Frontend test | `cd frontend && npx vitest run` |
| Frontend test (coverage) | `cd frontend && npx vitest run --coverage` |
| Lint | `make lint` |
| Type-check | `make typecheck` |
| Format | `make format` |
| Reset DB | `make reset-db` |
| Rebuild frontend | `make rebuild-frontend` |
| Migrate | `make migrate` (runs `docker compose exec backend alembic upgrade head`) |
| New migration | `make migration name="description"` |
| DB shell | `make shell-db` |
| Seed data | `make seed` |

`make up` runs `docker compose down` first, brings everything up, then auto-runs
`alembic upgrade head` before printing `docker compose ps`.
