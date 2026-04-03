"""Pydantic schemas for agency create, update, and response."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AgencyCreate(BaseModel):
    name: str
    description: str | None = None


class AgencyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class AgencyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    member_count: int = 0
    created_at: datetime
    updated_at: datetime


class AgencyListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    member_count: int = 0
