# Research Notes: Initial README

## Goal
Create an extensive, detailed, and informative initial README for the team-resourcer web app, covering architecture, setup, building, and running all components.

## Current State
- No README.md exists at project root
- `.context/OVERVIEW.md` has a brief architecture summary but is internal docs, not a user-facing README
- `.env.example` exists with all required env vars
- `Makefile` provides all dev commands
- `docker-compose.yml` orchestrates 3 services

## Findings

### Project Overview
**team-resourcer** is a full-stack team resource management app for tracking team members, program assignments, functional areas, org hierarchy, and financial data (salary, bonus, PTO). Features include card/table views, interactive tree visualizations (org chart, program trees, area trees), and a data import wizard supporting CSV, Excel, and Google Sheets.

### Tech Stack
| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 (async), Pydantic v2 |
| Database | PostgreSQL 16 (Docker, alpine) |
| Migrations | Alembic 1.14 |
| Frontend | React 19, Vite 8, TypeScript 5.9 |
| Styling | Tailwind CSS 3.4 + shadcn/ui (Radix UI) |
| Data fetching | TanStack Query v5 |
| Routing | React Router DOM v6 |
| Tables | TanStack Table v8 |
| Tree viz | @xyflow/react v12 + dagre |
| Forms | React Hook Form + Zod |
| Containers | Docker Compose (3 services) |

### Project Structure
```
team-resourcer/
├── Makefile                    # All dev commands
├── docker-compose.yml          # 3 services: db, backend, frontend
├── .env.example                # Environment variable template
├── backend/
│   ├── Dockerfile              # python:3.12-slim
│   ├── requirements.txt
│   ├── alembic/                # DB migrations
│   └── app/
│       ├── main.py             # FastAPI app entrypoint
│       ├── core/               # config.py, database.py
│       ├── models/             # 6 SQLAlchemy models
│       ├── schemas/            # 9 Pydantic schema files
│       ├── services/           # 14 service files (domain + import pipeline)
│       ├── api/routes/         # 7 route files
│       ├── seed.py             # Seed script
│       └── tests/              # 108 tests (integration + unit)
└── frontend/
    ├── Dockerfile              # node:20-alpine
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx             # Route definitions
        ├── pages/              # 8 page components
        ├── components/         # 30+ components
        ├── hooks/              # 5 TanStack Query hook files
        ├── lib/                # api client, utils
        └── test/               # MSW setup + handlers
```

### API Routes (all prefixed `/api`)
| Router | Prefix | Purpose |
|---|---|---|
| members | `/api/members` | CRUD + profile photo upload |
| history | `/api/members/{uuid}/history` | Financial history by field |
| areas | `/api/areas` | CRUD + tree view + nested teams |
| teams | `/api/areas/{area_id}/teams` | CRUD + member assignment |
| programs | `/api/programs` | CRUD + tree + member assignment |
| org | `/api/org` | Org tree + supervisor reassignment (circular ref guard) |
| import | `/api/import` | Upload, Google Sheets, preview, commit |

### Frontend Pages
- `/members` — Card/table toggle, filter by area/team/program
- `/programs` — Program management
- `/functional-areas` — Area management
- `/teams` — Team management
- `/tree/org` — Interactive org chart (drag-to-reassign supervisor)
- `/tree/programs/:id` — Program tree visualization
- `/tree/areas/:id` — Area tree visualization
- `/import` — 4-step data import wizard

### Docker Compose Services
- **db** — `postgres:16-alpine`, health check, `pgdata` volume
- **backend** — `python:3.12-slim`, hot reload via volume mount, port 8000
- **frontend** — `node:20-alpine`, Vite dev server, port 5173

### Makefile Commands
| Command | What it does |
|---|---|
| `make up` | Start all services |
| `make down` | Stop all services |
| `make logs` | Tail all service logs |
| `make migrate` | Run Alembic migrations |
| `make migration name="..."` | Generate new migration |
| `make seed` | Seed database with sample data |
| `make test` | Run backend pytest suite |
| `make lint` | Run ruff linter |
| `make format` | Run ruff formatter |
| `make typecheck` | Run mypy |
| `make shell-db` | Open psql shell |

### Environment Variables (from .env.example)
```
POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_HOST, POSTGRES_PORT
DATABASE_URL=postgresql+asyncpg://...
UPLOAD_DIR=/app/uploads
BACKEND_HOST, BACKEND_PORT
VITE_API_URL=http://localhost:8000
```

Optional Google Sheets:
- `GOOGLE_SERVICE_ACCOUNT_FILE` — path to service account JSON
- `GOOGLE_SERVICE_ACCOUNT_JSON` — base64-encoded alternative

### Import Pipeline
```
Upload (CSV/XLSX) or Google Sheets URL
  → Parser → ParseResult (headers, preview, raw_rows)
  → Session (UUID, 30-min TTL, in-memory)
  → Mapper (column mapping + validation)
  → Preview (up to 50 rows)
  → Commit (two-pass upsert: members first, supervisors second, circular detection)
```

### Testing
- **Backend**: 108 tests, `make test` — SQLite in-memory, HTTPX AsyncClient, pytest-asyncio
- **Frontend**: 111 tests, `npm run test` — Vitest + jsdom, MSW v2, Testing Library
- **Coverage**: `npm run test:coverage` — 70% threshold on `src/lib/` and `src/hooks/`

### Database
- 6 tables: `team_members`, `teams`, `functional_areas`, `programs`, `program_assignments`, `member_history`
- Single Alembic migration for initial schema
- Seed data available via `make seed`
- History auto-captured when salary/bonus/PTO changes

### Key Architectural Decisions
- TanStack Query cache is the single source of truth (no global state store)
- All mutations use PUT (not PATCH)
- Services auto-capture financial field changes to member_history
- Org tree has circular supervisor detection
- Import sessions are in-memory with 30-min TTL and cleanup task

## README Sections to Include
1. Project title + brief description + key features
2. Screenshots placeholder
3. Tech stack summary
4. Prerequisites (Docker, Docker Compose, Node.js optional for frontend dev)
5. Quick start (clone, .env, make up, make migrate, make seed)
6. Project structure
7. Backend details (API routes, services, models)
8. Frontend details (pages, components, hooks)
9. Data import feature
10. Development (hot reload, Makefile commands)
11. Testing (backend + frontend)
12. Environment variables reference
13. Google Sheets integration setup
14. Database management (migrations, seed, psql)
15. License placeholder

## Gaps / Open Questions
- No screenshots exist yet — use placeholder section
- License not specified — add placeholder
- No contribution guidelines — skip unless requested
- Google Sheets setup could use more detail on creating service account
