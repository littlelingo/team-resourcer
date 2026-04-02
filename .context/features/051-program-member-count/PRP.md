# PRP: Program Member Count Column

## Status: IMPLEMENTED

## Goal
Add a "Members" column to the Programs table showing the count of members associated with each program.

## Testing Strategy: implement-then-test

## Implementation Steps

### Step 1: Backend Schema
**File:** `backend/app/schemas/program.py`
- Add `member_count: int = 0` to `ProgramResponse`

### Step 2: Backend Service
**File:** `backend/app/services/program_service.py`
- Add `selectinload(Program.assignments)` to all 4 functions returning `Program` objects
- Set `program.member_count = len(program.assignments)` before returning

### Step 3: Frontend Type
**File:** `frontend/src/types/index.ts`
- Add `member_count: number` to `Program` interface

### Step 4: Frontend Column
**File:** `frontend/src/components/programs/programColumns.tsx`
- Add "Members" column with `accessorKey: 'member_count'`, sortable

## Verification
- [x] Backend tests pass (175/175)
- [x] Frontend tests pass (135/135)
- [ ] Manual: verify column appears with correct counts
