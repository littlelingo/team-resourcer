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

## Phase 3 — Interactive Tree Views (2026-03-23)

### What went well
- @xyflow/react v12 + dagre layout worked smoothly for all three tree types
- Flat node/edge format from backend (positions at 0,0, layout client-side) was a clean separation
- Parallel tracks: backend endpoints + frontend foundation ran concurrently
- Custom node components with Tailwind styling matched Phase 2 card aesthetics

### Issues caught in review
- PATCH→PUT mismatch AGAIN (3rd phase in a row) — this is the #1 recurring anti-pattern
- Org drag-reassign bypassed dedicated supervisor endpoint (skipped circular ref validation)
- Program reassign created duplicates (missing DELETE of old assignment before POST new)
- image vs image_path field name mismatch between backend tree_service and frontend MemberNode
- Org tree node data included PII (email, employee_id) not needed by the renderer
- Dagre silently creates phantom nodes for orphaned edges — needed guard on setEdge
- Dragged nodes not restored to position when no drop target found

### Architecture decisions
- Tree endpoints return flat node/edge lists, not nested JSON — simpler client-side processing
- Dagre layout runs client-side (useTreeLayout hook) — keeps API decoupled from layout
- Drag-drop uses proximity detection (60px threshold) since ReactFlow lacks native parent-assignment
- Program reassign requires DELETE old + POST new (not a single PATCH)
- Node data should contain only rendering fields — relational IDs go in edges

## Phase 4 — Data Import (2026-03-23)

### What went well
- Backend + frontend tracks ran fully in parallel with clean separation
- Session cache pattern (in-memory dict with UUID key + TTL) worked well for single-user
- Four-step wizard state machine (source → map → preview → result) was clean to implement
- Auto-suggest column mapping via case-insensitive label matching saved UX effort

### Issues caught in review
- No file size limit on upload — could OOM the server with large files (added 10MB limit)
- Team get_or_create silently re-parented existing teams to different areas (scoped by area_id)
- No circular supervisor detection in two-pass import (added cycle walk)
- Row index off-by-one: already 1-based from mapper but frontend added +1 again
- Credential file path leaked in 422 error response (now logs internally, generic message to client)
- Session not cleaned up on DB commit failure (added try/finally)
- Bare except:pass on Decimal conversion — removed (mapper already validates)
- No query cache invalidation after import commit (added invalidateQueries)

### Architecture decisions
- Import uses stateless session cache (in-memory dict, 30-min TTL) — acceptable for single-user
- Two-pass supervisor resolution: first pass upserts all members, second pass sets supervisor_id
- get_or_create for FK-by-name fields (areas, teams, programs) — creates missing entities atomically
- Column mapping is advisory — auto-suggest helps but user always has final say
