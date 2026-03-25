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

Known issue: VITE_API_URL (set in docker-compose.yml) vs VITE_API_BASE_URL (used in vite.config.ts test env) — one of these is wrong; verify which name the frontend src actually uses.

Makefile has no frontend targets — only backend (pytest, ruff, mypy) and db (psql).

Production override: docker-compose.prod.yml removes --reload from backend, replaces frontend dev server with `npx serve dist -l 5173`.
