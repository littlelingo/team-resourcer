from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.program import ProgramListResponse


class ProgramAssignmentCreate(BaseModel):
    member_uuid: UUID
    program_id: int
    role: str | None = None


class ProgramAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    member_uuid: UUID
    program_id: int
    role: str | None
    program: ProgramListResponse
