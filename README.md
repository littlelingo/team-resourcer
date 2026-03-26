# Team Resourcer

A full-stack team resource management application for tracking team members, program assignments, functional areas, organizational hierarchy, and financial data.

## Features

- **Member Management** — Create, edit, and view team members with profile photos, salary, bonus, and PTO tracking
- **Organizational Hierarchy** — Interactive org chart with drag-to-reassign supervisor relationships and circular reference detection
- **Programs & Functional Areas** — Manage programs, functional areas, and teams with tree visualizations
- **Data Views** — Toggle between card and table views with filtering by area, team, and program
- **Data Import** — Bulk import via CSV, Excel, or Google Sheets with a guided 4-step wizard (upload, map columns, preview, commit)
- **Financial History** — Automatic tracking of salary, bonus, and PTO changes over time

## Screenshots

<!-- Add screenshots here -->

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 (async), Pydantic v2 |
| Database | PostgreSQL 16 |
| Migrations | Alembic 1.14 |
| Frontend | React 19, TypeScript 5.9, Vite 8 |
| Styling | Tailwind CSS 3.4 + shadcn/ui (Radix UI primitives) |
| Data Fetching | TanStack Query v5 |
| Routing | React Router DOM v6 |
| Tables | TanStack Table v8 |
| Tree Visualization | @xyflow/react v12 + dagre |
| Forms | React Hook Form + Zod |
| Containers | Docker Compose |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- (Optional) [Node.js 20+](https://nodejs.org/) — only needed for running frontend tests or developing outside Docker

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd team-resourcer

# 2. Create environment file
cp .env.example .env
# Edit .env with your preferred database credentials

# 3. Start all services
make up

# 4. Run database migrations
make migrate

# 5. (Optional) Seed with sample data
make seed
```

Open the app:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Health Check**: http://localhost:8000/health

## Project Structure

```
team-resourcer/
├── Makefile                        # Development commands
├── docker-compose.yml              # 3 services: db, backend, frontend
├── .env.example                    # Environment variable template
│
├── backend/
│   ├── Dockerfile                  # python:3.12-slim
│   ├── requirements.txt            # Python dependencies
│   ├── alembic/                    # Database migrations
│   │   ├── env.py
│   │   └── versions/               # Migration scripts
│   ├── app/
│   │   ├── main.py                 # FastAPI app entrypoint + CORS + lifespan
│   │   ├── core/
│   │   │   ├── config.py           # pydantic-settings configuration
│   │   │   └── database.py         # Async SQLAlchemy engine + session
│   │   ├── models/                 # 6 SQLAlchemy ORM models
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   ├── services/               # Business logic (14 service modules)
│   │   ├── api/routes/             # 7 route modules
│   │   └── seed.py                 # Sample data seeder
│   └── tests/
│       ├── conftest.py             # Test DB + fixtures
│       ├── integration/            # Route and service integration tests
│       └── unit/                   # Stateless unit tests
│
└── frontend/
    ├── Dockerfile                  # node:20-alpine
    ├── package.json
    ├── vite.config.ts              # Vite + Vitest + path aliases
    └── src/
        ├── App.tsx                 # Route definitions
        ├── main.tsx                # React entry point
        ├── pages/                  # 8 page components
        ├── components/             # 30+ components organized by domain
        │   ├── layout/             # AppLayout, PageHeader
        │   ├── members/            # Member cards, forms, dialogs
        │   ├── programs/           # Program management
        │   ├── functional-areas/   # Area management
        │   ├── teams/              # Team management
        │   ├── trees/              # Tree nodes + visualization
        │   ├── import/             # Import wizard steps
        │   └── ui/                 # shadcn/ui primitives
        ├── hooks/                  # TanStack Query data-fetching hooks
        ├── lib/                    # API client, utilities
        └── test/                   # MSW setup + API mock handlers
```

## Architecture

```
Browser (React SPA)
    │
    ▼
Frontend (Vite dev server, port 5173)
    │  HTTP requests to VITE_API_URL
    ▼
Backend (FastAPI, port 8000)
    │
    ├── Routes ──► Services ──► SQLAlchemy Models ──► PostgreSQL
    │                  │
    │                  └── Auto-captures financial history changes
    │
    └── /uploads (static file serving for profile photos)
```

## Backend

### API Routes

All routes are prefixed with `/api`. The backend also serves a `/health` endpoint and static files from `/uploads`.

| Router | Prefix | Key Endpoints |
|---|---|---|
| Members | `/api/members` | `GET /` `POST /` `GET /{uuid}` `PUT /{uuid}` `DELETE /{uuid}` `POST /{uuid}/image` |
| History | `/api/members/{uuid}/history` | `GET /` — filter by field name (salary, bonus, pto_used) |
| Areas | `/api/areas` | `GET /` `POST /` `PUT /{id}` `DELETE /{id}` `GET /{id}/tree` |
| Teams | `/api/areas/{area_id}/teams` | `GET /` `POST /` `PUT /{id}` `DELETE /{id}` `POST /{id}/members` `DELETE /{id}/members/{uuid}` |
| Programs | `/api/programs` | `GET /` `POST /` `PUT /{id}` `DELETE /{id}` `GET /{id}/tree` `GET /{id}/members` `POST /{id}/assignments` `DELETE /{id}/assignments/{uuid}` |
| Org | `/api/org` | `GET /tree` `PUT /members/{uuid}/supervisor` |
| Import | `/api/import` | `POST /upload` `POST /google-sheets` `POST /preview` `POST /commit` |

### Service Layer

The service layer (`app/services/`) contains all business logic, separated from the route handlers:

- **Domain Services**: `member_service`, `team_service`, `area_service`, `program_service`, `org_service`, `history_service`, `image_service`, `tree_service`
- **Import Pipeline**: `import_parser`, `import_session`, `import_mapper`, `import_commit`, `import_sheets`

Key behaviors:
- Financial field changes (salary, bonus, PTO) are automatically recorded to `member_history`
- Supervisor reassignment validates against circular references
- Import sessions are stored in-memory with a 30-minute TTL and automatic cleanup

### Database Models

6 tables managed by SQLAlchemy 2.0 ORM:

| Model | Table | Description |
|---|---|---|
| `TeamMember` | `team_members` | UUID primary key, self-referential `supervisor_id`, belongs to area + optional team |
| `FunctionalArea` | `functional_areas` | Organizational grouping |
| `Team` | `teams` | Belongs to area, optional `lead_id` FK to member |
| `Program` | `programs` | Cross-cutting initiative |
| `ProgramAssignment` | `program_assignments` | Many-to-many: members ↔ programs |
| `MemberHistory` | `member_history` | Timestamped financial field change log |

## Frontend

### Pages

| Route | Page | Description |
|---|---|---|
| `/members` | MembersPage | Card/table toggle view, filter by area, team, program |
| `/programs` | ProgramsPage | Program CRUD with member assignment |
| `/functional-areas` | FunctionalAreasPage | Functional area management |
| `/teams` | TeamsPage | Team management with member assignment |
| `/tree/org` | OrgTreePage | Interactive org chart — drag to reassign supervisors |
| `/tree/programs` | ProgramTreePage | Program selector (pick a program to view) |
| `/tree/programs/:id` | ProgramTreePage | Program hierarchy tree |
| `/tree/areas` | AreaTreePage | Area selector (pick an area to view) |
| `/tree/areas/:id` | AreaTreePage | Functional area hierarchy tree |
| `/import` | ImportPage | 4-step data import wizard |

### Component Architecture

Components are organized by domain under `src/components/`:

- **Layout**: `AppLayout` (sidebar navigation), `PageHeader`
- **Domain**: `members/`, `programs/`, `functional-areas/`, `teams/`, `import/`
- **Trees**: Custom React Flow nodes (`MemberNode`, `TeamNode`, `AreaNode`, `ProgramNode`) with dagre auto-layout
- **Shared**: `DataTable`, `ConfirmDialog`, `ImageUpload`, `SearchFilterBar`, `PageError`
- **UI**: shadcn/ui primitives (Button, Dialog, Select, Tabs, etc.)

### State Management

- **TanStack Query v5** is the single source of truth — no global state store
- All data-fetching hooks are in `src/hooks/` (`useMembers`, `usePrograms`, `useTrees`, etc.)
- Mutations invalidate relevant query caches automatically
- All updates use `PUT` (full replacement), not `PATCH`

## Data Import

The import wizard supports bulk member creation/update from three sources:

| Format | Max Size | Endpoint |
|---|---|---|
| CSV | 10 MB | `POST /api/import/upload` |
| Excel (.xlsx) | 10 MB | `POST /api/import/upload` |
| Google Sheets | — | `POST /api/import/google-sheets` |

### Import Pipeline

```
Step 1: Upload / Connect
  └─► import_parser (CSV/XLSX) or import_sheets (Google Sheets)
  └─► ParseResult: headers, preview rows, raw data
  └─► import_session: stores data with UUID key (30-min TTL)

Step 2: Map Columns
  └─► Client sends column mapping configuration

Step 3: Preview
  └─► POST /api/import/preview
  └─► import_mapper validates + transforms, returns up to 50 preview rows

Step 4: Commit
  └─► POST /api/import/commit
  └─► import_commit: two-pass upsert
      ├── Pass 1: Create/update all members (auto-create areas, teams, programs)
      └── Pass 2: Set supervisor relationships (with circular reference detection)
  └─► Returns: created / updated / skipped counts
```

## Development

### Makefile Commands

| Command | Description |
|---|---|
| **Lifecycle** | |
| `make up` | Start all services in the background |
| `make down` | Stop all services |
| `make logs` | Tail logs from all services |
| **Per-Service Start** | |
| `make up-backend` | Start only the backend service |
| `make up-frontend` | Start only the frontend service |
| `make up-db` | Start only the database service |
| **Rebuild** | |
| `make rebuild` | Rebuild and start all services |
| `make rebuild-backend` | Rebuild and start backend only |
| `make rebuild-frontend` | Rebuild and start frontend only |
| `make rebuild-db` | Rebuild and start database only |
| **Reload** | |
| `make reload` | Restart backend and frontend containers |
| `make reload-backend` | Restart backend container only |
| `make reload-frontend` | Restart frontend container only |
| **Database** | |
| `make migrate` | Run pending Alembic migrations |
| `make migration name="description"` | Generate a new Alembic migration |
| `make seed` | Seed the database with sample data |
| `make shell-db` | Open a psql shell to the database |
| `make reset-db` | Drop and recreate the database, then run migrations |
| **Code Quality** | |
| `make test` | Run backend test suite (pytest) |
| `make lint` | Run ruff linter on backend code |
| `make format` | Run ruff formatter on backend code |
| `make typecheck` | Run mypy type checker on backend code |

### Hot Reload

Both the backend and frontend support hot reload in development:

- **Backend**: The `./backend` directory is volume-mounted into the container. Uvicorn runs with `--reload`, so any Python file change triggers an automatic restart.
- **Frontend**: Vite's HMR (Hot Module Replacement) is active by default. Changes to React components update instantly in the browser.

### Frontend Development Commands

If running frontend tooling outside Docker:

```bash
cd frontend
npm install
npm run dev          # Start Vite dev server
npm run build        # TypeScript compile + production build
npm run lint         # Run ESLint
npm run preview      # Preview production build locally
```

## Testing

### Backend Tests (108 tests)

```bash
# Run all backend tests
make test

# Run with verbose output
docker compose exec backend pytest -v

# Run a specific test file
docker compose exec backend pytest tests/integration/test_members.py -v
```

**Test architecture**:
- SQLite in-memory database (via `aiosqlite`) for fast, isolated tests
- HTTPX `AsyncClient` with `ASGITransport` for integration tests
- `pytest-asyncio` with `asyncio_mode = "auto"`
- Fixture CSV/XLSX files for import pipeline testing

Test structure:
- `backend/tests/conftest.py` — async DB engine, per-test session, `AsyncClient`, helper fixtures
- `backend/tests/integration/` — 11 test files covering all routes + tree service + import commit
- `backend/tests/unit/` — 3 test files for stateless import pipeline components

### Frontend Tests (111 tests)

```bash
# Run all frontend tests
cd frontend && npm run test

# Run with coverage report
npm run test:coverage

# Run in watch mode (during development)
npx vitest
```

**Test architecture**:
- Vitest 2.1 with jsdom environment
- MSW v2 for API mocking (`src/test/msw/handlers.ts`)
- `@testing-library/react` + `@testing-library/user-event`
- `@testing-library/jest-dom` for DOM assertions
- Coverage threshold: 70% lines/functions on `src/lib/` and `src/hooks/`

## Environment Variables

Create a `.env` file from the template:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `POSTGRES_USER` | PostgreSQL username | `resourcer` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `secretpassword` |
| `POSTGRES_DB` | Database name | `team_resourcer` |
| `POSTGRES_HOST` | Database host (use `db` for Docker) | `db` |
| `POSTGRES_PORT` | Database port | `5432` |
| `DATABASE_URL` | Full async connection string | `postgresql+asyncpg://resourcer:secretpassword@db:5432/team_resourcer` |
| `UPLOAD_DIR` | Directory for uploaded files | `/app/uploads` |
| `BACKEND_HOST` | Backend bind address | `0.0.0.0` |
| `BACKEND_PORT` | Backend port | `8000` |
| `VITE_API_URL` | Backend URL for the frontend | `http://localhost:8000` |

### Google Sheets Integration (Optional)

To enable Google Sheets import, configure one of these:

| Variable | Description |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Path to a Google service account JSON key file |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Base64-encoded service account JSON (alternative to file) |

**Setup steps**:

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google Sheets API**
3. Create a **Service Account** and download the JSON key file
4. Share your Google Sheet with the service account email address (as Viewer)
5. Set the environment variable:

```bash
# Option A: Mount the key file (recommended for local dev)
# Set in your .env or shell:
export GOOGLE_SERVICE_ACCOUNT_FILE=/path/to/service-account.json

# Option B: Base64-encode the JSON
export GOOGLE_SERVICE_ACCOUNT_JSON=$(base64 < service-account.json)
```

If neither variable is set, the Google Sheets import endpoint returns a `422` error with setup instructions.

## Database

### Schema

The database contains 6 tables:

- `team_members` — Team members with UUID PK, self-referential supervisor FK
- `functional_areas` — Organizational groupings
- `teams` — Teams within functional areas, optional team lead
- `programs` — Cross-cutting programs/initiatives
- `program_assignments` — Many-to-many linking members to programs
- `member_history` — Timestamped log of salary, bonus, and PTO changes

### Management Commands

```bash
# Run pending migrations
make migrate

# Generate a new migration after model changes
make migration name="add_new_field"

# Seed with sample data
make seed

# Open a psql shell
make shell-db
```

### Direct Database Access

The PostgreSQL instance is exposed on port `5432`:

```bash
# Via make command
make shell-db

# Or directly (using your .env credentials)
psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB
```

## License

<!-- Add license here -->
