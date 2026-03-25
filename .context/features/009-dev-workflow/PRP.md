---
feature: 009-dev-workflow
status: COMPLETE
testing_strategy: implement-then-test
complexity: LOW
---

# PRP: Dev Workflow Improvements

## Goal

Fix frontend hot reload in Docker and add `reload` / `rebuild` Makefile targets so developers can restart or rebuild individual services without stopping the full stack.

## Steps

Steps must be executed in order — Dockerfile changes before compose changes, vite config before compose up.

### 1. Fix `frontend/Dockerfile` — copy full source to runtime stage

**File**: `/Users/clint/Workspace/team-resourcer/frontend/Dockerfile`

The runtime stage currently copies only `dist/`, `node_modules/`, and `package*.json` from the builder. This means the dev server has no `src/` to watch. Replace the three `COPY --from=builder` lines in the runtime stage with a single copy of the entire `/app` directory from the builder:

```
COPY --from=builder --chown=app:app /app .
```

This replaces:
```
COPY --from=builder --chown=app:app /app/package*.json ./
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
```

The production override (`docker-compose.prod.yml`) serves the pre-built `dist/` via `npx serve dist`, so it is unaffected by this change. The builder stage is unchanged.

### 2. Add bind mount + anonymous node_modules volume in `docker-compose.yml`

**File**: `/Users/clint/Workspace/team-resourcer/docker-compose.yml`

Add a `volumes` block to the `frontend` service. The bind mount overlays `./frontend` onto `/app`, giving Vite live access to `src/`. The anonymous volume at `/app/node_modules` prevents the bind mount from shadowing the container-built `node_modules`:

```yaml
frontend:
  volumes:
    - ./frontend:/app
    - /app/node_modules
```

No other fields in the `frontend` service block change.

### 3. Add `server` config to `frontend/vite.config.ts` for Docker compatibility

**File**: `/Users/clint/Workspace/team-resourcer/frontend/vite.config.ts`

Add a `server` key inside `defineConfig`. Docker's filesystem does not reliably emit inotify events, so polling is required. Also set `host` and `port` explicitly so they are not dependent on the CLI flag alone:

```ts
server: {
  host: '0.0.0.0',
  port: 5173,
  watch: {
    usePolling: true,
  },
},
```

Insert this key after the `resolve` block and before the `test` block (or anywhere at the top level of the config object — order does not matter, but keep it grouped logically with dev-server concerns).

### 4. Add `reload` and `rebuild` targets to `Makefile`

**File**: `/Users/clint/Workspace/team-resourcer/Makefile`

Append the following targets. Update the `.PHONY` declaration at line 1 to include all new target names.

New targets:

```makefile
reload:
	docker compose restart backend frontend

reload-backend:
	docker compose restart backend

reload-frontend:
	docker compose restart frontend

rebuild:
	docker compose up -d --build

rebuild-backend:
	docker compose up -d --build backend

rebuild-frontend:
	docker compose up -d --build frontend
```

Updated `.PHONY` line:

```makefile
.PHONY: up down logs migrate migration seed test lint format typecheck shell-db reload reload-backend reload-frontend rebuild rebuild-backend rebuild-frontend
```

## Validation

### Step 1 — Dockerfile
- `docker build -t frontend-test ./frontend` completes without error.
- `docker run --rm frontend-test ls /app/src` shows the source directory is present in the image.

### Step 2 + 3 — Hot reload end-to-end
After steps 1–3 are complete, run a full stack test:
1. `make down && make up` (forces image rebuild on first up after Dockerfile change — or use `docker compose up -d --build frontend` explicitly).
2. Open `http://localhost:5173` in a browser.
3. Edit any file under `frontend/src/` (e.g., change a string in a component).
4. Confirm the browser updates within a few seconds without a manual refresh (HMR) or at most a full-page reload (fallback) — but with no developer action required.

### Step 4 — Makefile targets
Run each target in sequence against a live stack:
- `make reload-backend` — backend container restarts, frontend stays running.
- `make reload-frontend` — frontend container restarts, backend stays running.
- `make reload` — both restart.
- `make rebuild-backend` — backend image is rebuilt and container replaced.
- `make rebuild-frontend` — frontend image is rebuilt and container replaced.
- `make rebuild` — all service images rebuilt.

Confirm no Makefile syntax errors: `make --dry-run rebuild` prints the expected `docker compose` command without executing it.

### Production override still works
```
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
Frontend container should run `npx serve dist` (from the prod override) and serve the pre-built assets without error.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Anonymous `node_modules` volume becomes stale after `package.json` changes (e.g., new dependency added) | Run `make rebuild-frontend` after any `npm install`. Document this in a comment above the volume in `docker-compose.yml`. |
| `usePolling: true` adds CPU overhead — Vite polls every file in `src/` on a timer | Default poll interval (100ms) is acceptable for a dev workflow. Only active during development; `docker-compose.prod.yml` is unaffected. |
| Bind mount `./frontend:/app` + non-root `app` user may cause permission errors on Linux (file UID mismatch) | This is a Linux-only issue; macOS (the current dev environment) is unaffected. Note in comments that Linux developers may need to adjust the `adduser` UID to match their host user, or remove the `USER app` line for local dev. |
| Dockerfile now copies `src/` into the image — slightly larger image size | Negligible for a dev-only image. Production uses the `docker-compose.prod.yml` override which serves pre-built assets; the production concern is the `dist/` artifact, not the runtime image size. |
