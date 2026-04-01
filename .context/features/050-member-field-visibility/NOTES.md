# Research: Member Field Visibility (functional_area, programs, team)

## Problem Statement

When viewing members, three fields are missing from certain views:
1. **Detail card view** — functional area doesn't display even when set
2. **Table view** — neither programs, functional area, nor team columns show data
3. Need to audit: **program**, **functional area**, and **team** visibility across all member views

## Root Cause

**Schema/contract mismatch** between backend list response and frontend expectations.

### Two API response shapes

| Endpoint | Schema | Nested objects? |
|----------|--------|----------------|
| `GET /api/members/` (list) | `TeamMemberListResponse` | NO — only `functional_area_id: int`, `team_id: int` |
| `GET /api/members/{uuid}` (detail) | `TeamMemberDetailResponse` | YES — full `functional_area`, `team`, `program_assignments` |

The backend service (`member_service.py:list_members` lines 55–83) already does `selectinload` for all relationships, but the Pydantic schema strips the nested objects because they aren't declared as fields.

### Impact per view

| View | File | functional_area | team | programs |
|------|------|----------------|------|----------|
| **Card** | `MemberCard.tsx` | Rendered (line 97) — always empty | NOT rendered | Rendered (line 102) — always empty |
| **Table** | `memberColumns.tsx` | Column defined (lines 68–81) — always "—" | Column defined (lines 83–95) — always "—" | Column defined (lines 111–127) — always "—" |
| **Detail sheet** | `MemberDetailSheet.tsx` | ✅ Works (uses detail endpoint) | ✅ Works | ✅ Works |

## Key Files

| File | Role |
|------|------|
| `backend/app/schemas/team_member.py` | `TeamMemberListResponse` (lines 83–99), `TeamMemberDetailResponse` (lines 110–139) |
| `backend/app/services/member_service.py` | `list_members` (lines 55–83) — already eager-loads relationships |
| `frontend/src/types/index.ts` | `TeamMemberList` (lines 77–92), `TeamMember` (lines 94–113) |
| `frontend/src/components/members/MemberCard.tsx` | Card view component |
| `frontend/src/components/members/memberColumns.tsx` | Table column definitions — has local `MemberRow` type (lines 10–18) |
| `frontend/src/components/members/MemberDetailSheet.tsx` | Detail sheet — works correctly |
| `frontend/src/hooks/useMembers.ts` | `useMembers` (list), `useMember` (detail) |
| `frontend/src/pages/MembersPage.tsx` | Already fetches `areas` and `teams` lists (lines 82–83) |

## Fix Options

### Option A — Extend backend list schema (recommended)

Add nested objects to `TeamMemberListResponse`:
- `functional_area: FunctionalAreaListResponse | None`
- `team: TeamListResponse | None`
- `program_assignments: list[ProgramAssignmentResponse]`

The service layer already eager-loads these — only the Pydantic schema needs updating. Also update the frontend `TeamMemberList` type to match.

**Pros**: Single source of truth, no client-side joins, all three fields fixed
**Cons**: Slightly heavier list payload

### Option B — Frontend join (partial fix)

Use existing `areas` and `teams` arrays from `MembersPage` to resolve names from IDs.

**Pros**: No backend change
**Cons**: Cannot fix programs (no `program_assignment` IDs in list response), adds lookup complexity

### Recommendation

**Option A** — extend the list schema. The eager-loads are already happening (wasted work today), and this is the cleanest fix for all three fields.

## Dependencies

- No migration needed — data model is unchanged
- Frontend type (`TeamMemberList`) must be updated to match new response shape
- `MemberCard.tsx` and `memberColumns.tsx` already have rendering code for these fields — they just need data

## Risks

- List payload size increases (but only by names + small nested objects)
- Existing tests for the list endpoint may need schema assertion updates

## Related

- Feature 048: team-assignment-display (error index entry about team assignment)
- Feature 029: functional-manager (added functional_manager fields)
