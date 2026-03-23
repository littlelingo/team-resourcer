---
name: Phase 1 Architecture Overview
description: Key structural facts about the Phase 1 backend implementation of team-resourcer
type: project
---

FastAPI + SQLAlchemy async backend. Standard 3-layer structure: models → services → routes.

- 6 service files (area, history, image, member, org, program, team)
- 8 schema files with flat `__init__.py` re-exports for both services and schemas
- 6 route files (areas, history, members, org, programs, teams)
- Teams are nested under areas as a sub-router: `GET /api/areas/{area_id}/teams/`

**Why:** Phase 1 is CRUD foundation. No auth, no pagination, no soft-delete.
**How to apply:** Future phases will add auth middleware and pagination — flag anything that blocks that clean extension.
