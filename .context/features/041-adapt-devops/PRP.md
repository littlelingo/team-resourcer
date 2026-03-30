# PRP: Adapt DevOps

## Goal
Fix devops findings from `/adapt` audit.

## Steps

### Step 1: Fix frontend Dockerfile CMD (HIGH)
- Change default CMD from `npm run dev` to production `serve dist`
- Install `serve` globally in runtime stage
- Dev compose already overrides with `command: npm run dev -- --host`

### Step 2: Add VITE_API_BASE_URL build-arg (MEDIUM)
- Add ARG/ENV to frontend Dockerfile builder stage
- Add build.args to docker-compose.prod.yml frontend service

### Step 3: Fix rebuild-db missing migrations (MEDIUM)
- Add `alembic upgrade head` to Makefile rebuild-db target

### Step 4: Add DEV ONLY comment to docker-compose (LOW)
- Document that `--reload` on backend command is dev-only

## Deferred
- Runtime stage copying full node_modules — dev compose anonymous volume depends on
  node_modules existing in the image. Would need multi-target Dockerfile to fix properly.

## Testing Strategy
Verify `make up` still works after changes.
