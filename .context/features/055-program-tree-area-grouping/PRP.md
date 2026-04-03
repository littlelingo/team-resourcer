# PRP: Program Teams — Backend (Phase 1)

## Status: COMPLETE

## Testing Strategy: implement-then-test

## Context
Programs need their own team structure independent of the org chart. This phase adds the backend: ProgramTeam model, migration, CRUD service, and REST API endpoints nested under `/api/programs/{id}/teams/`.

## Steps (Phase 1 — Backend Only)

- [x] Step 1: Create `backend/app/models/program_team.py` — ProgramTeam model (mirrors Team)
- [x] Step 2: Add `program_team_id` FK to `backend/app/models/program_assignment.py`
- [x] Step 3: Add `teams` relationship to `backend/app/models/program.py`
- [x] Step 4: Register model in `backend/app/models/__init__.py`
- [x] Step 5: Generate and apply migration (`make migration name="add_program_teams" && make migrate`)
- [x] Step 6: Create `backend/app/schemas/program_team.py` — Create, Update, Response, ListResponse
- [x] Step 7: Create `backend/app/services/program_team_service.py` — CRUD + member management
- [x] Step 8: Create `backend/app/api/routes/program_teams.py` — REST endpoints
- [x] Step 9: Mount router in `backend/app/api/routes/programs.py`
- [x] Step 10: Register schemas in `backend/app/schemas/__init__.py`

## Key Design Decisions
- `program_team_id` is nullable on `program_assignments` — existing data stays valid
- `add_member_to_program_team` auto-creates ProgramAssignment if member isn't assigned to program yet
- `remove_member_from_program_team` sets `program_team_id = None` (keeps program assignment)
- `lead_id` uses `use_alter=True` to break circular FK (same pattern as Team model)

## Verification
- [x] Migration applies cleanly
- [x] All existing tests pass (175 passed)
- [ ] Manual API testing: create team, list teams, add/remove members

## Phase 2 (separate PRP)
Frontend UI + tree visualization updates

## Metrics
- Plan date: 2026-04-03
- Validate date: 2026-04-03
- Elapsed: 0d
- Steps: 10
- Sessions: 1
- Clears: 1
- Errors indexed: 0
- Error index hits: 0
- Learnings: 1 (Alembic migration noise + FK naming)
- Execution mode: single implementer agent + review team
