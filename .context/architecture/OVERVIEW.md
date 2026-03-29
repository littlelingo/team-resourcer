# System Architecture

## Overview

**team-resourcer** — full-stack team resource management application for tracking team members, program assignments, agencies, functional areas, and organizational hierarchy. Features CSV/XLSX/Google Sheets import with validation, org tree visualization, and financial history tracking.

## Components

### Backend (FastAPI + Python 3.12)
- **API Layer** (`app/api/routes/`) — 7 routers: members, history, areas, teams, programs, agencies, org, import
- **Service Layer** (`app/services/`) — 16 modules: CRUD services, import pipeline (parse → map → validate → commit), image handling, org tree
- **Model Layer** (`app/models/`) — SQLAlchemy 2.0 async ORM, 8 tables
- **Schema Layer** (`app/schemas/`) — Pydantic v2 request/response validation

### Frontend (React 19 + Vite 8)
- **Pages** — Members, Functional Areas, Teams, Programs, Agencies (card/table views)
- **Components** — Form dialogs, data tables, 4-step import wizard, org tree canvas, member detail sheet
- **State** — TanStack Query v5 for server state, React Hook Form + Zod for forms
- **Visualization** — XY Flow + Dagre for org tree layout
- **UI** — Radix UI primitives + Tailwind CSS + shadcn/ui

### Database (PostgreSQL 16)
- 8 tables: team_members, functional_areas, teams, programs, program_assignments, agencies, member_history, alembic_version
- Managed via Alembic migrations
- EAV-style history tracking (field, value, effective_date)

## Data Flow

```
Client → FastAPI Routes → Service Layer → SQLAlchemy Models → PostgreSQL
              ↑                              ↓
       Pydantic Schemas              Alembic Migrations
```

### Import Pipeline
```
CSV/XLSX/Sheets → import_parser → import_mapper → import_commit → DB
                    (raw rows)    (mapped+validated)  (deduped+written)
```

## Deployment

Docker Compose with 3 services:
- `db` — postgres:16.6-alpine
- `backend` — python:3.12-slim, port 8000, hot-reload enabled
- `frontend` — node:20-alpine, port 5173, Vite polling for Docker FS
