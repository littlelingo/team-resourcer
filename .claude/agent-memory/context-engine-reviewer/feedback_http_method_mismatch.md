---
name: HTTP Method Mismatch — PUT vs PATCH
description: Backend update routes use PUT but all frontend hooks use PATCH
type: feedback
---

All four backend routers (`members.py`, `programs.py`, `areas.py`, `teams.py`) define update routes with `@router.put(...)`, but every frontend hook (`useUpdateMember`, `useUpdateProgram`, `useUpdateFunctionalArea`, `useUpdateTeam`) sends `method: "PATCH"`.

**Why:** FastAPI will return 405 Method Not Allowed for PATCH requests to PUT-only routes. This will cause all edit operations to silently fail with a network error toast.

**How to apply:** Whenever reviewing or writing update mutations, check the HTTP verb against the backend route decorator. Flag PATCH vs PUT discrepancies as critical.
