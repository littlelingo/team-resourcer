"""Pydantic schemas for team create, update, and response."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.functional_area import FunctionalAreaListResponse


class TeamCreate(BaseModel):
    name: str
    description: str | None = None
    lead_id: UUID | None = None


class TeamUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    functional_area_id: int | None = None
    lead_id: UUID | None = None


class TeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    functional_area_id: int
    lead_id: UUID | None
    functional_area: FunctionalAreaListResponse | None
    member_count: int = 0
    created_at: datetime
    updated_at: datetime


class TeamMemberAddResponse(BaseModel):
    ok: bool


class TeamListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    functional_area_id: int
