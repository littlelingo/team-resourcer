import re
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.functional_area import FunctionalAreaListResponse
from app.schemas.member_history import MemberHistoryResponse
from app.schemas.program_assignment import ProgramAssignmentResponse
from app.schemas.team import TeamListResponse

_EMAIL_RE = re.compile(r"^[^@]+@[^@]+\.[^@]+$")


class TeamMemberCreate(BaseModel):
    employee_id: str
    name: str
    title: str | None = None
    location: str | None = None
    email: str | None = None
    phone: str | None = None
    slack_handle: str | None = None
    salary: Decimal | None = None
    bonus: Decimal | None = None
    pto_used: Decimal | None = None
    functional_area_id: int
    team_id: int | None = None
    supervisor_id: UUID | None = None

    @field_validator("employee_id")
    @classmethod
    def employee_id_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("employee_id must not be empty")
        return v

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str | None) -> str | None:
        if v is not None and not _EMAIL_RE.match(v):
            raise ValueError("Invalid email format")
        return v


class TeamMemberUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    location: str | None = None
    email: str | None = None
    phone: str | None = None
    slack_handle: str | None = None
    salary: Decimal | None = None
    bonus: Decimal | None = None
    pto_used: Decimal | None = None
    functional_area_id: int | None = None
    team_id: int | None = None
    supervisor_id: UUID | None = None

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str | None) -> str | None:
        if v is not None and not _EMAIL_RE.match(v):
            raise ValueError("Invalid email format")
        return v


class TeamMemberListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: UUID
    employee_id: str
    name: str
    title: str | None
    location: str | None
    image_path: str | None
    email: str | None
    slack_handle: str | None
    functional_area_id: int
    team_id: int | None


class TeamMemberDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: UUID
    employee_id: str
    name: str
    title: str | None
    location: str | None
    image_path: str | None
    email: str | None
    slack_handle: str | None
    functional_area_id: int
    team_id: int | None
    phone: str | None
    salary: Decimal | None
    bonus: Decimal | None
    pto_used: Decimal | None
    supervisor_id: UUID | None
    functional_area: FunctionalAreaListResponse | None
    team: TeamListResponse | None
    program_assignments: list[ProgramAssignmentResponse]
    history: list[MemberHistoryResponse]
    created_at: datetime
    updated_at: datetime
