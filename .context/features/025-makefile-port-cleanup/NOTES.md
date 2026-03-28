# Feature 025 — Makefile Port Cleanup

## Current State

### Port Mappings (docker-compose.yml)

| Service  | Host Port | Container Port | Conflict Risk |
|----------|-----------|----------------|---------------|
| db       | 5432      | 5432           | HIGH — collides with any local PostgreSQL install |
| backend  | 8000      | 8000           | MEDIUM — collides with any other local API server bound to 8000 |
| frontend | 5173      | 5173           | MEDIUM — collides with any other Vite dev server on 5173 |

No service shares a port with another Docker service. All conflicts are host-process vs. Docker container.

### All Make Targets

| Target            | Command(s)                                                               | Calls `down` first? |
|-------------------|--------------------------------------------------------------------------|---------------------|
| `up`              | `docker compose up -d`                                                   | No                  |
| `down`            | `docker compose down`                                                    | N/A (is the down)   |
| `logs`            | `docker compose logs -f`                                                 | No                  |
| `migrate`         | `docker compose exec backend alembic upgrade head`                       | No                  |
| `migration`       | `docker compose exec backend alembic revision --autogenerate -m "$(name)"` | No               |
| `seed`            | `docker compose exec backend python -m app.seed`                         | No                  |
| `test`            | `docker compose exec backend pytest`                                     | No                  |
| `lint`            | `docker compose exec backend ruff check app/`                            | No                  |
| `format`          | `docker compose exec backend ruff format app/`                           | No                  |
| `typecheck`       | `docker compose exec backend mypy app/`                                  | No                  |
| `shell-db`        | `docker compose exec db psql -U resourcer -d team_resourcer`            | No                  |
| `reload`          | `docker compose restart backend frontend`                                | No (restart, safe)  |
| `reload-backend`  | `docker compose restart backend`                                         | No (restart, safe)  |
| `reload-frontend` | `docker compose restart frontend`                                        | No (restart, safe)  |
| `up-backend`      | `docker compose up -d backend`                                           | No                  |
| `up-frontend`     | `docker compose up -d frontend`                                          | No                  |
| `up-db`           | `docker compose up -d db`                                                | No                  |
| `rebuild`         | `docker compose up -d --build`                                           | No                  |
| `rebuild-backend` | `docker compose up -d --build backend`                                   | No                  |
| `rebuild-frontend`| `docker compose up -d --build frontend`                                  | No                  |
| `rebuild-db`      | `docker compose up -d --build db`                                        | No                  |
| `reset-db`        | stop backend → psql DROP/CREATE → start backend → migrate               | Partial (stops backend only, db stays up) |

`down` is defined but is never called by any other target.

---

## The Problem

### 1. `rebuild*` targets have no prior `down`

`docker compose up -d --build [service]` rebuilds the image and recreates the container. Docker stops the old container and starts the new one. During this recreation window, or when an external host process already holds the port, Docker emits:

```
Error response from daemon: driver failed programming external connectivity on endpoint ...:
Bind for 0.0.0.0:XXXX failed: port is already allocated
```

`docker compose up` exits **0** even when individual service starts fail due to port conflicts — the Make target succeeds at the shell level while the container silently never starts.

### 2. `up` and `up-*` targets also have no `down`

If Docker was previously stopped ungracefully (machine restart, `kill`, Docker Desktop crash), ghost containers can hold port allocations in the Docker networking layer even though they are not running. `docker compose up -d` will fail to bind those ports.

### 3. Local PostgreSQL is the most common conflict

Port 5432 is the default PostgreSQL port. On a developer machine with a local Postgres install (Homebrew, system package, Postgres.app), that process owns 5432 on the host. The `db` service cannot bind `5432:5432`. This breaks `up`, `up-db`, `rebuild`, and `rebuild-db`.

### 4. `reset-db` is fragile

`reset-db` calls `docker compose stop backend` but never stops `db`. It relies on `db` being healthy and its port staying bound. If `db` is in a bad state, the `psql exec` commands will hang or fail with no helpful error.

### 5. Affected targets (port-conflict risk)

- `up` — all three ports at once
- `up-backend` — port 8000
- `up-frontend` — port 5173
- `up-db` — port 5432
- `rebuild` — all three ports
- `rebuild-backend` — port 8000
- `rebuild-frontend` — port 5173
- `rebuild-db` — port 5432

---

## Proposed Fix

### Strategy: `down` before any `up --build` or cold `up`

Add a `down` guard to rebuild targets. For `up` (first-start), a `docker compose down` before `up` is also safe because volumes are not removed by default — `pgdata` and `uploads` survive.

### Specific changes

#### `rebuild` (full stack rebuild)

```makefile
rebuild:
	docker compose down
	docker compose up -d --build
```

#### `rebuild-backend`

```makefile
rebuild-backend:
	docker compose stop backend
	docker compose rm -f backend
	docker compose up -d --build backend
```

Note: use `stop` + `rm` rather than `down` here so `db` and `frontend` stay running. `rm -f` removes the stopped container so Docker can recreate it cleanly.

#### `rebuild-frontend`

```makefile
rebuild-frontend:
	docker compose stop frontend
	docker compose rm -f frontend
	docker compose up -d --build frontend
```

#### `rebuild-db`

```makefile
rebuild-db:
	docker compose stop backend db
	docker compose rm -f db
	docker compose up -d --build db
	docker compose start backend
```

Backend must be stopped first because it depends on db being healthy; bringing db down and up will trigger the healthcheck — backend needs to wait or be restarted anyway.

#### `up` (cold start / recovery)

Add an optional `|| true` guard so `down` does not fail if nothing is running:

```makefile
up:
	docker compose down || true
	docker compose up -d
```

Or, more precisely, only remove stale containers (not volumes):

```makefile
up:
	docker compose down --remove-orphans || true
	docker compose up -d
```

`--remove-orphans` also cleans up containers for services that have been removed from the compose file.

#### `reset-db` hardening

Current `reset-db` stops backend but leaves db running. This is correct for the "drop and recreate DB" flow. No port-conflict issue here, but it should also call `docker compose start backend` inside a recipe that can tolerate a failure on the `exec db psql` lines (add `|| true` or use `-c` error handling in psql).

---

## Targets That Need Modification

| Target            | Change needed |
|-------------------|---------------|
| `up`              | Add `docker compose down --remove-orphans || true` before `up -d` |
| `rebuild`         | Add `docker compose down` before `up -d --build` |
| `rebuild-backend` | Replace with `stop` + `rm -f` + `up -d --build` |
| `rebuild-frontend`| Replace with `stop` + `rm -f` + `up -d --build` |
| `rebuild-db`      | Replace with `stop backend db` + `rm -f db` + `up -d --build db` + `start backend` |

Targets that do NOT need changes: `reload`, `reload-backend`, `reload-frontend` (restart keeps the same container binding — no port re-allocation), all `exec`-based targets, `down`, `reset-db` (acceptable as-is, though hardening is optional).

---

## Notes on `docker compose up` Exit Code Behaviour

`docker compose up -d` returns exit code 0 even when a service fails to bind a port. The failure is only visible in `docker compose logs <service>` or `docker compose ps`. Any Make fix should consider adding a post-`up` health check:

```makefile
rebuild:
	docker compose down
	docker compose up -d --build
	docker compose ps
```

Printing `ps` after `up` makes the running/stopped state visible in the terminal without blocking.
