---
name: Research: Program-Member Relationship
description: Full audit of the program-member relationship: models, join table, API endpoints, schemas, and frontend hooks/types
type: project
---

## Summary (2026-03-30)

The relationship is a proper many-to-many via `program_assignments` join table.

### Backend Models

- `Program` — `backend/app/models/program.py`: fields id, name, description, agency_id (FK→agencies), created_at, updated_at; relationship `assignments` → ProgramAssignment
- `ProgramAssignment` — `backend/app/models/program_assignment.py`: composite PK (member_uuid, program_id); optional `role: str | None`; relationships → Program and TeamMember
- `TeamMember` — `backend/app/models/team_member.py` line 120: `program_assignments` relationship → ProgramAssignment

### Backend Schemas

- `ProgramListResponse` (program.py line 34): id, name only — used embedded in assignments
- `ProgramResponse` (program.py line 22): full fields including agency nested object
- `ProgramAssignmentCreate` (program_assignment.py line 10): member_uuid, program_id, role?
- `ProgramAssignmentResponse` (program_assignment.py line 16): member_uuid, program_id, role, program: ProgramListResponse
- `TeamMemberListResponse` (team_member.py line 83): NO program_assignments field
- `TeamMemberDetailResponse` (team_member.py line 110, line 136): includes `program_assignments: list[ProgramAssignmentResponse]`
- `MemberFormInput` / `TeamMemberCreate` / `TeamMemberUpdate`: NO program_assignments fields — programs are managed via separate assignment endpoints

### API Endpoints

All in `backend/app/api/routes/programs.py`:
- `GET /api/programs/` → list[ProgramResponse], ordered by name
- `GET /api/programs/{id}` → ProgramResponse
- `POST /api/programs/` → ProgramResponse (201)
- `PUT /api/programs/{id}` → ProgramResponse
- `DELETE /api/programs/{id}` → 204
- `GET /api/programs/{id}/tree` → TreeResponse
- `GET /api/programs/{id}/members` → list[TeamMemberListResponse]
- `POST /api/programs/{id}/assignments` → ProgramAssignmentResponse (201); upserts role if already assigned
- `DELETE /api/programs/{id}/assignments/{member_uuid}` → 204

Member list endpoint (`backend/app/api/routes/members.py` line 29):
- `GET /api/members/?program_id=X` — filters by program via JOIN in member_service.py lines 76–81
- `GET /api/members/{uuid}` — returns TeamMemberDetailResponse which includes program_assignments with eager-loaded program names (member_service.py line 100)

### Frontend Types (`frontend/src/types/index.ts`)

- `ProgramListItem` (line 40): { id, name } — embedded in assignments
- `Program` (line 45): full fields
- `ProgramAssignment` (line 55): { member_uuid, program_id, role, program?: ProgramListItem }
- `ProgramAssignmentFormInput` (line 159): { program_id, role? }
- `TeamMemberList` (line 77): NO program_assignments — matches list response
- `TeamMember extends TeamMemberList` (line 94, line 109): `program_assignments?: ProgramAssignment[]` — only populated on detail fetch

### Frontend Hooks (`frontend/src/hooks/usePrograms.ts`)

- `usePrograms()` — GET /api/programs/; queryKey: programKeys.list()
- `useProgram(id)` — GET /api/programs/{id}; queryKey: programKeys.detail(id)
- `useProgramMembers(id)` — GET /api/programs/{id}/members; queryKey: programKeys.members(id)
- `useCreateProgram()`, `useUpdateProgram()`, `useDeleteProgram()` — standard mutations
- NO hooks for assign/unassign member yet

### Frontend Components

- `MemberDetailSheet.tsx` line 185–200: renders program badges from `member.program_assignments` (detail fetch — works correctly)
- `MemberCard.tsx` line 10–12: locally widens prop type to include `program_assignments?`; line 102–108: renders program badges
- `memberColumns.tsx` line 13–17: locally extends type for program_assignments in table column
- `MembersPage.tsx`: uses `usePrograms()` for the filter dropdown (line 81), passes `program_id` as query param; MemberCard receives list data cast with `as` — program badges are ALWAYS EMPTY on card view because list response never includes program_assignments
- `MemberFormDialog.tsx`: NO program fields — program assignment is managed separately, not through the member create/update form

### Known Gap

**MemberCard program badges never populate in card view**: `list_members` service only selectinloads functional_area, team, supervisor, functional_manager — NOT program_assignments. `TeamMemberListResponse` has no `program_assignments` field. The frontend casts `TeamMemberList` to include `program_assignments?` but that field is always undefined at runtime on the list endpoint. Program badges only appear in the detail sheet (which uses the detail endpoint) and in the table columns column (same gap applies there). To fix: either add program_assignments to the list response with eager loading, or accept that badges only appear in the detail sheet.

**Why:** No assign/unassign mutation hooks exist on the frontend — the POST/DELETE assignment endpoints exist on the backend but there are no `useAssignMember` / `useUnassignMember` hooks in usePrograms.ts or anywhere.
