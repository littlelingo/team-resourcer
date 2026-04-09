"""Route handlers for org-level calibration analytics and import resolution."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.calibration import CalibrationResponse
from app.schemas.import_schemas import ResolveAmbiguousRequest, ResolveAmbiguousResult
from app.services.calibration_service import (
    list_latest_calibrations,
    list_movement,
    list_trends,
)
from app.services.import_commit_calibrations import apply_calibration_resolutions

router = APIRouter()


@router.get("/latest", response_model=list[CalibrationResponse])
async def get_latest_calibrations(
    area_id: int | None = Query(None),
    team_id: int | None = Query(None),
    program_id: int | None = Query(None),
    cycle_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[CalibrationResponse]:
    """Return latest calibration per member, with optional filters."""
    return await list_latest_calibrations(
        db,
        area_id=area_id,
        team_id=team_id,
        program_id=program_id,
        cycle_id=cycle_id,
    )


@router.get("/movement")
async def get_movement(
    from_cycle_id: int = Query(..., alias="from"),
    to_cycle_id: int = Query(..., alias="to"),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return paired calibrations for Sankey diagram."""
    return await list_movement(db, from_cycle_id, to_cycle_id)


@router.get("/trends")
async def get_trends(
    cycles: int = Query(8, ge=2, le=20),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return aggregated box counts per cycle for trend lines."""
    return await list_trends(db, last_n_cycles=cycles)


@router.post("/resolve-ambiguous", response_model=ResolveAmbiguousResult)
async def resolve_ambiguous(
    payload: ResolveAmbiguousRequest,
    db: AsyncSession = Depends(get_db),
) -> ResolveAmbiguousResult:
    """Apply manual resolutions for ambiguous calibration import rows."""
    summary = await apply_calibration_resolutions(
        db, payload.cycle_id, payload.resolutions
    )
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return ResolveAmbiguousResult(**summary)
