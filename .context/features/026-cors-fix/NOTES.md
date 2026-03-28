# Research: CORS Blocked Errors (localhost:5173 -> localhost:8000)

## Problem Statement

Frontend at `http://localhost:5173` gets CORS errors calling backend at `http://localhost:8000/api/members/`:
> Access to fetch at 'http://localhost:8000/api/members/' from origin 'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.

## Current State

### Backend CORS Configuration (`backend/app/main.py:33-39`)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)
```

### Settings (`backend/app/core/config.py:16`)

```python
cors_origins: str = "http://localhost:5173,http://localhost:3000"
```

- Default includes `http://localhost:5173` -- so origins should match.
- `CORS_ORIGINS` is **not set** in `.env`, so default applies.

### Frontend API Client (`frontend/src/lib/api-client.ts`)

- Uses `fetch()` with `Content-Type: application/json` for all non-FormData requests (including GETs).
- `VITE_API_BASE_URL=http://localhost:8000` from `frontend/.env.development`.
- No `credentials: 'include'` despite backend `allow_credentials=True`.

## Root Cause Analysis

**Most likely cause: `allow_headers` is too restrictive.**

The `allow_headers` list is `["Content-Type", "Accept"]` only. Any request with additional headers (e.g., `Authorization`, `X-Requested-With`, `Cache-Control`, browser-injected headers) will fail the preflight OPTIONS check. When preflight fails, the browser sees no `Access-Control-Allow-Origin` header and reports exactly the error the user sees.

Additionally, `Content-Type: application/json` on GET requests triggers a CORS preflight (it's not a "simple" content type). The preflight should succeed since `Content-Type` is in the allowed list, but the narrow header list leaves no room for any other headers a browser or extension might add.

**Secondary issue: Env var mismatch in docker-compose.yml**

`docker-compose.yml` sets `VITE_API_URL` but frontend reads `VITE_API_BASE_URL`. This is silently ignored since Vite loads `.env.development` at dev-server startup. Latent breakage risk for production builds.

## Files to Modify

| File | Change |
|------|--------|
| `backend/app/main.py` | Widen `allow_headers` to `["*"]` (or at minimum add common headers) |
| `docker-compose.yml` | Fix env var name from `VITE_API_URL` to `VITE_API_BASE_URL` |

## Risks

- Using `allow_headers=["*"]` is standard for development but should be tightened for production.
- The env var mismatch fix in docker-compose is a separate concern but worth fixing alongside.

## Open Questions

- Is the user running via Docker or natively? (Affects whether docker-compose env var fix matters now)
- Are there any custom headers being sent by browser extensions or other middleware?
