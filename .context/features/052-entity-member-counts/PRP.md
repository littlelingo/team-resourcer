# PRP: Member Count Columns for Agencies, Functional Areas, and Teams

## Status: APPROVED

## Testing Strategy: implement-then-test

## Context
Feature 051 added a "Members" count column to Programs. Apply the same pattern to the other three entity types.

## Steps

### Group A: Functional Areas
- A1: Add `member_count: int = 0` to `FunctionalAreaResponse` and `FunctionalAreaListResponse`
- A2: Add `selectinload(FunctionalArea.members)` to all 4 CRUD functions in area_service.py
- A3: Add `member_count: number` to `FunctionalArea` TS interface
- A4: Add Members column to functionalAreaColumns.tsx

### Group B: Teams
- B1: Add `member_count: int = 0` to `TeamResponse` only (not TeamListResponse)
- B2: Add `selectinload(Team.members)` to list_teams and get_team (create/update delegate to get_team)
- B3: Add `member_count: number` to `Team` TS interface
- B4: Add Members column to teamColumns.tsx

### Group C: Agencies
- C1: Add `member_count: int = 0` to `AgencyResponse` and `AgencyListResponse`
- C2: Add two-level `selectinload(Agency.programs).selectinload(Program.assignments)` to all 4 CRUD functions; deduplicate count
- C3: Add `member_count: number` to `Agency` TS interface
- C4: Add Members column to agencyColumns.tsx

## Verification
- [ ] Backend tests pass
- [ ] Frontend tests pass
- [ ] Manual: columns appear on all 3 pages
