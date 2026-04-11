# SQLAlchemy (async, 2.x)

> Last updated: 2026-04-09
> Source: Discovered during feature 057 (member calibration) implementation and validation.

## Quirks & Gotchas

### ORM `cascade="all, delete-orphan"` silently bypasses DB `ON DELETE RESTRICT`

When the database FK uses `ON DELETE RESTRICT` to make a parent table append-only (calibration cycles, audit logs, immutable reference tables), the ORM relationship must NOT use `cascade="all, delete-orphan"`. SQLAlchemy's cascade runs **before** the database FK constraint — it deletes child rows in Python, then issues the parent DELETE, and the FK never has a chance to fire. The "RESTRICT" safety net silently does nothing.

The fix is `cascade="save-update, merge"` + `passive_deletes=True`, which tells SQLAlchemy "don't touch the children — let the database decide." Now the FK fires and the parent DELETE raises `IntegrityError`, which is what RESTRICT was supposed to do all along.

**Rule of thumb**: grep the codebase for `cascade="all, delete-orphan"` next to a FK with `ondelete="RESTRICT"`. That combination is always wrong.

First encountered in feature 057's `CalibrationCycle` model. Caught by code review and fixed pre-commit (see `backend/app/models/calibration_cycle.py`).

### `db.rollback()` inside a batch loop discards unrelated work

When a `get_or_create` helper is called from inside a batch loop (e.g., processing 100 CSV rows), the race-loss handler must NOT use `await db.rollback()`. That call discards the **entire** transaction's flushed work, including rows 1..N-1 that the loop already processed successfully. The next `db.commit()` would re-issue all the inserts and potentially hit more race losses.

Use a **SAVEPOINT** instead — see Patterns We Use below.

## Workarounds

**Problem**: `MissingGreenlet` raised by Pydantic serialization of a lazy-loaded relationship in an async context.
**Fix**: Eager-load every relationship referenced in the response schema via `selectinload` in the service query. If `TeamMemberDetailResponse` exposes `calibrations`, then `get_member()` must chain `selectinload(TeamMember.calibrations).selectinload(Calibration.cycle)`.
**Why**: Async SQLAlchemy cannot issue a lazy-load SQL statement from inside Pydantic's sync attribute access — the greenlet that bridges sync/async is not available during serialization. The fix is to load everything upfront so Pydantic only touches Python attributes.

## Patterns We Use

### Savepoint pattern for race-safe `get_or_create`

```python
try:
    async with db.begin_nested():
        thing = Thing(...)
        db.add(thing)
        await db.flush()
    return thing
except IntegrityError:
    # SAVEPOINT auto-rolled back; outer transaction (including earlier
    # batch work) is preserved.
    result = await db.execute(select(Thing).where(...))
    return result.scalar_one()
```

The DB issues a `SAVEPOINT` before the flush and `ROLLBACK TO SAVEPOINT` on exception — so only the racing insert is reverted, not the entire transaction. The outer batch's prior work survives, and the eventual `db.commit()` is a single atomic write of all successful rows.

**Project-wide locations** (post-feature 057 refactor):
- `backend/app/services/import_commit.py::_get_or_create_program_team`
- `backend/app/services/calibration_cycle_service.py::get_or_create_cycle`
- `backend/app/services/import_commit_calibrations.py::_upsert_calibration_row`

**Not yet using savepoints** (vulnerable to race-loss but don't lose batch work because they don't catch `IntegrityError` at all): `_get_or_create_functional_area`, `_get_or_create_team`, `_get_or_create_program` in `import_commit.py`. Follow-up refactor opportunity — requires adding unique constraints first where absent.

### Eager-load chains for detail responses

The canonical pattern is in `member_service.py::get_member`:

```python
stmt = select(TeamMember).where(TeamMember.uuid == uuid).options(
    selectinload(TeamMember.functional_area),
    selectinload(TeamMember.team),
    selectinload(TeamMember.supervisor),
    selectinload(TeamMember.functional_manager),
    selectinload(TeamMember.history),
    selectinload(TeamMember.program_assignments).selectinload(ProgramAssignment.program),
    selectinload(TeamMember.program_assignments).selectinload(ProgramAssignment.program_team),
    selectinload(TeamMember.calibrations).selectinload(Calibration.cycle),
)
```

**Rule**: every relationship exposed on the Pydantic response schema needs a corresponding `selectinload`. Missing one = `MissingGreenlet` at runtime, only during serialization.

## Version Notes

Using SQLAlchemy 2.x async API (`sqlalchemy.ext.asyncio`). `Mapped[...]` / `mapped_column(...)` declarative style throughout. No legacy 1.x query API in this project.
