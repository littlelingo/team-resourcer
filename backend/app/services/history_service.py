from __future__ import annotations

"""Service functions for creating and querying member financial history."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.member_history import MemberHistory


async def create_history_entry(
    db: AsyncSession,
    member_uuid: uuid.UUID,
    field: str,
    value: Decimal,
    effective_date: date,
    notes: str | None = None,
) -> MemberHistory:
    """Create and flush a MemberHistory row."""
    entry = MemberHistory(
        member_uuid=member_uuid,
        field=field,
        value=value,
        effective_date=effective_date,
        notes=notes,
    )
    db.add(entry)
    await db.flush()
    return entry


async def get_member_history(
    db: AsyncSession,
    member_uuid: uuid.UUID,
    field: str | None = None,
) -> list[MemberHistory]:
    """Return history for a member, optionally filtered by field."""
    stmt = select(MemberHistory).where(MemberHistory.member_uuid == member_uuid)
    if field is not None:
        stmt = stmt.where(MemberHistory.field == field)
    stmt = stmt.order_by(MemberHistory.effective_date.desc(), MemberHistory.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())
