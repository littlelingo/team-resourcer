---
name: feature055_program_teams_backend
description: Feature 055 Phase 1 (Program Teams backend) — all 10 steps complete as of 2026-04-03
type: project
---

Feature 055 Phase 1 (backend only) complete as of 2026-04-03. All 10 steps done; 175 tests pass.

**Why:** Programs needed their own team grouping structure, independent of the functional-area org chart.

**How to apply:** The program teams API is live at `/api/programs/{program_id}/teams/`. Phase 2 (frontend) is a separate PRP.

## Files created
- `backend/app/models/program_team.py` — ProgramTeam model (mirrors Team; FK to programs.id; lead_id with use_alter=True)
- `backend/app/schemas/program_team.py` — ProgramTeamCreate, ProgramTeamUpdate, ProgramTeamResponse, ProgramTeamListResponse
- `backend/app/services/program_team_service.py` — CRUD + add/remove member (auto-creates ProgramAssignment on add; sets program_team_id=None on remove)
- `backend/app/api/routes/program_teams.py` — REST endpoints (nested router, program_id from path)
- `backend/alembic/versions/1ead305befa8_add_program_teams.py` — migration (creates program_teams table, adds program_team_id FK to program_assignments)

## Files modified
- `backend/app/models/program_assignment.py` — added nullable program_team_id FK + program_team relationship
- `backend/app/models/program.py` — added teams relationship (back_populates="program")
- `backend/app/models/__init__.py` — registered ProgramTeam
- `backend/app/schemas/__init__.py` — registered all 4 program team schemas
- `backend/app/api/routes/programs.py` — mounted program_teams_router at /{program_id}/teams

## Key design decisions
- program_team_id is nullable on program_assignments — existing assignments unaffected
- add_member_to_program_team auto-creates ProgramAssignment if missing (so you can add anyone, not just pre-assigned members)
- remove_member_from_program_team sets program_team_id=None only (keeps the program assignment alive)
- Program team router is mounted BEFORE the route handlers in programs.py (same pattern as areas.py line 27)
