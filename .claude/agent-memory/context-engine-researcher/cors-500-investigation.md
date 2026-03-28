---
name: CORS 500 Investigation
description: Root cause and fix for all backend endpoints returning HTTP 500 — database tables do not exist because migrations were never run
type: project
---

# Investigation: All Backend Endpoints Return HTTP 500

**Date:** 2026-03-28

## Root Cause

**The database contains no tables.** Alembic migrations have never been applied to the Postgres database in the running Docker environment.

Confirmed with two independent checks:

```
$ docker compose exec backend alembic current
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
(no output = no migrations applied)

$ docker compose exec db psql -U resourcer -d team_resourcer -c "\dt"
Did not find any relations.
```

Every API route that touches the DB fails immediately with:
```
asyncpg.exceptions.UndefinedTableError: relation "agencies" does not exist
asyncpg.exceptions.UndefinedTableError: relation "programs" does not exist
asyncpg.exceptions.UndefinedTableError: relation "team_members" does not exist
```

## Why CORS Headers Are Missing on 500 Responses

The Starlette CORS middleware is in the middleware stack but error responses raised *within* the application bypass the normal response pipeline. Starlette's `ServerErrorMiddleware` (`errors.py:187`) re-raises the exception before CORS headers are written. This is a known Starlette behavior: CORS headers are only added to responses that complete the full send cycle. An unhandled exception that propagates up through `ServerErrorMiddleware` returns a bare 500 with no CORS headers.

The CORS fix in code is correct — it will work once the 500s are resolved.

## System State at Time of Investigation

- **All three containers are running and healthy:**
  - `team-resourcer-backend-1` — Up, port 8000
  - `team-resourcer-db-1` — Up, port 5432, health check passing
  - `team-resourcer-frontend-1` — Up, port 5173

- **`/health` endpoint returns 200** — the app process starts fine; the problem is purely the missing schema.

- **`/api/members/` returns 500** with body `Internal Server Error` and no CORS headers.

- **The Dockerfile does NOT run migrations** — `CMD` is just `uvicorn`. Migration is a manual step (`make migrate`).

- **The `docker-compose.yml` backend service** mounts `./backend:/app` (volume mount), so source code changes are live without rebuild. The `--reload` flag is set in the Compose `command:` override, meaning uvicorn watches for file changes.

- **No automatic migration on startup** — `app/main.py` lifespan only starts an import-session cleanup task. There is no `alembic upgrade head` call on startup.

## Migration Files Present

Four migration files exist in `backend/alembic/versions/`:
1. `452ccece7038_initial_schema.py`
2. `b514fc596e17_add_agencies_and_program_agency_fk.py`
3. `c7f3a1e9b2d4_member_name_split_and_hire_date.py`
4. `d8e2f3a4c501_member_location_split.py`

All are written but none have been applied.

## Fix

Run migrations, then optionally seed data:

```bash
make migrate       # runs: docker compose exec backend alembic upgrade head
make seed          # optional: docker compose exec backend python -m app.seed
```

After `make migrate`, all 500 errors will resolve, and the CORS fix that is already in code will function correctly.

## Secondary Finding: Why This Happens on Fresh `make up`

`make up` runs `docker compose down` then `docker compose up -d`. It does **not** call `make migrate`. If the `pgdata` volume was deleted (e.g., via `docker volume prune` or explicit removal), the database is recreated empty and migrations must be re-applied manually. The `make reset-db` target does call `alembic upgrade head`, but `make up` / `make rebuild` do not.

**Why:** The project treats migration as a separate explicit step by design, but there is no documentation or post-up reminder nudging the user to run `make migrate` after a fresh start with an empty volume.
