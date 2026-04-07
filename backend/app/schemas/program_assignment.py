"""Pydantic schemas for program assignment create and response."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.program import ProgramListResponse
from app.schemas.program_team import ProgramTeamListResponse


class ProgramAssignmentCreate(BaseModel):
    member_uuid: UUID
    program_id: int
    role: str | None = None


class ProgramAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    member_uuid: UUID
    program_id: int
    role: str | None
    program: ProgramListResponse | None = None
    program_team: ProgramTeamListResponse | None = None
