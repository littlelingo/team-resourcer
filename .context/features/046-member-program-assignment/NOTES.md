# Research: Display & Edit Program Assignments on Member Detail

## Problem

1. Users can't see which program(s) a member is assigned to from the member detail card
2. Users can't assign/unassign a member to/from programs via the edit member form

## Current State

### Backend — Fully Implemented

- **Many-to-many**: `program_assignments` join table (member_uuid, program_id, role)
- **Models**: `ProgramAssignment` in `backend/app/models/program_assignment.py`, relationship on `TeamMember` (line 120-122)
- **Assign endpoint**: `POST /api/programs/{id}/assignments` — upserts, takes `{ member_uuid, role? }`
- **Unassign endpoint**: `DELETE /api/programs/{id}/assignments/{member_uuid}`
- **Member detail**: `GET /api/members/{uuid}` returns `program_assignments` with nested program names (eager-loaded, line 100 of member_service.py)
- **Member list**: `GET /api/members/` does NOT return program_assignments (list schema excludes them)
- **All programs**: `GET /api/programs/` returns list with id, name

### Frontend — Partially Implemented

#### What exists:
- **`usePrograms()` hook** (`frontend/src/hooks/usePrograms.ts`): fetches all programs for dropdown/filter
- **`MemberDetailSheet.tsx` (lines 185-200)**: Already renders program badges from detail fetch data — this WORKS when detail data includes program_assignments
- **Types**: `TeamMember.program_assignments?: ProgramAssignment[]` (line 109), `ProgramAssignment` (line 55), `ProgramAssignmentFormInput` (line 159)
- **`MemberCard.tsx` (lines 102-108)**: Has badge rendering code for program_assignments, but data is always empty (list endpoint doesn't return it)

#### What's missing:
- **No assign/unassign mutation hooks**: Backend endpoints exist but no `useAssignProgram` / `useUnassignProgram` mutations in frontend
- **No program field in edit form**: `useMemberForm.ts` schema has no `program_assignments` field — programs are NOT part of member create/edit
- **No "set program" UI in edit dialog**: `MemberFormDialog.tsx` has no program selector

### Key Architectural Question

Programs are a **many-to-many** relationship (a member can be on multiple programs). This is different from `functional_area_id` which is a simple foreign key (one area per member). Two approaches:

**Option A — Multi-select in edit form**: Add a multi-select dropdown in `MemberFormDialog` for programs. On save, diff current vs selected and call assign/unassign endpoints. More complex but matches user's request of "similar to functional area".

**Option B — Separate assignment UI**: Add assign/unassign buttons on the detail sheet (like a tag manager). Keeps the edit form simple. More clicks but cleaner separation.

## Display on Detail Card

`MemberDetailSheet.tsx` already renders program badges (lines 185-200) when `program_assignments` data is present. The `useMember(uuid)` detail fetch returns this data. **This may already work** — needs verification that the detail sheet is rendering correctly.

## Files to Modify

### For Display (may already work):
| File | Change |
|------|--------|
| `MemberDetailSheet.tsx` | Verify program badges render; fix if needed |
| `MemberDetailPanel.tsx` | Add program badges (tree view doesn't have them) |

### For Edit (new work):
| File | Change |
|------|--------|
| `frontend/src/hooks/usePrograms.ts` | Add `useAssignProgram` and `useUnassignProgram` mutation hooks |
| `frontend/src/components/members/useMemberForm.ts` | Add program_ids field to schema, handle assign/unassign on submit |
| `frontend/src/components/members/MemberFormDialog.tsx` | Add multi-select program dropdown |

## Dependencies

- Backend assign/unassign endpoints already exist and work
- `usePrograms()` hook already fetches all programs for dropdown options
- `ProgramAssignment` and `ProgramAssignmentFormInput` types already defined

## Risks

- Many-to-many diff logic on save: need to compute added/removed programs and call separate endpoints for each
- Form reset: the new `useEffect` reset (feature 045) must include program_ids
- The assign endpoint is on the programs router (`/api/programs/{id}/assignments`), not the members router — mutations need to target the right URL
