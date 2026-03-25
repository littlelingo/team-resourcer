---
name: project_devops
description: Docker Compose service layout, hot-reload status per service, known Makefile gaps, and frontend env var mismatch
type: project
---

Docker Compose has 3 services: db (postgres:16.6-alpine), backend (python:3.12-slim), frontend (node:20-alpine).

Backend hot reload WORKS: `./backend:/app` bind mount + uvicorn `--reload`.
Frontend hot reload BROKEN: no source bind mount in docker-compose.yml; Dockerfile builds dist/ into image; `npm run dev` inside container has no src/ to watch.

**Why:** The devops adaptation (feature 007) added multi-stage Dockerfiles and docker-compose.prod.yml but did not add a frontend source bind mount for dev.

**How to apply:** If asked about frontend hot reload or why frontend changes don't reflect: the fix is adding `./frontend:/app` (and excluding node_modules) as a volume in docker-compose.yml. Flag this as a known gap.

Confirmed env var mismatch: docker-compose.yml sets VITE_API_URL but frontend/src/lib/api-client.ts reads VITE_API_BASE_URL. The correct name is VITE_API_BASE_URL (also set in frontend/.env.development and vite.config.ts test env). docker-compose.yml has the wrong name.

Environment detection pattern: No existing dev-only conditional imports. Vite exposes import.meta.env.DEV (boolean, true when `vite dev`) and import.meta.env.PROD (true when built). docker-compose.prod.yml sets NODE_ENV=production on the container but the frontend code does not read NODE_ENV — it is not exposed to Vite by default. The reliable dev-only flag is import.meta.env.DEV.

Makefile has no frontend targets — only backend (pytest, ruff, mypy) and db (psql).

Production override: docker-compose.prod.yml removes --reload from backend, replaces frontend dev server with `npx serve dist -l 5173`.
