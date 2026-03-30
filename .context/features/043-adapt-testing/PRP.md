# PRP: Adapt Testing

## Goal
Add missing tests identified in `/adapt` audit.

## Steps

### Step 1: Add useAgencies hook tests (HIGH)
- File: `frontend/src/hooks/__tests__/useAgencies.test.ts`
- Add MSW handlers for agencies endpoints
- Test: useAgencies fetches, useCreateAgency, useUpdateAgency, useDeleteAgency

### Step 2: Add image upload happy-path integration test (HIGH/MEDIUM)
- File: `backend/tests/integration/test_members_routes.py`
- Test: POST valid PNG to /api/members/{uuid}/image returns 200 + image_path

## Deferred (lower priority)
- import_sheets.py — external integration, needs Google credentials
- import_supervisor.py — covered via test_import_commit.py integration tests
- MemberFormDialog/MemberDetailSheet — component tests (large scope)
- importApi.ts — API function tests

## Testing Strategy
implement-then-test (we are writing the tests themselves).
