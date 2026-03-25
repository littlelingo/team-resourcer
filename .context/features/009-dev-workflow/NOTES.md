# Research Notes: Dev Workflow Improvements

**Date**: 2026-03-24
**Request**: Add `make down`, reload commands for backend/frontend, and frontend hot reload support.

---

## Current State

### Makefile Targets
| Target | Command |
|---|---|
| `make up` | `docker compose up -d` |
| `make down` | `docker compose down` |
| `make logs` | `docker compose logs -f` |
| `make migrate` | `docker compose exec backend alembic upgrade head` |
| `make migration name="…"` | `docker compose exec backend alembic revision --autogenerate -m "…"` |
| `make seed` | `docker compose exec backend python -m app.seed` |
| `make test` | `docker compose exec backend pytest` |
| `make lint` | `docker compose exec backend ruff check app/` |
| `make format` | `docker compose exec backend ruff format app/` |
| `make typecheck` | `docker compose exec backend mypy app/` |
| `make shell-db` | `docker compose exec db psql -U resourcer -d team_resourcer` |

**Note**: `make down` already exists! User may not have realized.

### Docker Compose Services (docker-compose.yml)
- **db**: postgres:16.6-alpine, port 5432, healthcheck, pgdata volume
- **backend**: FastAPI, port 8000, `./backend:/app` bind mount, uvicorn `--reload`, depends on db healthy
- **frontend**: React/Vite, port 5173, **NO source bind mount**, runs `npm run dev -- --host`

### Backend Hot Reload: WORKING
- `./backend:/app` volume mount means container sees live source edits
- `uvicorn --reload` watches for changes automatically

### Frontend Hot Reload: BROKEN
- Frontend Dockerfile builds `dist/` in builder stage, copies only `dist/`, `node_modules`, and `package*.json` to runtime
- No `./frontend:/app` bind mount in docker-compose.yml
- Container runs `npm run dev -- --host` but has no `src/` directory to watch
- Any frontend change requires `docker compose build frontend && docker compose up -d frontend`

### Frontend Dockerfile Issue
The runtime stage copies `dist/` but the CMD runs `npm run dev`. This is contradictory — dev server needs `src/`, `vite.config.ts`, `tsconfig.json`, `index.html`, etc. The container starts but serves stale content.

---

## What Needs to Change

### 1. `make down` — Already exists
User may want confirmation, or may want additional variants like `make down-v` (with volume removal).

### 2. Frontend Hot Reload — Fix docker-compose.yml
Add source bind mount for frontend:
```yaml
frontend:
  volumes:
    - ./frontend:/app
    - /app/node_modules  # anonymous volume to preserve container's node_modules
```
The anonymous volume for `node_modules` prevents host `node_modules` (if any) from overriding the container's installed deps.

Additionally, the Dockerfile needs adjustment — the runtime stage needs full source, not just `dist/`. Options:
- **Option A**: Single-stage dev Dockerfile (simpler, dev-only)
- **Option B**: Keep multi-stage but add source files to runtime stage
- **Option C**: Use docker-compose.yml volumes to overlay source (bind mount overrides image contents)

**Recommended**: Option C — add bind mount in docker-compose.yml. The bind mount overlays the image filesystem, so the container sees live `src/`, `vite.config.ts`, etc. The Dockerfile runtime stage should also copy full source (not just `dist/`) so it works even without the bind mount.

### 3. Reload Commands
- **Backend**: `make reload-backend` → `docker compose restart backend` (uvicorn restarts with `--reload` on file changes already, but a manual restart target is useful for config changes)
- **Frontend**: `make reload-frontend` → `docker compose restart frontend`
- **Both**: `make reload` → `docker compose restart backend frontend`

### 4. Rebuild Commands (for when Dockerfile/deps change)
- `make rebuild` → `docker compose up -d --build`
- `make rebuild-backend` → `docker compose up -d --build backend`
- `make rebuild-frontend` → `docker compose up -d --build frontend`

---

## Gaps
1. **Frontend hot reload broken** — no bind mount, Dockerfile copies only `dist/`
2. **No frontend Makefile targets** — test, lint, typecheck all backend-only
3. **VITE_API_URL vs VITE_API_BASE_URL** — need to verify which the source uses
4. **Frontend Dockerfile CMD mismatch** — `npm run dev` but no source in image

## Dependencies
- Docker Compose v2
- Vite HMR requires WebSocket connection (port 5173 already exposed)

## Risks
1. Adding `./frontend:/app` bind mount means `node_modules` in the container could be overridden by host — anonymous volume needed
2. Vite HMR WebSocket may need `server.watch.usePolling: true` inside Docker on some platforms
3. File permission issues possible with non-root `app` user + bind mount on Linux

## Open Questions
1. Which env var does frontend source actually use — `VITE_API_URL` or `VITE_API_BASE_URL`?
2. Should `make down` also have a `make down-v` variant that removes volumes?
3. Should we add frontend Makefile targets (test-frontend, lint-frontend) in this same feature?
4. Does the frontend need `vite.config.ts` updated with `server.watch.usePolling` for Docker compatibility?
