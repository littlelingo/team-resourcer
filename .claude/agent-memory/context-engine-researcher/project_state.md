---
name: project_state
description: Current state of the team-resourcer repo — fully built with 4 feature phases and complete test suite
type: project
---

As of 2026-03-24 the repo is a fully implemented, tested full-stack application. All 4 feature phases and both test coverage phases are COMPLETE.

**Backend (FastAPI + SQLAlchemy async + PostgreSQL):**
- `backend/app/api/routes/` — 7 route files: members, teams, areas, programs, org, history, import_router
- `backend/app/services/` — 14 service files including multi-stage import pipeline (parser, session, mapper, commit, sheets) and domain services (member, team, area, program, org/supervisor, history, image, tree)
- `backend/app/models/` — 6 models: TeamMember (UUID PK, self-referential supervisor), Team, FunctionalArea, Program, ProgramAssignment, MemberHistory
- `backend/app/schemas/` — 9 schema files
- `backend/tests/` — 108 tests in integration/ (route tests per router + tree_service + import_commit) and unit/ (import_mapper, import_parser, import_session); conftest.py uses SQLite in-memory via aiosqlite
- Entry point: `backend/app/main.py`; DB config: `backend/app/core/config.py` (pydantic-settings, reads .env)

**Frontend (React 19 + Vite + TanStack Query + React Router):**
- `frontend/src/hooks/` — 5 hooks: useMembers, useTeams, usePrograms, useFunctionalAreas, useTrees (each has a __tests__ file)
- `frontend/src/components/` — functional-areas, import wizard (4 steps), layout, members, programs, shared, teams, trees (nodes, panels)
- `frontend/src/pages/` — 5 main pages + 3 tree pages
- 111 frontend tests using Vitest + MSW + Testing Library; setup in `frontend/src/test/setup.ts`, handlers in `frontend/src/test/msw/`

**Docker:** 3-service docker-compose.yml (db/backend/frontend), Makefile with all dev commands
**Migrations:** Single Alembic migration: `452ccece7038_initial_schema.py`
**Seed:** `python -m app.seed` via `make seed`

**Why:** Project is complete through Phase 4 and both test coverage passes.

**How to apply:** Treat as a production-ready codebase. When asked about testing, backend tests use SQLite in-memory, not a live DB. Frontend tests use MSW for API mocking.
