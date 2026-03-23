# Learnings

## Phase 1 — Scaffold + Data Model + API (2026-03-22)

### What went well
- Parallel agent execution for independent tracks (scaffold, frontend, schemas) saved significant time
- SQLAlchemy 2.0 async patterns with DeclarativeBase worked cleanly
- Alembic asyncpg→psycopg2 URL swap in env.py resolved the sync/async mismatch
- Pillow was already in deps but unused — leveraged it for magic byte validation during review

### Issues caught in review
- `exclude_none=True` bug: would have prevented clearing nullable fields in all 4 update endpoints
- `set_supervisor` missing eager loads: would have caused MissingGreenlet at runtime
- Team sub-router cross-area access: cosmetic URL provided false security — needed ownership checks
- 4 dependency CVEs found: python-multipart, pillow, starlette (via fastapi)
- Content-Type header spoofing on image upload: fixed with Pillow verify

### Architecture decisions
- History auto-capture: append-only, triggered in service layer on financial field changes
- Org tree: load all members flat, build tree in Python (not recursive SQL)
- Image naming: UUID-based to prevent path traversal
- Sub-routers: teams nested under areas, history nested under members
