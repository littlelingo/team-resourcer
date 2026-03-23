---
name: phase1_scaffold_progress
description: Phase 1 PRP implementation progress — which steps are done and what was created
type: project
---

Steps 1-9 of PRP-phase1.md are complete as of 2026-03-22. All Phase 1 steps are done.

**Why:** Greenfield project bootstrap for team-resourcer, a FastAPI + PostgreSQL + React/Vite team management app.

**How to apply:** Phase 1 is fully complete. The database has seed data (2 areas, 2 teams, 3 members, 2 programs, assignments, supervisor, team leads). Step 4 (migration) was never checked off but the alembic infrastructure was in place — migration was generated and applied as a prerequisite for Step 9 validation.

Key structural decisions made:
- `Team.lead_id` uses `use_alter=True` on the FK to break the circular dependency with `team_members`
- `TeamMember.led_team` relationship uses `foreign_keys="Team.lead_id"` string reference (not list) to avoid circular import issues at definition time
- `app/main.py` wraps router imports in try/except so the app boots even with stub route files
- StaticFiles mount at `/uploads` requires the directory to exist at startup — handled via lifespan `os.makedirs`
- Alembic `env.py` replaces `asyncpg` with `psycopg2` in the URL for the sync migration runner

Step 6 service layer notes:
- All services in `backend/app/services/` use SQLAlchemy 2.0 async patterns (select + scalars/scalar_one_or_none)
- `create_member` uses `model_dump()` to unpack `TeamMemberCreate` directly into `TeamMember(**data.model_dump())`
- `update_member` uses `model_dump(exclude_none=True)` to skip unset fields
- `org_service.get_org_tree` loads all members with `selectinload(direct_reports)` and builds the tree in Python (avoids recursive SQL CTE complexity)
- `org_service._check_no_cycle` walks supervisor chain iteratively via individual async queries to detect circular references before committing
- `image_service.save_profile_image` uses `aiofiles` for async file writes; validates content type and enforces 5 MB size limit by reading in chunks
- `program_service.assign_member` is a true upsert: fetches existing assignment first, updates role if found, creates new if not
