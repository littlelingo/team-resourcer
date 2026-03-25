---
name: project_009_devworkflow_review
description: Key findings from 009-dev-workflow (config-only Docker/Vite/Makefile) review on 2026-03-24
type: project
---

Config-only feature reviewed on 2026-03-24 on branch feat/dev-workflow (uncommitted changes).

**Why:** Fix frontend hot reload in Docker, add reload/rebuild Makefile targets.
**How to apply:** If future DevOps changes touch frontend/Dockerfile or docker-compose.yml, check the fragile areas below.

## Critical / Fragile Areas

1. **Production image bloat via `COPY --from=builder /app .`** — The Dockerfile runtime stage now copies all of `/app` from builder, including `src/`, `node_modules`, and `dist`. The old three-line COPY was intentionally minimal for prod; the new single COPY makes the production runtime image larger (adds raw source). Not a security risk because prod uses `npx serve dist` but the image carries unnecessary files. The PRP acknowledges this as acceptable.

2. **Anonymous `node_modules` volume is unnamed — not listed in top-level `volumes:`** — Docker creates an anonymous volume for `/app/node_modules`. This is correct and intentional for dev, but anonymous volumes: (a) accumulate silently on `docker compose down` (only removed with `-v`), and (b) go stale after `package.json` changes. The PRP documents `make rebuild-frontend` as the mitigation but there is no inline comment in `docker-compose.yml` reminding developers.

3. **`reload` targets use `docker compose restart` which does not pick up image changes** — `make reload-backend` / `make reload-frontend` use `restart`, which sends SIGTERM+start to the existing container with its existing image. This is correct for backend (which has a bind mount + --reload uvicorn), but for frontend the bind mount means Vite is already watching; a restart is mostly useful for config changes to `docker-compose.yml` environment variables, not for code changes (HMR handles those). The naming `reload` vs `rebuild` is clear enough to avoid confusion, but the combination is potentially confusing.

## Warnings

- `docker-compose.prod.yml` frontend service does not re-declare a `volumes:` block. Because the prod override does NOT include a volumes key for frontend, Docker Compose merges and keeps the dev bind mount (`./frontend:/app`) when running with both files. The prod container will have the source tree mounted read-only, which is harmless since `npx serve dist` only reads `dist/`, but it is a latent inconsistency.
- `usePolling: true` adds CPU overhead and has no `interval` set (defaults to 100ms). Acceptable for dev.

## Confirmed Correct

- `.PHONY` declaration is complete and matches all new targets.
- Anonymous volume syntax `/app/node_modules` (no name, no target) is the correct Docker Compose idiom for preserving container-built modules.
- `vite.config.ts` `server.host: '0.0.0.0'` is redundant with `--host` flag in `docker-compose.yml` command, but harmless and makes config self-documenting.
- `server.port: 5173` matches EXPOSE and published port.
</content>
</invoke>