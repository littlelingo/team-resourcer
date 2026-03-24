---
name: project_state
description: Current scaffolding and phase completion status of team-resourcer
type: project
---

As of 2026-03-23, the team-resourcer repo has a fully scaffolded frontend and backend. Source files exist under `frontend/src/` and `backend/app/`. The codebase is feature-complete for the initial four phases but has zero test coverage (no test files, no test tooling installed on the frontend, no tests directory on the backend despite pytest being installed).

**Why:** The project was designed-first (PRPs written before scaffolding), and test coverage was deferred. A test coverage initiative (feature 002) is now underway with separate frontend and backend PRPs.

**Backend test PRP written 2026-03-23** at `.context/features/002-test-coverage/PRP-backend.md`. Key decisions: aiosqlite in-memory SQLite (not test Postgres), `asyncio_mode = "auto"` means no `@pytest.mark.asyncio` decorator needed, `AsyncClient(transport=ASGITransport(app=app))` not `TestClient`, and `commit_import` test isolation uses unique employee_id prefixes rather than rollback (service commits internally).

**How to apply:** When writing PRPs, read live source files rather than relying on planned-only descriptions. The frontend uses React 19, TanStack Query v5 (object syntax), Vite 8, TypeScript 5.9 strict mode, @xyflow/react v12, @dagrejs/dagre v3, and Radix UI primitives. The backend uses FastAPI + SQLAlchemy 2.0 async + asyncpg + Alembic.
