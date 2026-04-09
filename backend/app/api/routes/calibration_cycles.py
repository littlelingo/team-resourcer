"""Route handlers for calibration cycles."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.calibration_cycle import CalibrationCycleCreate, CalibrationCycleResponse
from app.services.calibration_cycle_service import create_cycle, list_cycles

router = APIRouter()


@router.get("/", response_model=list[CalibrationCycleResponse])
async def list_cycles_route(db: AsyncSession = Depends(get_db)) -> list[CalibrationCycleResponse]:
    """Return all calibration cycles ordered by sequence_number."""
    return await list_cycles(db)


@router.post("/", response_model=CalibrationCycleResponse, status_code=status.HTTP_201_CREATED)
async def create_cycle_route(
    payload: CalibrationCycleCreate,
    db: AsyncSession = Depends(get_db),
) -> CalibrationCycleResponse:
    """Create a new calibration cycle."""
    return await create_cycle(db, payload)
