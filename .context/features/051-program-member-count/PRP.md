# PRP: Program Member Count Column

## Status: COMPLETE

## Goal
Add a "Members" column to the Programs table showing the count of members associated with each program.

## Testing Strategy: implement-then-test

## Implementation Steps

### Step 1: Backend Schema
**File:** `backend/app/schemas/program.py`
- [x] Add `member_count: int = 0` to `ProgramResponse`

### Step 2: Backend Service
**File:** `backend/app/services/program_service.py`
- [x] Add `selectinload(Program.assignments)` to all 4 functions returning `Program` objects
- [x] Set `program.member_count = len(program.assignments)` before returning

### Step 3: Frontend Type
**File:** `frontend/src/types/index.ts`
- [x] Add `member_count: number` to `Program` interface

### Step 4: Frontend Column
**File:** `frontend/src/components/programs/programColumns.tsx`
- [x] Add "Members" column with `accessorKey: 'member_count'`, sortable

## Verification
- [x] Backend tests pass (175/175)
- [x] Frontend tests pass (135/135)
- [x] Lint: no new errors (pre-existing E402s only)
- [x] Type-check: no new errors (pre-existing mypy issues only)
- [x] Manual: column appears with correct counts
- [x] Code review: APPROVED (0 critical, 2 warnings, 2 suggestions — 1 applied)

## Review Notes
- Warning: dynamic attribute injection (`program.member_count = ...`) uses `# type: ignore`. Consider `@computed_field` if pattern is copied elsewhere.
- Warning: `update_program` double-loads assignments (via `get_program` + re-query). Not a perf concern at scale.
- Applied: `?? 0` fallback on frontend for stale cached responses.
- Noted: `delete_program` transitively loads assignments via `get_program` — minor inefficiency, not introduced by this feature.

## Metrics
- Plan date: 2026-04-02
- Validate date: 2026-04-02
- Elapsed: 0 days
- Steps: 4
- Sessions: 1
- Clears: 0
- Errors added to INDEX: 0
- Error index hits: 1 (MissingGreenlet pattern informed implementation)
- Learnings: 1
