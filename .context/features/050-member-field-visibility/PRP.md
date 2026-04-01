# PRP: Fix Member Field Visibility (Feature 050)

## Status: COMPLETE

## Problem
Member list views (card + table) don't display functional_area, team, or programs because `TeamMemberListResponse` only serializes flat IDs. The detail sheet works because `TeamMemberDetailResponse` includes nested objects.

## Testing Strategy: implement-then-test

## Changes Made

### Backend
1. **`backend/app/schemas/team_member.py`** — Added `functional_area`, `team`, `program_assignments` fields to `TeamMemberListResponse`
2. **`backend/app/services/member_service.py`** — Added `program_assignments` eager-load to `list_members()`
3. **`backend/app/services/program_service.py`** — Added `program_assignments` eager-load to `get_program_members()`
4. **`backend/app/schemas/program_assignment.py`** — Made `program` field optional (defensive against integrity gaps at list scale)

### Frontend
5. **`frontend/src/types/index.ts`** — Added optional nested fields to `TeamMemberList` interface
6. **`frontend/src/components/members/MemberCard.tsx`** — Removed inline type extension (now uses `TeamMemberList` directly)
7. **`frontend/src/components/members/memberColumns.tsx`** — Removed `MemberRow` type alias, uses `TeamMemberList` directly

### Tests
8. **`backend/tests/integration/test_members_routes.py`** — Added 2 tests: nested objects in list response, null team handling

## Verification
- 175 backend tests passing (173 existing + 2 new)
- 135 frontend tests passing
- TypeScript: no errors
- Code review: 1 critical fixed, rest assessed as pre-existing/out-of-scope
