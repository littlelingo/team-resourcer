---
name: Team creation 422 bug
description: Root cause of 422 on POST /api/areas/{id}/teams/ — functional_area_id required in TeamCreate schema but never sent by the frontend form
type: project
---

Frontend `TeamFormDialog.tsx` `onSubmit` (line 81-85) builds a payload of `{ name, description, lead_id }` — it intentionally omits `functional_area_id` because the route is supposed to inject it from the URL path via `model_copy`. However, `TeamCreate` in `backend/app/schemas/team.py` declares `functional_area_id: int` with **no default**, so Pydantic rejects the request body with a 422 before the route handler ever runs.

**Why:** The route handler pattern (override FK from URL after parse) is sound, but requires the schema field to have a default so Pydantic doesn't reject the missing field on ingestion.

**How to apply:** Fix options are:
1. (Backend, preferred) Give `functional_area_id` a sentinel default in `TeamCreate` — e.g. `functional_area_id: int = 0` — so Pydantic accepts the body; the route then overwrites it from the path.
2. (Frontend) Include `functional_area_id: values.functional_area_id` in the payload. This is redundant with the path param but satisfies the schema.
3. (Backend, cleanest) Split `functional_area_id` out of `TeamCreate` entirely and inject it only inside the route handler before constructing the model.

lead_id is correctly optional (UUID | None = None) in the schema and nullable in the DB model. The empty-string-to-undefined conversion in the frontend (`values.lead_id || undefined`) works correctly — JSON.stringify drops undefined keys, so lead_id is absent from the wire payload, which Pydantic maps to None.

The other forms (ProgramFormDialog, FunctionalAreaFormDialog) have no FK fields that could trigger the same pattern.
