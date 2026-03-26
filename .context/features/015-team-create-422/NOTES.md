# Research: Team Creation 422 Error

## Bug
Creating a new team returns `422 Unprocessable Entity` from `POST /api/areas/{id}/teams/`.

## Root Cause
**`backend/app/schemas/team.py:14`** — `functional_area_id: int` is required with no default. The frontend correctly omits it (the route handler injects it from the URL path at `teams.py:57`), but Pydantic rejects the body before the handler runs.

`lead_id` is NOT the problem — it's already `UUID | None = None` (optional) and the frontend correctly converts empty string to `undefined` which is dropped from JSON.

## Fix
**Option C (cleanest):** Remove `functional_area_id` from `TeamCreate` entirely. The route handler already has `area_id` from the path and can inject it directly when constructing the ORM object. This makes the schema accurately reflect what the client provides.

## Other Forms
`ProgramCreate` and `FunctionalAreaCreate` do not have this issue — no required FK fields.
