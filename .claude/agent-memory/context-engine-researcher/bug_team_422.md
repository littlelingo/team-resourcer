---
name: Team creation 422 bug
description: Root cause of 422 on POST /api/areas/{id}/teams/ — functional_area_id required in TeamCreate schema but never sent by the frontend form; bug confirmed still open as of 2026-03-30
type: project
---

Frontend `TeamFormDialog.tsx` `onSubmit` (lines 81–85) builds payload `{ name, description, lead_id }` — it intentionally omits `functional_area_id` because `useCreateTeam` already encodes the area ID in the POST URL (`/api/areas/${areaId}/teams/`). The route handler at `teams.py:58` does `data.model_copy(update={"functional_area_id": area_id})`, intending to inject it from the path. However, **`TeamCreate` at `schemas/team.py:14` declares `functional_area_id: int` with no default**, so Pydantic rejects the request body with 422 before the handler ever runs.

Feature 015 is still in "researched" status — the bug has NOT been fixed.

**Frontend payload (what is actually sent):**
- `name: string`
- `description?: string`
- `lead_id?: string` (empty string converted to undefined via `|| undefined`, dropped by JSON.stringify)

No `functional_area_id` is sent. `TeamFormInput` type in `frontend/src/types/index.ts:153` also omits it.

**Why:** The route handler pattern (override FK from URL after parse) is sound, but requires the schema field to have a default so Pydantic accepts the incoming body before the handler can inject the value.

**Fix options (from feature 015 NOTES.md):**
1. (Backend, cleanest — Option C) Remove `functional_area_id` from `TeamCreate` entirely. The route handler already has `area_id` from the path and can inject it directly when calling the service. Schema then accurately reflects what the client provides.
2. (Backend) Give `functional_area_id` a sentinel default in `TeamCreate` — e.g. `functional_area_id: int = 0` — so Pydantic accepts the body; route then overwrites from path.
3. (Frontend) Include `functional_area_id` in the payload (the form already captures it via `functional_area_id` field in the Zod schema and `FormValues`).

**Other entity forms — no equivalent bug:**
- `ProgramCreate` (`schemas/program.py:10`): `agency_id: int | None = None` — optional, no issue
- `FunctionalAreaCreate` (`schemas/functional_area.py:8`): only `name` + optional `description`, no FK — no issue
- Programs and areas have no nested-route FK injection pattern

**Key files:**
- `backend/app/schemas/team.py:14` — the broken field declaration
- `backend/app/api/routes/teams.py:50–59` — route handler with model_copy injection
- `frontend/src/components/teams/TeamFormDialog.tsx:80–85` — payload construction (omits functional_area_id)
- `frontend/src/hooks/useTeams.ts:29–41` — useCreateTeam, URL encodes areaId
- `frontend/src/types/index.ts:153–157` — TeamFormInput type (no functional_area_id)
- `.context/features/015-team-create-422/NOTES.md` — feature research
