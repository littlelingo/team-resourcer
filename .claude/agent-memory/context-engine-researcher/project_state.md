---
name: project_state
description: Current state of the team-resourcer codebase — stack, structure, and test coverage status
type: project
---

As of 2026-03-23 the project has a full backend and frontend implementation but zero test files.

**Backend (FastAPI + SQLAlchemy async + PostgreSQL):**
- `backend/app/api/routes/` — 7 route files: members, teams, areas, programs, org, history, import_router
- `backend/app/services/` — 13 service files including a multi-stage import pipeline (parser, session, mapper, commit, sheets) and domain services (member, team, area, program, org/supervisor, history, image, tree)
- `backend/app/models/` — 6 models: TeamMember (UUID PK, self-referential supervisor), Team, FunctionalArea, Program, ProgramAssignment, MemberHistory
- `backend/app/schemas/` — 9 schema files
- `backend/tests/` — does NOT exist; no conftest.py, no test files anywhere
- pytest==8.3.4, pytest-asyncio==0.24.0, httpx==0.28.1 are installed; `asyncio_mode = "auto"` is set in pyproject.toml
- Entry point: `backend/app/main.py`; DB config: `backend/app/core/config.py` (pydantic-settings, reads .env)

**Frontend (React 19 + Vite + TanStack Query + React Router):**
- `frontend/src/hooks/` — 5 hooks: useMembers, useTeams, usePrograms, useFunctionalAreas, useTrees
- `frontend/src/components/` — functional-areas, import wizard (4 steps), layout, members, programs, shared, teams, trees (nodes, panels, useDragReassign, useTreeLayout, useTreeSearch)
- `frontend/src/pages/` — 5 main pages + 3 tree pages (OrgTree, AreaTree, ProgramTree)
- `frontend/src/api/importApi.ts`, `frontend/src/lib/api-client.ts`, `frontend/src/lib/member-utils.ts`
- No vitest, no @testing-library, no msw installed; no test script in package.json; vite.config.ts has no test block

**Detailed test gap analysis:** `.context/features/002-test-coverage/NOTES.md`

**Why:** Greenfield project that now has a working implementation but test coverage was deferred.

**How to apply:** When asked about testing, point to the gap analysis at `.context/features/002-test-coverage/NOTES.md`. Backend needs `tests/` dir + conftest.py DB fixture from scratch. Frontend needs vitest + testing-library + msw added to devDependencies and a test block in vite.config.ts.
