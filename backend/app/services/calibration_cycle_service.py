"""CRUD operations for calibration cycles."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calibration_cycle import CalibrationCycle
from app.schemas.calibration_cycle import CalibrationCycleCreate


async def list_cycles(db: AsyncSession) -> list[CalibrationCycle]:
    """Return all cycles ordered by sequence_number ascending."""
    result = await db.execute(
        select(CalibrationCycle).order_by(CalibrationCycle.sequence_number)
    )
    return list(result.scalars().all())


async def get_cycle(db: AsyncSession, cycle_id: int) -> CalibrationCycle | None:
    """Fetch a single cycle by id."""
    result = await db.execute(
        select(CalibrationCycle).where(CalibrationCycle.id == cycle_id)
    )
    return result.scalar_one_or_none()


async def get_or_create_cycle(db: AsyncSession, label: str) -> tuple[CalibrationCycle, bool]:
    """Fetch a cycle by label or create it if it does not exist.

    Race-safe: uses unique constraint + IntegrityError retry, mirroring
    import_commit.py::_get_or_create_program_team pattern.

    Returns (cycle, created) where created is True if a new row was inserted.
    """
    label = label.strip()

    result = await db.execute(
        select(CalibrationCycle).where(CalibrationCycle.label == label)
    )
    cycle = result.scalar_one_or_none()
    if cycle is not None:
        return cycle, False

    # Determine next sequence_number
    seq_result = await db.execute(
        select(func.coalesce(func.max(CalibrationCycle.sequence_number), 0))
    )
    next_seq = (seq_result.scalar() or 0) + 1

    cycle = CalibrationCycle(label=label, sequence_number=next_seq)
    db.add(cycle)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(CalibrationCycle).where(CalibrationCycle.label == label)
        )
        cycle = result.scalar_one()
        return cycle, False

    return cycle, True


async def create_cycle(db: AsyncSession, payload: CalibrationCycleCreate) -> CalibrationCycle:
    """Create a new calibration cycle."""
    data = payload.model_dump()

    if data.get("sequence_number") is None:
        seq_result = await db.execute(
            select(func.coalesce(func.max(CalibrationCycle.sequence_number), 0))
        )
        data["sequence_number"] = (seq_result.scalar() or 0) + 1

    cycle = CalibrationCycle(**data)
    db.add(cycle)
    await db.flush()
    await db.commit()
    # Re-fetch to avoid stale state
    result = await db.execute(
        select(CalibrationCycle).where(CalibrationCycle.label == data["label"])
    )
    return result.scalar_one()
