# PRP: DevOps Adaptation

**Status**: COMPLETE
**Strategy**: implement-then-test

## Steps

### Step 1: Add .dockerignore files
- backend/.dockerignore and frontend/.dockerignore to exclude dev artifacts

### Step 2: Multi-stage Dockerfiles with pinned images and non-root user
- Backend: builder stage for deps, runtime stage with non-root user
- Frontend: builder stage for npm build, nginx for serving static files
- Pin base images to specific patch versions

### Step 3: Add docker-compose.prod.yml
- Override dev commands with production-ready commands
- No --reload, no dev server

### Step 4: Add CI pipeline
- GitHub Actions workflow: lint → type-check → test for both backend and frontend
