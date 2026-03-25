from __future__ import annotations

"""CRUD operations and membership management for teams."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.team import Team
from app.models.team_member import TeamMember
from app.schemas.team import TeamCreate, TeamUpdate


async def list_teams(db: AsyncSession, area_id: int | None = None) -> list[Team]:
    """Return all teams, optionally filtered by functional area, with functional_area loaded."""
    stmt = select(Team).options(selectinload(Team.functional_area)).order_by(Team.name)
    if area_id is not None:
        stmt = stmt.where(Team.functional_area_id == area_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_team(db: AsyncSession, team_id: int) -> Team | None:
    """Fetch a single team by ID with functional_area loaded."""
    stmt = select(Team).where(Team.id == team_id).options(selectinload(Team.functional_area))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_team(db: AsyncSession, data: TeamCreate) -> Team:
    """Create a new team."""
    team = Team(**data.model_dump())
    db.add(team)
    await db.commit()
    return await get_team(db, team.id)


async def update_team(db: AsyncSession, team_id: int, data: TeamUpdate) -> Team | None:
    """Update an existing team. Returns None if not found."""
    team = await get_team(db, team_id)
    if team is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(team, field, value)
    await db.commit()
    return await get_team(db, team_id)


async def delete_team(db: AsyncSession, team_id: int) -> bool:
    """Delete a team. Returns True if found and deleted, False otherwise."""
    team = await get_team(db, team_id)
    if team is None:
        return False
    await db.delete(team)
    await db.commit()
    return True


async def add_member_to_team(db: AsyncSession, team_id: int, member_uuid: uuid.UUID) -> bool:
    """Assign a member to a team. Returns True if member found and updated."""
    team = await db.get(Team, team_id)
    if not team:
        return False
    result = await db.execute(select(TeamMember).where(TeamMember.uuid == member_uuid))
    member = result.scalar_one_or_none()
    if member is None:
        return False
    member.team_id = team_id
    await db.commit()
    return True


async def remove_member_from_team(db: AsyncSession, team_id: int, member_uuid: uuid.UUID) -> bool:
    """Remove a member from a team if they belong to it. Returns True if updated."""
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.uuid == member_uuid,
            TeamMember.team_id == team_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        return False
    member.team_id = None
    await db.commit()
    return True
