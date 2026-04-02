"""Pydantic schemas for program create, update, and response."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.agency import AgencyListResponse


class ProgramCreate(BaseModel):
    name: str
    description: str | None = None
    agency_id: int | None = None


class ProgramUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    agency_id: int | None = None


class ProgramResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    agency_id: int | None
    agency: AgencyListResponse | None = None
    member_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProgramListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
