# PRP: Member Count Columns for Agencies, Functional Areas, and Teams

## Status: COMPLETE

## Testing Strategy: implement-then-test

## Context
Feature 051 added a "Members" count column to Programs. Apply the same pattern to the other three entity types.

## Steps

### Group A: Functional Areas
- [x] A1: Add `member_count: int = 0` to `FunctionalAreaResponse` and `FunctionalAreaListResponse`
- [x] A2: Add `selectinload(FunctionalArea.members)` to all 4 CRUD functions in area_service.py
- [x] A3: Add `member_count: number` to `FunctionalArea` TS interface
- [x] A4: Add Members column to functionalAreaColumns.tsx

### Group B: Teams
- [x] B1: Add `member_count: int = 0` to `TeamResponse` only (not TeamListResponse)
- [x] B2: Add `selectinload(Team.members)` to list_teams and get_team (create/update delegate to get_team)
- [x] B3: Add `member_count: number` to `Team` TS interface
- [x] B4: Add Members column to teamColumns.tsx

### Group C: Agencies
- [x] C1: Add `member_count: int = 0` to `AgencyResponse` and `AgencyListResponse`
- [x] C2: Add two-level `selectinload(Agency.programs).selectinload(Program.assignments)` with dedup helper
- [x] C3: Add `member_count: number` to `Agency` TS interface
- [x] C4: Add Members column to agencyColumns.tsx

## Verification
- [x] Backend tests pass (175/175)
- [x] Frontend tests pass (135/135)
- [x] Lint: no new errors
- [x] Code review: APPROVED (0 critical, 2 warnings, 3 suggestions)
- [x] Manual: columns appear on all 3 pages

## Review Notes
- Warning: redundant `db.refresh` before re-query in area/agency create/update — pre-existing pattern, not a blocker
- Warning: `update_team_route` calls `get_team` 3 times — pre-existing structure amplified by new selectinload
- Agency deduplication verified correct for all edge cases (empty programs, multi-program members, new agencies)
- Embedded schema `= 0` default confirmed safe for FunctionalAreaListResponse in TeamResponse and AgencyListResponse in ProgramResponse
