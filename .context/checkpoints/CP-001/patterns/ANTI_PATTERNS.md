# Anti-Patterns

Anti-patterns observed directly in the codebase with file:line evidence. Only patterns with
concrete evidence are listed. This file was last validated during the feature 057 pass
(2026-04-09).

---

## Implementation Anti-Patterns

### AP-001: `from __future__ import annotations` placed before the module docstring

**Don't**: Place `from __future__ import annotations` on line 1, then the module docstring on line 3.
**Do**: Module docstring first, then `from __future__ import annotations`.
**Why**: PEP 257 requires the module docstring to be the first statement in a file. `from __future__ import annotations` is a future-import and must appear after the docstring per PEP 236. Placing it before the docstring triggers ruff rule E402 warnings.

**Evidence** (36 files affected — representative sample):
```
backend/app/models/team_member.py   line 1: from __future__ import annotations
                                    line 3: """SQLAlchemy model for the team_members table."""

backend/app/services/member_service.py  line 1: from __future__ import annotations
                                         line 3: """CRUD operations for team members…"""

backend/app/services/import_commit.py  line 1: from __future__ import annotations
                                        line 3: """Commit mapped import rows…"""

backend/app/models/calibration.py      line 1: from __future__ import annotations
                                        line 3: """SQLAlchemy model for the calibrations table."""
```

This affects all 36 Python files that use `from __future__ import annotations` — the pattern
was established early and propagated uniformly. The current ordering is harmless at runtime
but inconsistent with PEP 257 and triggers lint warnings.

**Scope**: project-wide; tracked as existing tech debt in HEALTH.md (2026-04-08 note).

---

### AP-002: ORM → Pydantic response return type annotation mismatch in route handlers

**Don't**: Annotate a route handler as `-> list[TeamMemberListResponse]` when the service returns `list[TeamMember]` (ORM objects).
**Do**: Either (a) have the service return Pydantic instances, or (b) annotate the handler with the ORM type and rely on `response_model=` for FastAPI's runtime serialisation.
**Why**: FastAPI's `response_model=` parameter handles serialisation correctly at runtime, so the API behaves as expected. But mypy sees the annotation mismatch — the route function doesn't actually return Pydantic instances, it returns ORM instances that FastAPI coerces. The mismatch is invisible today because `strict = false` in `pyproject.toml`, but it will break if strict mode is ever enabled.

**Evidence**:
```python
# backend/app/api/routes/members.py lines 29-37
@router.get("/", response_model=list[TeamMemberListResponse])
async def list_members_route(...) -> list[TeamMemberListResponse]:
    return await list_members(db, ...)   # list_members returns list[TeamMember] (ORM)

# backend/app/api/routes/teams.py lines 32-37
@teams_top_router.get("/", response_model=list[TeamListResponse])
async def list_all_teams_route(...) -> list[TeamListResponse]:
    return await list_teams(db)          # list_teams returns list[Team] (ORM)
```

**Scope**: affects most GET list and GET detail route handlers; propagated to new routes
including feature 056 and 057 (noted in HEALTH.md as a pre-existing pattern). Not a
regression in any individual feature.

---

### AP-003: Triplicated inline constants mirroring backend data

**Don't**: Define the same `BOX_LABELS: Record<number, string>` (or similar backend-mirroring constant) inline in multiple frontend component files.
**Do**: Extract to exactly one `constants.ts` in the feature directory, with a docstring pointing at the canonical backend source file.
**Why**: In feature 057, three calibration widgets each defined their own `BOX_LABELS` inline. Within the same PR, two of the three diverged from each other AND from the backend's canonical labels — and one widget swapped "Consistent Star" from box 1 to box 7, completely changing the taxonomy users would see. Drift between duplicates is a near-certainty given enough time.

**Rule of thumb**: three identical inline constants across files is the smell that should trigger the extraction. Anything user-visible that corresponds to backend data belongs in `<feature>/constants.ts` with an inline comment referencing the backend source (e.g., `backend/app/schemas/calibration.py::BOX_LABELS`).

**Evidence**: caught during feature 057 code review. Fix is in `frontend/src/components/calibration/widgets/constants.ts` (single source of truth) with `NineBoxGrid.tsx`, `MovementSankey.tsx`, and `MarginalBars.tsx` importing from it.

---

### AP-004: Gating replace-semantics on "key in dict" instead of "bool(value)"

**Don't**: In an import pipeline that supports replace semantics (rows not in the incoming set are deleted), decide whether to run the delete loop via `"field" in data`.
**Do**: Gate the delete loop on `bool(data.get("field"))` — treat empty/blank/None as "no-op", treat non-empty as "authoritative set this list".
**Why**: An empty list `[]` and an unmapped column look identical in the payload dict, but they mean opposite things to the user:
- **Unmapped**: "I'm not touching this field in this import." → preserve all existing values.
- **Mapped-but-empty**: "This member happens to have no values in my source data." → almost always a data hole, not an authoritative empty set.

Treating both as "preserve" is the safe default. Gating on `key in dict` incorrectly treats the empty-cell case as "user authoritatively wants to wipe the list", silently mass-deleting every existing assignment for that row.

**Evidence**: caught during feature 056 code review (multi-program member import). Fix is to change the gate from `"program_ids" in data` to `bool(data.get("program_ids"))`. See `backend/app/services/import_commit_members.py` for the corrected pattern.

**Related**: if you really need to express "authoritatively clear this list" at import time, use a dedicated "clear all" column rather than overloading an empty cell.
