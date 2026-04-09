"""Sub-resource route handlers for per-member calibrations."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.calibration import CalibrationCreate, CalibrationResponse, CalibrationUpdate
from app.services.calibration_service import (
    create_calibration,
    delete_calibration,
    get_member_calibrations,
    update_calibration,
)

router = APIRouter()


@router.get("/", response_model=list[CalibrationResponse])
async def get_member_calibrations_route(
    member_uuid: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[CalibrationResponse]:
    """Return full calibration history for one member."""
    return await get_member_calibrations(db, member_uuid)


@router.post("/", response_model=CalibrationResponse, status_code=status.HTTP_201_CREATED)
async def create_calibration_route(
    member_uuid: UUID,
    payload: CalibrationCreate,
    db: AsyncSession = Depends(get_db),
) -> CalibrationResponse:
    """Create or upsert a calibration for a member."""
    return await create_calibration(db, member_uuid, payload)


@router.put("/{calibration_id}", response_model=CalibrationResponse)
async def update_calibration_route(
    member_uuid: UUID,
    calibration_id: int,
    payload: CalibrationUpdate,
    db: AsyncSession = Depends(get_db),
) -> CalibrationResponse:
    """Update an existing calibration."""
    calibration = await update_calibration(db, calibration_id, payload)
    if calibration is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calibration not found")
    return calibration


@router.delete("/{calibration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calibration_route(
    member_uuid: UUID,
    calibration_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a calibration."""
    deleted = await delete_calibration(db, calibration_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calibration not found")
