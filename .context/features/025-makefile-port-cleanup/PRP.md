---
feature: 025-makefile-port-cleanup
status: COMPLETE
complexity: LOW
testing_strategy: implement-then-test
created: 2026-03-28
depends_on: []
---

# PRP: Makefile Port Cleanup

## Problem Statement

The `up`, `rebuild`, and `rebuild-*` Make targets call `docker compose up -d` without first stopping existing containers. When ports (5432, 8000, 5173) are held by stale containers or host processes (e.g., local PostgreSQL), Docker silently fails to start the service — returning exit 0 while the container is dead.

## Solution Overview

Add `docker compose down` (or per-service `stop` + `rm -f`) before `up` in affected targets. Add `docker compose ps` after `up` to make service state visible. Single file change: `Makefile`.

---

## Implementation Steps

### Step 1 — Update Makefile targets

**File:** `Makefile` — MODIFY

Replace the following targets with port-safe versions:

**`up`** (line 3-4): Add `down --remove-orphans` before cold start.
```makefile
up:
	docker compose down --remove-orphans 2>/dev/null || true
	docker compose up -d
	@docker compose ps
```

**`rebuild`** (line 71-72): Add `down` before full rebuild.
```makefile
rebuild:
	docker compose down
	docker compose up -d --build
	@docker compose ps
```

**`rebuild-backend`** (line 74-75): Stop and remove only backend.
```makefile
rebuild-backend:
	docker compose stop backend 2>/dev/null || true
	docker compose rm -f backend 2>/dev/null || true
	docker compose up -d --build backend
```

**`rebuild-frontend`** (line 77-78): Stop and remove only frontend.
```makefile
rebuild-frontend:
	docker compose stop frontend 2>/dev/null || true
	docker compose rm -f frontend 2>/dev/null || true
	docker compose up -d --build frontend
```

**`rebuild-db`** (line 57-58): Stop backend (depends on db), then rebuild db, then restart backend.
```makefile
rebuild-db:
	docker compose stop backend db 2>/dev/null || true
	docker compose rm -f db 2>/dev/null || true
	docker compose up -d --build db
	docker compose start backend 2>/dev/null || true
```

**Validation:**
```bash
# Verify each target has the expected commands
grep -A4 '^up:' Makefile
grep -A4 '^rebuild:' Makefile
grep -A3 '^rebuild-backend:' Makefile
grep -A3 '^rebuild-frontend:' Makefile
grep -A4 '^rebuild-db:' Makefile
```

---

## File Manifest

| File | Action |
|------|--------|
| `Makefile` | MODIFY — update 5 targets with port cleanup |

## Risks

1. **`make up` now always runs `down` first** — adds ~1-2 seconds. Acceptable trade-off for reliability.
2. **Data volumes survive `docker compose down`** — only `docker compose down -v` removes volumes. Default `down` is safe for pgdata.
3. **`rebuild-db` restarts backend** — if backend wasn't running, `start backend` is a no-op (suppressed with `|| true`).
