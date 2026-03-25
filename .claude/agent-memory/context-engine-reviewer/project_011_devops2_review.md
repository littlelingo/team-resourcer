---
name: project_011_devops2_review
description: 011-adapt-devops-2 (remove --reload, pin frontend node image): key findings from review on 2026-03-25
type: project
---

Reviewed on 2026-03-25 on branch refactor/adapt-devops-2 (uncommitted changes).

**Why:** Remove --reload dev flag from backend image CMD; pin frontend node base image patch version.
**How to apply:** If future Dockerfile changes touch node pinning or CMD/command interaction, check findings below.

## Confirmed Correct

1. **`--reload` removal is safe** — Both `docker-compose.yml` (line 38) and `docker-compose.prod.yml` (line 4) have explicit `command:` overrides for backend. The image CMD is never reached in either compose workflow; removing `--reload` from it is purely a correctness fix with no behavioral impact.

2. **`node:20.20.1-alpine` tag exists and resolves to Node v20.20.1 on Alpine 3.23.3** — Confirmed by docker pull/run on 2026-03-25.

## Findings (as reviewed)

1. **PRP vs implementation divergence** — PRP specified `node:20.19.0-alpine3.21`; implementation used `node:20.20.1-alpine`. The implemented tag is a newer patch (fine) but omits the Alpine distro suffix. Not blocking because both stages use the same tag (reproducible relative to each other), but unlike backend's `python:3.12.8-slim-bookworm` the Alpine distro version is floating (currently 3.23.3). Flagged as warning.

2. **Persistent issue from 009 review** — `docker-compose.prod.yml` frontend still does not reset `volumes:`, so the dev bind mount (`./frontend:/app`) persists when both compose files are used together. This pre-dates this PR and was not in scope, but remains a latent inconsistency to watch.
