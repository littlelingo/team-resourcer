"""Pydantic schemas for team member create, update, and response."""

import re
from datetime import date, datetime
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
    first_name: str
    last_name: str
    hire_date: date | None = None
    title: str | None = None
    city: str | None = None
    state: str | None = None
    email: str | None = None
    phone: str | None = None
    slack_handle: str | None = None
    salary: Decimal | None = None
    bonus: Decimal | None = None
    pto_used: Decimal | None = None
    functional_area_id: int
    team_id: int | None = None
    supervisor_id: UUID | None = None
    functional_manager_id: UUID | None = None

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
        if v is not None and not _EMAIL_RE.fullmatch(v):
            raise ValueError("Invalid email format")
        return v


class TeamMemberUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    hire_date: date | None = None
    title: str | None = None
    city: str | None = None
    state: str | None = None
    email: str | None = None
    phone: str | None = None
    slack_handle: str | None = None
    salary: Decimal | None = None
    bonus: Decimal | None = None
    pto_used: Decimal | None = None
    functional_area_id: int | None = None
    team_id: int | None = None
    supervisor_id: UUID | None = None
    functional_manager_id: UUID | None = None

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str | None) -> str | None:
        if v is not None and not _EMAIL_RE.fullmatch(v):
            raise ValueError("Invalid email format")
        return v


class ImageUploadResponse(BaseModel):
    image_path: str


class TeamMemberListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: UUID
    employee_id: str
    first_name: str
    last_name: str
    title: str | None
    city: str | None
    state: str | None
    image_path: str | None
    email: str | None
    slack_handle: str | None
    functional_area_id: int
    team_id: int | None
    supervisor_name: str | None = None
    functional_manager_name: str | None = None


class MemberRefResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: UUID
    first_name: str
    last_name: str


class TeamMemberDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: UUID
    employee_id: str
    first_name: str
    last_name: str
    hire_date: date | None
    title: str | None
    city: str | None
    state: str | None
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
    functional_manager_id: UUID | None
    supervisor: MemberRefResponse | None = None
    functional_manager: MemberRefResponse | None = None
    functional_area: FunctionalAreaListResponse | None
    team: TeamListResponse | None
    program_assignments: list[ProgramAssignmentResponse]
    history: list[MemberHistoryResponse]
    created_at: datetime
    updated_at: datetime
