---
name: phase1_review_findings
description: Key bugs, fragile areas, and patterns found during Phase 1 implementation review (2026-03-22)
type: project
---

Phase 1 review of backend FastAPI/SQLAlchemy async stack.

**Why:** First review pass on a greenfield project — establishes baseline quality bar and fragile areas for future reviewers.

**How to apply:** Check these areas when reviewing future PRs that touch the affected files.

## Critical bugs found

1. **database.py:20** — `get_db` has redundant `session.close()` in `finally` block. `async with AsyncSessionLocal()` already closes on exit; explicit close is harmless but signals confusion about context manager semantics.

2. **team_service.py:61-69** (`add_member_to_team`) — Does NOT verify that `team_id` actually exists before assigning it to `member.team_id`. A caller can silently attach a member to a nonexistent team, violating the FK at the DB level and returning 404 for the wrong reason.

3. **org.py route:20** (`set_supervisor_route`) — Returns `TeamMemberDetailResponse` but `set_supervisor` in `org_service.py` only loads the member with a bare `select(TeamMember)` — no `selectinload` for nested relationships. Serialisation will trigger lazy-load on an async session, raising `MissingGreenlet` / `DetachedInstanceError` at runtime.

4. **member_service.py:95** (`update_member`) — Uses `exclude_none=True` which makes it impossible to explicitly clear nullable fields (e.g., set `team_id=None` or `supervisor_id=None`). A client can never unassign a member from a team via PATCH; they would have to use the dedicated `remove_member_from_team` endpoint instead, but the PUT endpoint is documented as the general update path. This is a semantic mismatch.

5. **program_service.py:78-100** (`assign_member`) — Does not verify `member_uuid` exists before inserting a `ProgramAssignment`. Will raise an IntegrityError (FK violation) from the DB with a 500 instead of a clean 404.

## Warnings

1. **main.py:39** — `StaticFiles` mount will raise `RuntimeError` at startup if `settings.upload_dir` does not exist (before the lifespan `makedirs` runs on some versions). The `makedirs` in lifespan runs before requests but the `StaticFiles` constructor also runs at startup — order matters and this is fragile.

2. **team_member.py:75** — `remote_side="TeamMember.uuid"` uses a string; should be `remote_side=[TeamMember.uuid]` (list form) to be explicit and avoid potential mapper resolution issues.

3. **model: updated_at onupdate=func.now()** — `onupdate=func.now()` is a SQLAlchemy Core expression evaluated server-side only during SQL UPDATE statements. It will NOT fire when SQLAlchemy ORM updates an object and the column is not explicitly included. This is a known SQLAlchemy async gotcha — the `updated_at` field can silently go stale on ORM-level updates.

4. **history.py route** — No 404 guard: if `member_uuid` doesn't exist, the endpoint returns an empty list `[]` instead of 404. This is misleading — callers cannot distinguish "member exists, no history" from "member does not exist".

5. **config.py** — Both `postgres_*` fields AND `database_url` are required, but `database_url` already encodes the connection info. These are redundant and will fail settings validation if only `DATABASE_URL` is provided (e.g., in a cloud environment). The individual fields should either be `Optional` or `database_url` should be derived from them.

## Patterns to watch in future PRs

- All service `update_*` functions use `exclude_none=True` — this pattern prevents clearing nullable fields. Prefer a sentinel/explicit-unset pattern (e.g., `model_dump(exclude_unset=True)`) in future work.
- `get_member` (with full selectinload) is used inside `update_member` on every update — this is an N+1 setup; fine for Phase 1 scale but watch for it.
- No DB-level cascade rules defined on FK relationships. Delete operations rely entirely on Python-level cascade. If any model is deleted via raw SQL, orphan rows will accumulate.
- `teams.py` router correctly receives `area_id` as a path param from the nested router prefix `/{area_id}/teams` — this is non-obvious and should be preserved.
- `image_service.py` reads the whole file into memory before writing — fine for 5 MB limit, but streams content type from `UploadFile.content_type` header which is user-supplied and not verified against actual magic bytes. A MIME spoofing attack is possible.
