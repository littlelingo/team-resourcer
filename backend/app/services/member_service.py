from __future__ import annotations

"""CRUD operations for team members with financial history tracking."""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.program_assignment import ProgramAssignment
from app.models.team_member import TeamMember
from app.schemas.team_member import TeamMemberCreate, TeamMemberUpdate
from app.services.history_service import create_history_entry

_FINANCIAL_FIELDS = ("salary", "bonus", "pto_used")


async def list_members(
    db: AsyncSession,
    program_id: int | None = None,
    area_id: int | None = None,
    team_id: int | None = None,
) -> list[TeamMember]:
    """List members with optional filters (AND logic), ordered by name."""
    stmt = (
        select(TeamMember)
        .options(
            selectinload(TeamMember.functional_area),
            selectinload(TeamMember.team),
        )
        .order_by(TeamMember.name)
    )
    if area_id is not None:
        stmt = stmt.where(TeamMember.functional_area_id == area_id)
    if team_id is not None:
        stmt = stmt.where(TeamMember.team_id == team_id)
    if program_id is not None:
        stmt = stmt.join(
            ProgramAssignment,
            (ProgramAssignment.member_uuid == TeamMember.uuid)
            & (ProgramAssignment.program_id == program_id),
        )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_member(
    db: AsyncSession,
    member_uuid: uuid.UUID,
) -> TeamMember | None:
    """Fetch a single member with all relationships loaded."""
    stmt = (
        select(TeamMember)
        .where(TeamMember.uuid == member_uuid)
        .options(
            selectinload(TeamMember.functional_area),
            selectinload(TeamMember.team),
            selectinload(TeamMember.supervisor),
            selectinload(TeamMember.history),
            selectinload(TeamMember.program_assignments).selectinload(ProgramAssignment.program),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_member(db: AsyncSession, data: TeamMemberCreate) -> TeamMember:
    """Create a member and record initial history entries for financial fields."""
    member = TeamMember(**data.model_dump())
    db.add(member)
    await db.flush()

    today = date.today()
    for field in _FINANCIAL_FIELDS:
        value = getattr(data, field, None)
        if value is not None:
            await create_history_entry(db, member.uuid, field, value, today)

    await db.commit()
    return await get_member(db, member.uuid)


async def update_member(
    db: AsyncSession,
    member_uuid: uuid.UUID,
    data: TeamMemberUpdate,
) -> TeamMember | None:
    """Update a member, recording history for any changed financial fields."""
    member = await get_member(db, member_uuid)
    if member is None:
        return None

    today = date.today()
    update_data = data.model_dump(exclude_unset=True)

    # Record history for changed financial fields
    for field in _FINANCIAL_FIELDS:
        incoming = update_data.get(field)
        if incoming is not None and incoming != getattr(member, field):
            await create_history_entry(db, member.uuid, field, incoming, today)

    # Apply all set fields
    for field, value in update_data.items():
        setattr(member, field, value)

    await db.commit()
    return await get_member(db, member_uuid)


async def delete_member(db: AsyncSession, member_uuid: uuid.UUID) -> bool:
    """Delete a member. Returns True if found and deleted, False otherwise."""
    result = await db.execute(select(TeamMember).where(TeamMember.uuid == member_uuid))
    member = result.scalar_one_or_none()
    if member is None:
        return False
    await db.delete(member)
    await db.commit()
    return True
