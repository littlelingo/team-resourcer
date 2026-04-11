"""CRUD and analytics operations for calibrations."""

from __future__ import annotations

import uuid

from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.calibration import Calibration
from app.models.calibration_cycle import CalibrationCycle
from app.models.program_assignment import ProgramAssignment
from app.models.team_member import TeamMember
from app.schemas.calibration import CalibrationCreate, CalibrationUpdate


async def get_member_calibrations(
    db: AsyncSession, member_uuid: uuid.UUID
) -> list[Calibration]:
    """Return full calibration history for one member, newest first."""
    result = await db.execute(
        select(Calibration)
        .where(Calibration.member_uuid == member_uuid)
        .options(selectinload(Calibration.cycle))
        .order_by(Calibration.effective_date.desc())
    )
    return list(result.scalars().all())


async def list_latest_calibrations(
    db: AsyncSession,
    area_id: int | None = None,
    team_id: int | None = None,
    program_id: int | None = None,
    cycle_id: int | None = None,
) -> list[Calibration]:
    """Return the latest calibration per member, with optional filters.

    Uses a subquery to find max effective_date per member, then joins back.
    When cycle_id is provided, returns calibrations for that specific cycle only.
    """
    from sqlalchemy import func

    # Build member filter subquery
    member_stmt = select(TeamMember.uuid)
    if area_id is not None:
        member_stmt = member_stmt.where(TeamMember.functional_area_id == area_id)
    if team_id is not None:
        member_stmt = member_stmt.where(TeamMember.team_id == team_id)
    if program_id is not None:
        member_stmt = member_stmt.join(
            ProgramAssignment,
            (ProgramAssignment.member_uuid == TeamMember.uuid)
            & (ProgramAssignment.program_id == program_id),
        )

    if cycle_id is not None:
        # Simple: all calibrations for the specified cycle, filtered by member set
        stmt = (
            select(Calibration)
            .where(
                Calibration.cycle_id == cycle_id,
                Calibration.member_uuid.in_(member_stmt),
            )
            .options(
                selectinload(Calibration.cycle),
                selectinload(Calibration.member).selectinload(TeamMember.functional_area),
                selectinload(Calibration.member).selectinload(TeamMember.team),
            )
            .order_by(Calibration.member_uuid)
        )
    else:
        # Subquery: max effective_date per member
        sub = (
            select(
                Calibration.member_uuid,
                func.max(Calibration.effective_date).label("max_date"),
            )
            .where(Calibration.member_uuid.in_(member_stmt))
            .group_by(Calibration.member_uuid)
            .subquery()
        )
        stmt = (
            select(Calibration)
            .join(
                sub,
                and_(
                    Calibration.member_uuid == sub.c.member_uuid,
                    Calibration.effective_date == sub.c.max_date,
                ),
            )
            .options(
                selectinload(Calibration.cycle),
                selectinload(Calibration.member).selectinload(TeamMember.functional_area),
                selectinload(Calibration.member).selectinload(TeamMember.team),
            )
            .order_by(Calibration.member_uuid)
        )

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_movement(
    db: AsyncSession, from_cycle_id: int, to_cycle_id: int
) -> list[dict]:
    """Return paired (from, to) calibrations for Sankey visualization."""
    # Fetch both sets
    from_result = await db.execute(
        select(Calibration.member_uuid, Calibration.box)
        .where(Calibration.cycle_id == from_cycle_id)
    )
    to_result = await db.execute(
        select(Calibration.member_uuid, Calibration.box)
        .where(Calibration.cycle_id == to_cycle_id)
    )

    from_map = {row.member_uuid: row.box for row in from_result}
    to_map = {row.member_uuid: row.box for row in to_result}

    # Members with calibrations in both cycles
    common = set(from_map) & set(to_map)
    movement = []
    for mu in common:
        movement.append({
            "member_uuid": str(mu),
            "from_box": from_map[mu],
            "to_box": to_map[mu],
        })

    return movement


async def list_trends(db: AsyncSession, last_n_cycles: int = 8) -> list[dict]:
    """Return aggregated box counts per cycle for trend lines."""
    from sqlalchemy import func

    # Get the most recent N cycles by sequence_number
    cycles_result = await db.execute(
        select(CalibrationCycle)
        .order_by(CalibrationCycle.sequence_number.desc())
        .limit(last_n_cycles)
    )
    cycles = list(cycles_result.scalars().all())
    if not cycles:
        return []

    cycle_ids = [c.id for c in cycles]

    counts_result = await db.execute(
        select(
            Calibration.cycle_id,
            Calibration.box,
            func.count(Calibration.id).label("count"),
        )
        .where(Calibration.cycle_id.in_(cycle_ids))
        .group_by(Calibration.cycle_id, Calibration.box)
        .order_by(Calibration.cycle_id, Calibration.box)
    )

    # Build cycle label lookup
    cycle_label = {c.id: c.label for c in cycles}

    rows = counts_result.all()
    return [
        {
            "cycle_id": row.cycle_id,
            "cycle_label": cycle_label.get(row.cycle_id, ""),
            "box": row.box,
            "count": row.count,
        }
        for row in rows
    ]


async def create_calibration(
    db: AsyncSession, member_uuid: uuid.UUID, payload: CalibrationCreate
) -> Calibration:
    """Create or update (upsert) a calibration for a member in a cycle.

    Upserts on (member_uuid, cycle_id): if a row already exists, update it.
    Empty fields in payload are no-ops — they never wipe existing values.
    """
    data = payload.model_dump(exclude_none=True)

    # Try to find existing
    result = await db.execute(
        select(Calibration)
        .where(
            Calibration.member_uuid == member_uuid,
            Calibration.cycle_id == payload.cycle_id,
        )
        .options(selectinload(Calibration.cycle))
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        for key, value in data.items():
            setattr(existing, key, value)
        await db.flush()
        await db.commit()
    else:
        calibration = Calibration(member_uuid=member_uuid, **data)
        db.add(calibration)
        try:
            await db.flush()
            await db.commit()
        except IntegrityError:
            await db.rollback()
            # Race: another request inserted first — fetch and update
            result = await db.execute(
                select(Calibration)
                .where(
                    Calibration.member_uuid == member_uuid,
                    Calibration.cycle_id == payload.cycle_id,
                )
            )
            existing = result.scalar_one()
            for key, value in data.items():
                setattr(existing, key, value)
            await db.flush()
            await db.commit()

    # Always re-fetch with cycle loaded to avoid lazy-load issues
    result = await db.execute(
        select(Calibration)
        .where(
            Calibration.member_uuid == member_uuid,
            Calibration.cycle_id == payload.cycle_id,
        )
        .options(selectinload(Calibration.cycle))
    )
    return result.scalar_one()


async def update_calibration(
    db: AsyncSession, calibration_id: int, payload: CalibrationUpdate
) -> Calibration | None:
    """Update an existing calibration. Returns None if not found."""
    result = await db.execute(
        select(Calibration)
        .where(Calibration.id == calibration_id)
        .options(selectinload(Calibration.cycle))
    )
    calibration = result.scalar_one_or_none()
    if calibration is None:
        return None

    data = payload.model_dump(exclude_none=True)
    for key, value in data.items():
        setattr(calibration, key, value)

    await db.flush()
    await db.commit()

    # Re-fetch with cycle loaded to avoid lazy-load issues after commit
    result = await db.execute(
        select(Calibration)
        .where(Calibration.id == calibration_id)
        .options(selectinload(Calibration.cycle))
    )
    return result.scalar_one_or_none()


async def delete_calibration(db: AsyncSession, calibration_id: int) -> bool:
    """Delete a calibration. Returns True if deleted, False if not found."""
    result = await db.execute(
        select(Calibration).where(Calibration.id == calibration_id)
    )
    calibration = result.scalar_one_or_none()
    if calibration is None:
        return False

    await db.delete(calibration)
    await db.commit()
    return True
