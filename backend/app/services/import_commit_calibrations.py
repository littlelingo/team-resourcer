"""Commit mapped calibration rows to the database with ambiguity detection."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.calibration import Calibration
from app.models.team_member import TeamMember
from app.schemas.import_schemas import MappedRow
from app.services.calibration_cycle_service import get_or_create_cycle


async def _commit_calibrations(
    db: AsyncSession,
    rows: list[MappedRow],
) -> dict[str, Any]:
    """Commit calibration rows to the database.

    Member matching is name-only (no employee_id). Rows with 0 or 2+ matches
    are bucketed as unmatched or ambiguous rather than inserted.

    Returns a summary dict with created, updated, and bucket lists.
    """
    created_calibrations = 0
    updated_calibrations = 0
    created_cycles = 0
    unmatched_rows: list[dict[str, Any]] = []
    ambiguous_rows: list[dict[str, Any]] = []

    # Cache cycles by label to avoid N+1 lookups
    cycle_cache: dict[str, tuple[Any, bool]] = {}

    for row in rows:
        data = row.data
        first_name = str(data.get("first_name", "")).strip()
        last_name = str(data.get("last_name", "")).strip()
        cycle_label = str(data.get("cycle_label", "")).strip()

        # Resolve cycle (get-or-create, race-safe)
        if cycle_label not in cycle_cache:
            cycle, was_created = await get_or_create_cycle(db, cycle_label)
            cycle_cache[cycle_label] = (cycle, was_created)
            if was_created:
                created_cycles += 1
        cycle_obj, _ = cycle_cache[cycle_label]
        cycle_id = cycle_obj.id

        # Member lookup: scalars().all() — never scalar_one_or_none()
        result = await db.execute(
            select(TeamMember).where(
                TeamMember.first_name == first_name,
                TeamMember.last_name == last_name,
            )
        )
        candidates = result.scalars().all()

        if len(candidates) == 0:
            unmatched_rows.append({
                "row_index": row.index,
                "first_name": first_name,
                "last_name": last_name,
            })
            continue

        if len(candidates) > 1:
            # Ambiguous: surface all candidates with identifying context
            candidate_list = []
            for c in candidates:
                # Load area for context
                area_result = await db.execute(
                    select(TeamMember)
                    .where(TeamMember.uuid == c.uuid)
                    .options(
                        selectinload(TeamMember.functional_area),
                        selectinload(TeamMember.team),
                    )
                )
                c_loaded = area_result.scalar_one()
                area_label = c_loaded.functional_area.name if c_loaded.functional_area else ""
                team_label = c_loaded.team.name if c_loaded.team else ""
                hire_label = str(c_loaded.hire_date) if c_loaded.hire_date else ""
                candidate_list.append({
                    "uuid": str(c.uuid),
                    "label": f"{c.first_name} {c.last_name} — {area_label}/{team_label}".strip(
                        " —/"
                    )
                    + (f" / Hired {hire_label}" if hire_label else ""),
                    "area": area_label,
                    "team": team_label,
                    "hire_date": hire_label,
                })
            ambiguous_rows.append({
                "row_index": row.index,
                "first_name": first_name,
                "last_name": last_name,
                "candidates": candidate_list,
                "row_data": dict(data),
                "cycle_id": cycle_id,
            })
            continue

        # Single match — proceed to upsert
        member = candidates[0]
        created, updated = await _upsert_calibration_row(db, member.uuid, cycle_id, data)
        created_calibrations += created
        updated_calibrations += updated

    return {
        "created_calibrations": created_calibrations,
        "updated_calibrations": updated_calibrations,
        "created_cycles": created_cycles,
        "unmatched_rows": unmatched_rows,
        "ambiguous_rows": ambiguous_rows,
    }


async def _upsert_calibration_row(
    db: AsyncSession,
    member_uuid: Any,
    cycle_id: int,
    data: dict[str, Any],
) -> tuple[int, int]:
    """Upsert a single calibration row. Returns (created, updated) counts."""
    # Parse box
    try:
        box = int(data.get("box", 0))
    except (ValueError, TypeError):
        return 0, 0

    # Parse effective_date
    eff_date_raw = data.get("effective_date", "")
    if eff_date_raw:
        try:
            eff_date = date.fromisoformat(str(eff_date_raw))
        except ValueError:
            eff_date = date.today()
    else:
        eff_date = date.today()

    # Build field set — empty values are no-op (upsert semantics)
    fields: dict[str, Any] = {
        "box": box,
        "effective_date": eff_date,
    }
    for field_name in (
        "reviewers",
        "high_growth_or_key_talent",
        "ready_for_promotion",
        "can_mentor_juniors",
        "next_move_recommendation",
        "rationale",
    ):
        val = data.get(field_name)
        if val is not None and str(val).strip():
            fields[field_name] = str(val).strip()

    # Check for existing row
    result = await db.execute(
        select(Calibration).where(
            Calibration.member_uuid == member_uuid,
            Calibration.cycle_id == cycle_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        for k, v in fields.items():
            setattr(existing, k, v)
        await db.flush()
        return 0, 1

    # Use a SAVEPOINT so a race-loss only rolls back this single insert,
    # NOT the entire batch loop. Without this, an insert collision on row N
    # would discard all flushed work from rows 1..N-1 in the same batch.
    try:
        async with db.begin_nested():
            calibration = Calibration(member_uuid=member_uuid, cycle_id=cycle_id, **fields)
            db.add(calibration)
            await db.flush()
        return 1, 0
    except IntegrityError:
        # Savepoint auto-rolled back; outer batch transaction intact.
        # Re-fetch the row the racing transaction inserted and update it.
        result = await db.execute(
            select(Calibration).where(
                Calibration.member_uuid == member_uuid,
                Calibration.cycle_id == cycle_id,
            )
        )
        existing = result.scalar_one()
        for k, v in fields.items():
            setattr(existing, k, v)
        await db.flush()
        return 0, 1


async def apply_calibration_resolutions(
    db: AsyncSession,
    cycle_id: int,
    resolutions: list[dict[str, Any]],
) -> dict[str, int]:
    """Apply manual resolutions for ambiguous calibration rows.

    Each resolution has {member_uuid: str, row_data: {...}}.
    Returns created/updated counts.
    """
    import uuid as _uuid

    created_total = 0
    updated_total = 0

    for resolution in resolutions:
        raw_uuid = resolution.get("member_uuid", "")
        row_data = resolution.get("row_data", {})
        try:
            member_uuid = _uuid.UUID(str(raw_uuid))
        except ValueError:
            continue

        created, updated = await _upsert_calibration_row(db, member_uuid, cycle_id, row_data)
        created_total += created
        updated_total += updated

    return {"created_calibrations": created_total, "updated_calibrations": updated_total}
