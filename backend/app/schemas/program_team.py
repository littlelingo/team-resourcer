"""Pydantic schemas for program team create, update, and response."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProgramTeamCreate(BaseModel):
    name: str
    description: str | None = None
    lead_id: UUID | None = None


class ProgramTeamUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    lead_id: UUID | None = None


class ProgramTeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    program_id: int
    lead_id: UUID | None
    member_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProgramTeamListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    program_id: int
