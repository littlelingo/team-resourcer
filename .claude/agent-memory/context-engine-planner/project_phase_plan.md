---
name: team-resourcer phase plan
description: Overview of the four planned phases for the team-resourcer app and key technical decisions made during planning
type: project
---

team-resourcer is a greenfield full-stack app (FastAPI + PostgreSQL + React/shadcn/ui/Tailwind) with four planned phases:
- Phase 1: Docker Compose, PostgreSQL models, FastAPI CRUD, service layer
- Phase 2: React app shell, card view, table views, CRUD forms, TanStack Query
- Phase 3: Interactive tree views (PRP written 2026-03-22) — @xyflow/react v12 + dagre chosen as the tree library
- Phase 4: Google Sheets / CSV import

**Why:** Planning is done before any code exists (repo is greenfield as of 2026-03-22).

**How to apply:** When asked about library choices for tree views, the decision is @xyflow/react v12 with @dagrejs/dagre. When suggesting new features, fit them into the phase structure above.
