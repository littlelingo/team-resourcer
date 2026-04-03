---
name: project_055_program_teams_backend_review
description: 055-program-teams-backend (ProgramTeam model, service, routes, migration, nullable FK on program_assignments): key findings from review on 2026-04-03
type: project
---

Phase 1 backend for program teams reviewed 2026-04-03.

Key fragile areas:

- `add_member_to_program_team` does not validate that the member_uuid exists in team_members before creating a ProgramAssignment — the DB FK will catch it but returns a 500 instead of a 404.
- The `program_team_id` FK on program_assignments has no ON DELETE behaviour declared; the DB default is RESTRICT. Deleting a team with members currently assigned (program_team_id set) will raise a DB error. The service's `delete_program_team` does not null out assignments first.
- The migration's FK for program_assignments.program_team_id uses `None` as the constraint name (op.create_foreign_key(None, ...)) — the downgrade's matching `drop_constraint(None, ...)` is therefore fragile and will fail if Postgres auto-generates a different name.
- `create_program_team` and `update_program_team` accept any UUID for `lead_id` without validating the member exists in the program. The DB FK is deferred but not enforced at the service layer.
- No validation that `name` is non-empty string in ProgramTeamCreate (schema accepts bare `str`).
- No index on `program_assignments.program_team_id` — the FK lookup in `list_program_teams` / delete cascade path will do seq scans on large tables.
- The `ProgramTeamListResponse` schema drops `description`, `lead_id`, `member_count`, `created_at`, `updated_at` — but the list route returns `list[ProgramTeamResponse]`, not `list[ProgramTeamListResponse]`, making the list schema unused/dead code.
- Double DB fetch in update route: route pre-fetches to validate program_id ownership, then service re-fetches to update.
- Migration alters existing constraints on `programs.agency_id` and `teams.lead_id` which are unrelated to the feature — risk of unintended side effects in downgrade.

**Why:** These are deferred-until-frontend-integration issues, but the delete-with-members scenario and the bad 500 on unknown member_uuid are the most likely to surface in manual testing.
**How to apply:** Flag `delete_program_team` cascading gap and member existence check as must-fix before frontend integration.
