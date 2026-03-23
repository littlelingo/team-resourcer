# System Architecture

## Overview

**team-resourcer** — full-stack team resource management application for tracking team members, program assignments, functional areas, and organizational hierarchy.

## Components

### Backend (FastAPI)
- **API Layer** (`app/api/routes/`) — RESTful endpoints, input validation, HTTP error mapping
- **Service Layer** (`app/services/`) — business logic, auto-history capture, circular ref guards
- **Model Layer** (`app/models/`) — SQLAlchemy 2.0 ORM, 6 tables
- **Schema Layer** (`app/schemas/`) — Pydantic v2 request/response validation

### Frontend (React + Vite)
- Shell scaffolded with TypeScript + Tailwind + shadcn/ui dependencies
- Functional UI begins in Phase 2

### Database (PostgreSQL 16)
- 6 domain tables: team_members, functional_areas, teams, programs, program_assignments, member_history
- Managed via Alembic migrations

## Data Flow

```
Client → FastAPI Routes → Service Layer → SQLAlchemy Models → PostgreSQL
                ↑                              ↓
         Pydantic Schemas              Alembic Migrations
```

## Deployment

Docker Compose with 3 services: db (postgres:16-alpine), backend (python:3.12-slim), frontend (node:20-alpine).
