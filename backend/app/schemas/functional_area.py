"""Pydantic schemas for functional area create, update, and response."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FunctionalAreaCreate(BaseModel):
    name: str
    description: str | None = None


class FunctionalAreaUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class FunctionalAreaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class FunctionalAreaListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
