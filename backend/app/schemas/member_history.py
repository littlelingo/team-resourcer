"""Pydantic schemas for member financial history."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HistoryFieldEnum(str, Enum):
    salary = "salary"
    bonus = "bonus"
    pto_used = "pto_used"


class MemberHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_uuid: UUID
    field: str
    value: Decimal
    effective_date: date
    notes: str | None
    created_at: datetime
