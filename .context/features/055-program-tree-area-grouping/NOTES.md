# Feature 055: Program Teams — Program-Specific Team Structure

## Goal

Add program-specific teams that allow programs to define their own organizational structure independent of the org chart. Each program can have named teams (e.g., "Frontend Squad", "API Squad") with their own leads, and members assigned to those teams within the program context.

**Tree visualization**: Program → Program Teams → Members (with team leads shown on team nodes)

## Current State

### What exists
- `Program` model with `assignments` relationship (many-to-many with members via `program_assignments`)
- `ProgramAssignment` has `member_uuid`, `program_id`, `role` (free-text, nullable)
- No concept of sub-teams within a program
- Program tree is a flat star: program → all members directly

### What's needed
- New `program_teams` table: id, program_id, name, description, lead_id
- `program_team_id` FK on `program_assignments` to assign members to program teams
- Full CRUD for program teams (nested under `/api/programs/{id}/teams/`)
- Frontend management UI (form dialog, list, members sheet)
- Updated tree visualization: Program → Program Teams → Members

## Data Model

### New table: `program_teams`
```
program_teams
├── id: int (PK, autoincrement)
├── program_id: int (FK → programs.id, NOT NULL)
├── name: str (VARCHAR 255, NOT NULL)
├── description: str | None (TEXT)
├── lead_id: UUID | None (FK → team_members.uuid, use_alter=True)
├── created_at: datetime
└── updated_at: datetime
```

### Modified table: `program_assignments`
```
+ program_team_id: int | None (FK → program_teams.id, nullable)
```

This keeps the existing `program_assignments` table but adds an optional link to a program team. Members can be assigned to a program without being on a specific team (unassigned group).

## Implementation Scope

### Backend (high — ~8 new/modified files)

| File | Change |
|------|--------|
| `backend/app/models/program_team.py` | **NEW** — ProgramTeam model |
| `backend/app/models/program_assignment.py` | Add `program_team_id` FK + relationship |
| `backend/app/models/__init__.py` | Register ProgramTeam model |
| `backend/alembic/versions/xxx_add_program_teams.py` | **NEW** — migration |
| `backend/app/schemas/program_team.py` | **NEW** — Create, Update, Response schemas |
| `backend/app/services/program_team_service.py` | **NEW** — CRUD + member management |
| `backend/app/api/routes/program_teams.py` | **NEW** — REST endpoints |
| `backend/app/api/routes/programs.py` | Mount program_teams router |
| `backend/app/services/tree_service.py` | Rewrite `build_program_tree` for grouped hierarchy |

### Frontend (high — ~6 new/modified files)

| File | Change |
|------|--------|
| `frontend/src/types/index.ts` | Add `ProgramTeam` interface |
| `frontend/src/hooks/useProgramTeams.ts` | **NEW** — CRUD hooks |
| `frontend/src/components/programs/ProgramTeamFormDialog.tsx` | **NEW** — create/edit dialog |
| `frontend/src/pages/ProgramsPage.tsx` | Add program teams management (sheet or sub-tab) |
| `frontend/src/pages/trees/ProgramTreePage.tsx` | Register team node type, update nodeTypes |
| `frontend/src/components/trees/nodes/AreaNode.tsx` | Add target handle for mid-level usage (or create ProgramTeamNode) |

## Patterns to Follow

- **Model**: Mirror `backend/app/models/team.py` — `lead_id` with `use_alter=True`, relationships
- **Schema**: Mirror `backend/app/schemas/team.py` — no `program_id` in Create (injected from path)
- **Service**: Mirror `backend/app/services/team_service.py` — selectinload, member_count pattern
- **Routes**: Mirror `backend/app/api/routes/teams.py` — nested under program, CRUD + member management
- **Nesting**: Mirror `backend/app/api/routes/areas.py` line 27 — include_router with prefix
- **Migration**: `make migration name="add_program_teams"` → `make migrate`
- **Frontend hooks**: Mirror `frontend/src/hooks/useTeams.ts` — query keys, mutations, invalidation

## Risks

- **MissingGreenlet**: All service functions returning ProgramTeamResponse must selectinload relationships
- **Circular FK**: `lead_id → team_members.uuid` needs `use_alter=True` (same as Team model)
- **Migration ordering**: New table + FK on existing table in same migration — alembic autogenerate handles this but verify
- **program_team_id nullable**: Existing program assignments have no team — the FK must be nullable to avoid breaking existing data
- **Scope creep**: This is the biggest feature yet (~14 files). Consider splitting into two PRPs: (1) backend model/CRUD, (2) frontend UI + tree visualization

## Decisions

1. **Split into phases**: Phase 1 = backend (model, migration, CRUD, routes). Phase 2 = frontend (UI, tree visualization).
2. **UI placement**: Two surfaces:
   - **Programs page** — program data, members, program team associations
   - **Program Trees page** — visual tree: Program → Program Teams → Members
   - **Teams page** — program teams could be managed here alongside functional teams with clear visual delineation (e.g., "Functional Teams" section + "Program Teams" section)
3. **Member assignment flow**: Members do NOT need prior program assignment. Adding a member to a program team auto-creates their program assignment.
4. **Tree node type**: TBD — reuse AreaNode or create ProgramTeamNode (Phase 2 decision)

## Open Questions

1. **Teams page layout**: How exactly to delineate functional vs program teams (tabs? sections? filter?)
2. **Program team lead**: Can a program team lead be anyone, or only a program member?

## Dependencies

- Feature 054 (team-lead-badge) — EntityMembersSheet `leadId` prop pattern to reuse
- Feature 053 (tree-lead-on-team-node) — tree lead display pattern to reuse
