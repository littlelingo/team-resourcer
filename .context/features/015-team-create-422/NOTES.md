# Research: Team Creation 422 Error

## Bug
Creating a new team returns `422 Unprocessable Entity` from `POST /api/areas/{id}/teams/`.

## Root Cause
**`backend/app/schemas/team.py:14`** — `functional_area_id: int` is required with no default. The frontend correctly omits it (the route handler injects it from the URL path at `teams.py:57`), but Pydantic rejects the body before the handler runs.

### Request Flow
1. Frontend form captures `name`, `description`, `lead_id` — intentionally omits `functional_area_id`
2. `useCreateTeam(areaId)` POSTs to `/api/areas/${areaId}/teams/` with body `{ name, description, lead_id }`
3. Pydantic validates the body against `TeamCreate` which requires `functional_area_id: int`
4. **Pydantic rejects the body → 422 before handler executes**
5. Route handler's `data.model_copy(update={"functional_area_id": area_id})` at line 58 is never reached

### Payload Mismatch
| Field | Backend `TeamCreate` | Frontend sends |
|-------|---------------------|----------------|
| `name` | `str` (required) | ✓ sent |
| `description` | `str \| None = None` | ✓ sent (optional) |
| `lead_id` | `UUID \| None = None` | ✓ sent as string or omitted |
| `functional_area_id` | `int` **(required)** | **✗ NOT sent — 422** |

`lead_id` is NOT the problem — it's already `UUID | None = None` (optional) and the frontend correctly converts empty string to `undefined` which is dropped from JSON.

## Fix
**Option C (cleanest, recommended):** Remove `functional_area_id` from `TeamCreate` entirely. The route handler already has `area_id` from the path and passes it directly to the service layer — the field in the schema serves no purpose and actively breaks things.

**Option B:** Change to `functional_area_id: int = 0` — Pydantic accepts body, route overwrites from path. Misleading but functional.

**Option A:** Frontend sends the field in the payload. Redundant with URL. Least preferred.

## Scope — Is This Broader?
**No.** Only teams use the nested-route-with-path-param-injection pattern:
- `ProgramCreate` — `agency_id: int | None = None` (optional, no risk)
- `FunctionalAreaCreate` — only `name` + optional `description`, no FK
- `MemberCreate` — no nested route with FK injection

The bug is isolated to team creation.
