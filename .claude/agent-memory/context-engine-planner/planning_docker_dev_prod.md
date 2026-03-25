---
name: planning_docker_dev_prod
description: Docker multi-stage Dockerfile + compose override pattern for dev hot reload vs prod static serve
type: feedback
---

When a multi-stage Dockerfile has a builder + runtime pattern and the runtime stage copies only build artifacts (e.g., `dist/`), the dev server (`npm run dev`) inside that container has no source files to watch — hot reload silently breaks.

Fix: copy the full `/app` directory from the builder into the runtime stage with a single `COPY --from=builder --chown=app:app /app .`. Production behavior is preserved via a `docker-compose.prod.yml` override that changes only the `command`.

Also required for Docker hot reload:
- Bind mount `./frontend:/app` + anonymous volume `/app/node_modules` in `docker-compose.yml` (prevents bind mount from shadowing container-built node_modules)
- `server.watch.usePolling: true` in `vite.config.ts` (inotify is unreliable inside Docker on most host filesystems)

**Why:** Discovered during PRP 009-dev-workflow (2026-03-24). The Dockerfile CMD was `npm run dev` but `src/` was absent from the runtime image — hot reload appeared to work (no startup error) but no file changes were ever detected.

**How to apply:** Any time a frontend service in Docker uses a dev server, verify the runtime image contains source files AND that polling is enabled in the bundler config. Warn about the stale `node_modules` volume risk when `package.json` changes.
