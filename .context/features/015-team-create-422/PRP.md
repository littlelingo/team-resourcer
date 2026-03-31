# PRP: Fix Team Creation 422 Error

## Status: IMPLEMENTED
## Testing Strategy: implement-then-test

## Context
Creating a team via the frontend returns 422 Unprocessable Entity. `TeamCreate` schema requires `functional_area_id: int` but the frontend correctly omits it (area ID comes from URL path). Pydantic rejects the body before the handler runs.

## Changes Made

### 1. Removed `functional_area_id` from `TeamCreate` schema
**File:** `backend/app/schemas/team.py`

### 2. Updated service to accept `functional_area_id` as separate arg
**File:** `backend/app/services/team_service.py`
```python
async def create_team(db, data: TeamCreate, functional_area_id: int) -> Team:
    team = Team(**data.model_dump(), functional_area_id=functional_area_id)
```

### 3. Updated route handler
**File:** `backend/app/api/routes/teams.py`
```python
return await create_team(db, data, functional_area_id=area_id)
```

### 4. Updated test to match real frontend behavior
**File:** `backend/tests/integration/test_teams_routes.py`
- Removed redundant `functional_area_id` from test payload

## Verification
- All 171 backend tests pass
