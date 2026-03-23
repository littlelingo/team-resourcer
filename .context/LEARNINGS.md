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

## Phase 2 — Card View + Table View (2026-03-23)

### What went well
- Parallel agent execution: foundation (steps 1-5) + UI shell (steps 6-7) ran concurrently
- shadcn CLI worked in interactive terminal for component generation
- TanStack Query v5 object syntax + cache invalidation pattern clean
- Custom Tailwind sidebar simpler and more reliable than shadcn Sidebar component

### Issues caught in review
- PATCH→PUT mismatch: all 4 update mutations used wrong HTTP method (405 errors)
- Program assignments silently discarded: form collected data it couldn't submit
- Edit from table passed incomplete TeamMemberList, would overwrite salary/phone with blanks
- ImageUpload had no client-side file type/size validation + object URL memory leak
- getInitials duplicated 3x, actions dropdown duplicated 4x → extracted to shared
- Two MemberFormDialog instances mounted simultaneously → consolidated to one
- Stale team_id when area changes in form → added useEffect watcher

### Architecture decisions
- Teams endpoint is nested (/api/areas/{id}/teams/) — useAllTeams fans out queries per area
- Backend returns salary/bonus/pto as string decimals — frontend parses with parseFloat
- Program assignments managed via separate endpoints, not in member form
- Detail sheet uses @radix-ui/react-dialog with Tailwind slide animation (not Sheet)
