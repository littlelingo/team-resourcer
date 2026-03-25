---
name: audit_findings_march2025
description: Fresh re-audit (2026-03-25) findings for all 6 dimensions — key gaps remaining after features 004-008
type: project
---

Fresh read-only audit completed 2026-03-25. Findings by dimension:

## CRITICAL / HIGH

**Security — `--reload` in production Dockerfile CMD** (`backend/Dockerfile:28`)
- `CMD ["uvicorn", ... "--reload"]` ships in the production image. The dev docker-compose overrides this, and the prod compose removes it, BUT the image itself defaults to --reload if run directly.

**Security — image_service.py checks Content-Type before magic bytes** (`backend/app/services/image_service.py:29-34`)
- Content-type gating (lines 29-34) rejects based on the header FIRST. Magic-byte verification (lines 51-54) still runs, so the final check is correct — but the order leaks the anti-pattern intent. Low practical risk.

**DevOps — frontend Dockerfile uses unpinned `node:20-alpine` base** (`frontend/Dockerfile:1,13`)
- Builder and runtime both use `node:20-alpine` (no patch version). backend pins `python:3.12.8-slim-bookworm`.

**Feature — image upload is never submitted** (`frontend/src/components/members/MemberFormDialog.tsx:66,122-173`)
- `imageFileRef` is populated (line 233) but `onSubmit` never reads it or calls `POST /api/members/{uuid}/image`. The UI accepts a photo, stores it locally, then silently discards it on save. Backend endpoint exists at members.py:85.

## MEDIUM

**DevOps — `--reload` in base Dockerfile CMD** — as above, same file.

**Structure — `TeamFormDialog.tsx` is 305 lines** — exceeds 300-line threshold by 5 lines. Minimal.

**Code quality — `MemberFormDialog.tsx` uses `useEffect` for derived state** (lines 107-113, 116-118)
- Two `useEffect`s run to clear team_id when area changes and reset a first-render guard when open/member changes. These are reactive side-effects on props/state, not event handlers, so they are borderline (acceptable in React idiom) but worth noting.

**Code quality — `import_commit.py` bare except** (line 97 in `_append_history_if_changed`)
- `except Exception: return` swallows all errors silently when converting financial values. Should log or narrow.

**Documentation — `import_router.py` missing module docstring** (line 1)
- No module-level docstring; all other route files have one.

**Documentation — frontend hooks/components have no JSDoc** — none of the 5 hook files or major components have JSDoc. All backend Python functions are documented.

## LOW

**DevOps — docker-compose.yml backend overrides CMD inline** (line 38) — `command: uvicorn ... --reload` duplicates what the Dockerfile CMD already does; redundant but harmless.

**Structure — `MembersPage.tsx` is 280 lines** — within threshold.

**Security — in-memory import sessions are process-local** (`import_session.py:14`)
- `_sessions` dict is module-level; sessions lost on restart, and not shared across multiple workers. The prod compose uses `--workers 2`, so sessions from one worker are invisible to the other. A user could get 404 on /preview or /commit if load balanced to a different worker.

**Security — CORS wildcard-adjacent** — `allow_headers=["Content-Type", "Accept"]` is intentionally narrow (good), but `allow_methods` includes all verbs; fine.

**Testing — no test file for `org_service.py`** — `set_supervisor` cycle detection is indirectly tested via `test_org_routes.py` integration tests, but no dedicated unit test for `_check_no_cycle`.

**Testing — CI backend test step has no DB** — CI runs `pytest` without a database; backend tests use SQLite in-memory (aiosqlite), which is fine but differs from prod (Postgres 16).

**Why:** Audit commissioned 2026-03-25 after features 004-008 adapt passes.

**How to apply:** When implementing fixes, prioritize (1) image upload wiring, (2) Dockerfile --reload, (3) multi-worker session store.
