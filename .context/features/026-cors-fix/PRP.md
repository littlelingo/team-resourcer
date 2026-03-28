# PRP: CORS Fix

## Status: COMPLETE
## Completed: 2026-03-28
## Complexity: LOW
## Testing Strategy: implement-then-test

## Goal

Widen the backend CORS `allow_headers` list and fix a silent env var name mismatch in `docker-compose.yml` so that frontend requests from `localhost:5173` are no longer blocked by preflight failures.

## Background

The backend at `backend/app/main.py:38` restricts `allow_headers` to `["Content-Type", "Accept"]`. Any request that includes additional headers (browser-injected or otherwise) fails the OPTIONS preflight — the browser receives no `Access-Control-Allow-Origin` response header and reports the error. The origins list itself is correct; the default `settings.cors_origins` already includes `http://localhost:5173`.

Separately, `docker-compose.yml` sets `VITE_API_URL` but the frontend reads `VITE_API_BASE_URL`. This causes a silent no-op in the compose environment and would break production builds that rely on compose for env injection.

## Implementation Steps

### Step 1: Widen `allow_headers` in backend CORS middleware [x]

- **File**: `/Users/clint/Workspace/team-resourcer/backend/app/main.py`
- **Change**: On line 38, replace `allow_headers=["Content-Type", "Accept"]` with `allow_headers=["*"]`
- **Validation**: After restarting the backend, send a preflight request manually:
  ```
  curl -i -X OPTIONS http://localhost:8000/api/members/ \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Content-Type, Authorization"
  ```
  Response must include `access-control-allow-origin: http://localhost:5173` and HTTP 200.

### Step 2: Fix env var name in `docker-compose.yml` [x]

- **File**: `/Users/clint/Workspace/team-resourcer/docker-compose.yml`
- **Change**: On line 43, rename the environment variable from `VITE_API_URL=http://localhost:8000` to `VITE_API_BASE_URL=http://localhost:8000`
- **Validation**: Confirm the corrected key matches what the frontend reads:
  ```
  grep VITE_API_BASE_URL \
    /Users/clint/Workspace/team-resourcer/frontend/src/lib/api-client.ts \
    /Users/clint/Workspace/team-resourcer/docker-compose.yml
  ```
  Both lines must reference `VITE_API_BASE_URL`.

## Validation Criteria

- [ ] `curl -i -X OPTIONS http://localhost:8000/api/members/ -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: Content-Type"` returns HTTP 200 with `access-control-allow-origin: http://localhost:5173`
- [ ] `curl -i http://localhost:8000/api/members/ -H "Origin: http://localhost:5173"` returns HTTP 200 with `access-control-allow-origin: http://localhost:5173` (no blocked error)
- [ ] `grep VITE_API_BASE_URL /Users/clint/Workspace/team-resourcer/docker-compose.yml` returns a match
- [ ] No `VITE_API_URL` key remains in `docker-compose.yml`: `grep VITE_API_URL /Users/clint/Workspace/team-resourcer/docker-compose.yml` returns no output
- [ ] Browser network tab shows no CORS errors when the frontend loads the members list

## Risks

- `allow_headers=["*"]` is appropriate for development. For a production hardening pass, tighten this to an explicit list (e.g., `["Content-Type", "Accept", "Authorization"]`). That is out of scope here.
- FastAPI's `CORSMiddleware` does not echo a wildcard `*` for `Access-Control-Allow-Headers` when `allow_credentials=True`; it reflects the requested headers instead. This is correct RFC behaviour and means the `curl` validation above will show the specific headers you requested rather than `*` — that is expected, not a bug.
