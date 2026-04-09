"""Pydantic schemas for calibration cycles."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class CalibrationCycleCreate(BaseModel):
    label: str
    sequence_number: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool = True
    notes: str | None = None


class CalibrationCycleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    sequence_number: int
    start_date: date | None
    end_date: date | None
    is_active: bool
    notes: str | None
    created_at: datetime
