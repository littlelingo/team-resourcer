# PRP: Program Teams — Backend (Phase 1)

## Status: APPROVED

## Testing Strategy: implement-then-test

## Context
Programs need their own team structure independent of the org chart. This phase adds the backend: ProgramTeam model, migration, CRUD service, and REST API endpoints nested under `/api/programs/{id}/teams/`.

## Steps (Phase 1 — Backend Only)

- [ ] Step 1: Create `backend/app/models/program_team.py` — ProgramTeam model (mirrors Team)
- [ ] Step 2: Add `program_team_id` FK to `backend/app/models/program_assignment.py`
- [ ] Step 3: Add `teams` relationship to `backend/app/models/program.py`
- [ ] Step 4: Register model in `backend/app/models/__init__.py`
- [ ] Step 5: Generate and apply migration (`make migration name="add_program_teams" && make migrate`)
- [ ] Step 6: Create `backend/app/schemas/program_team.py` — Create, Update, Response, ListResponse
- [ ] Step 7: Create `backend/app/services/program_team_service.py` — CRUD + member management
- [ ] Step 8: Create `backend/app/api/routes/program_teams.py` — REST endpoints
- [ ] Step 9: Mount router in `backend/app/api/routes/programs.py`
- [ ] Step 10: Register schemas in `backend/app/schemas/__init__.py`

## Key Design Decisions
- `program_team_id` is nullable on `program_assignments` — existing data stays valid
- `add_member_to_program_team` auto-creates ProgramAssignment if member isn't assigned to program yet
- `remove_member_from_program_team` sets `program_team_id = None` (keeps program assignment)
- `lead_id` uses `use_alter=True` to break circular FK (same pattern as Team model)

## Verification
- [ ] Migration applies cleanly
- [ ] All existing tests pass
- [ ] Manual API testing: create team, list teams, add/remove members

## Phase 2 (separate PRP)
Frontend UI + tree visualization updates
