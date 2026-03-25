"""Pydantic schemas for program create, update, and response."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProgramCreate(BaseModel):
    name: str
    description: str | None = None


class ProgramUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProgramResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class ProgramListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
