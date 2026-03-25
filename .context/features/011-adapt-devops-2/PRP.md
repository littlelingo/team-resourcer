# PRP: Adapt — DevOps (Round 2)

**Status**: COMPLETE
**Strategy**: implement-then-test
**Branch**: `refactor/adapt-devops-2`

## Findings

1. **[HIGH]** `backend/Dockerfile:28` — `CMD` includes `--reload`, shipping dev flag in production image.
2. **[MEDIUM]** `frontend/Dockerfile:1,13` — `node:20-alpine` unpinned patch version.

## Steps

### Step 1: Remove --reload from backend Dockerfile CMD
The dev compose already overrides CMD with `--reload`. The image CMD should be production-safe.

### Step 2: Pin node base image in frontend Dockerfile
Pin both stages to `node:20.20.1-alpine3.23` (current LTS patch + distro), matching the backend's pinning practice (`python:3.12.8-slim-bookworm`).
