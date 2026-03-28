---
name: CORS Configuration Research
description: Full audit of CORS setup — backend middleware, env vars, frontend API client, Docker networking, and known failure modes
type: project
---

## Research Summary: CORS Configuration

### Key Files

- `backend/app/main.py` (lines 7, 33–39) — FastAPI app factory; adds `CORSMiddleware`
- `backend/app/core/config.py` (line 16) — `cors_origins` setting with default value
- `.env` — runtime env vars loaded by both Compose and pydantic-settings
- `frontend/src/lib/api-client.ts` (line 1, 10) — `apiFetch` wrapper; reads `VITE_API_BASE_URL`
- `frontend/.env.development` — sets `VITE_API_BASE_URL=http://localhost:8000`
- `docker-compose.yml` (lines 40–49) — frontend service env; sets `VITE_API_URL` (wrong key)
- `frontend/vite.config.ts` — Vite server config; no proxy defined

---

### 1. Backend CORS Middleware

Framework: **FastAPI** (`fastapi.middleware.cors.CORSMiddleware`).

Configuration in `backend/app/main.py` lines 33–39:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)
```

`settings.cors_origins` is a comma-separated string parsed at startup.

---

### 2. CORS Origins Settings and Env Vars

`backend/app/core/config.py` line 16:

```python
cors_origins: str = "http://localhost:5173,http://localhost:3000"
```

This is the **hardcoded default**. `http://localhost:5173` is already in the default — so the backend, when run locally without a `CORS_ORIGINS` env override, should allow the Vite dev server.

The `.env` file does **not** set `CORS_ORIGINS`, so the default is always active in dev.

To override, add `CORS_ORIGINS=http://localhost:5173,http://other-origin` to `.env`. The pydantic-settings field name is `cors_origins` (lowercase), mapped from env var `CORS_ORIGINS` (pydantic-settings uppercases automatically).

---

### 3. Frontend API Client

`frontend/src/lib/api-client.ts` reads:
```typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL as string
```

`frontend/.env.development` sets:
```
VITE_API_BASE_URL=http://localhost:8000
```

Requests go directly to `http://localhost:8000` — **no proxy**, no rewrite.

**No `credentials: 'include'`** is passed to `fetch`. The backend sets `allow_credentials=True`, but the client never sends credentials, so that flag has no practical effect and is not a source of errors.

---

### 4. Docker / Compose Networking — Critical Env Var Mismatch

`docker-compose.yml` lines 41–43 for the frontend service:
```yaml
environment:
  - VITE_API_URL=http://localhost:8000
```

**This sets `VITE_API_URL`, but the frontend reads `VITE_API_BASE_URL`.** The Compose-injected env var is silently ignored. The frontend instead falls back to `frontend/.env.development` (which does have the correct `VITE_API_BASE_URL`), but only because Vite loads `.env.development` at build/dev time. If the `.env.development` file were absent, `BASE_URL` would be `undefined` and all requests would go to `undefinedpath`, causing network errors rather than CORS errors.

There is **no Docker network proxy** between frontend and backend — they both publish to `localhost` on the host. No nginx, no Traefik, no Vite proxy config.

---

### 5. Nginx / Proxy

No nginx config exists anywhere in the repo. No proxy stanza in `vite.config.ts`. The frontend Vite dev server talks directly to the backend over the host network.

---

### Known Failure Modes and Likely Root Causes for CORS Errors

| Scenario | Root cause |
|---|---|
| Backend started with a different `cors_origins` env var that excludes `localhost:5173` | Origin not in whitelist; check what `CORS_ORIGINS` is set to in the running env |
| `Authorization` or `X-` custom header sent by frontend | `allow_headers` only permits `["Content-Type", "Accept"]`; any other request header triggers a preflight rejection |
| `credentials: 'include'` added to a fetch call | Requires `allow_origins` to be an explicit list (not `*`) — already satisfied — but any wildcard usage would break this |
| Running backend behind a reverse proxy that strips `Origin` | Would appear as CORS failure but actually be a proxy config issue |
| `VITE_API_BASE_URL` not set, so requests go to wrong URL | Network error, not CORS, but can look similar |

**Most likely cause** for a developer hitting CORS errors at `localhost:5173 → localhost:8000`: the `allow_headers` list is too narrow. If any middleware, library, or future request sends a header outside `["Content-Type", "Accept"]` (e.g., `Authorization`, `X-Requested-With`, `Cache-Control`), the preflight `OPTIONS` request will be rejected with a CORS error.

---

### Summary of Config Chain

```
backend default cors_origins = "http://localhost:5173,http://localhost:3000"
  ↓ overrideable via CORS_ORIGINS in .env
  ↓ parsed at startup in main.py into CORSMiddleware allow_origins list

frontend VITE_API_BASE_URL = "http://localhost:8000"
  ↓ set in frontend/.env.development (loaded by Vite automatically)
  ↓ NOTE: docker-compose.yml sets VITE_API_URL (wrong key) — has no effect

No proxy, no nginx. Direct host-to-host fetch.
```
