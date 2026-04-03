from __future__ import annotations

"""CRUD operations and member management for program teams."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.program import Program
from app.models.program_assignment import ProgramAssignment
from app.models.program_team import ProgramTeam
from app.models.team_member import TeamMember
from app.schemas.program_team import ProgramTeamCreate, ProgramTeamUpdate


async def list_program_teams(db: AsyncSession, program_id: int) -> list[ProgramTeam]:
    """Return all teams for a program with assignment counts."""
    stmt = (
        select(ProgramTeam)
        .where(ProgramTeam.program_id == program_id)
        .options(selectinload(ProgramTeam.assignments))
        .order_by(ProgramTeam.name)
    )
    result = await db.execute(stmt)
    teams = list(result.scalars().all())
    for t in teams:
        t.member_count = len(t.assignments)  # type: ignore[attr-defined]
    return teams


async def get_program_team(db: AsyncSession, program_team_id: int) -> ProgramTeam | None:
    """Fetch a single program team by ID with assignments loaded."""
    stmt = (
        select(ProgramTeam)
        .where(ProgramTeam.id == program_team_id)
        .options(selectinload(ProgramTeam.assignments))
    )
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()
    if team is not None:
        team.member_count = len(team.assignments)  # type: ignore[attr-defined]
    return team


async def create_program_team(
    db: AsyncSession, data: ProgramTeamCreate, program_id: int
) -> ProgramTeam:
    """Create a new program team. Raises ValueError if program not found."""
    program = await db.get(Program, program_id)
    if program is None:
        raise ValueError("Program not found")
    team = ProgramTeam(**data.model_dump(), program_id=program_id)
    db.add(team)
    await db.commit()
    return await get_program_team(db, team.id)  # type: ignore[return-value]


async def update_program_team(
    db: AsyncSession, program_team_id: int, data: ProgramTeamUpdate
) -> ProgramTeam | None:
    """Update an existing program team. Returns None if not found."""
    team = await get_program_team(db, program_team_id)
    if team is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(team, field, value)
    await db.commit()
    return await get_program_team(db, program_team_id)


async def delete_program_team(db: AsyncSession, program_team_id: int) -> bool:
    """Delete a program team. Returns True if found and deleted, False otherwise."""
    team = await get_program_team(db, program_team_id)
    if team is None:
        return False
    # Unlink assignments before deleting (FK has no ON DELETE SET NULL)
    for assignment in team.assignments:
        assignment.program_team_id = None
    await db.delete(team)
    await db.commit()
    return True


async def add_member_to_program_team(
    db: AsyncSession, program_team_id: int, member_uuid: uuid.UUID
) -> bool:
    """
    Add a member to a program team.

    Auto-creates a ProgramAssignment if the member isn't assigned to the program yet.
    Returns True if successful, False if the team is not found.
    """
    team = await db.get(ProgramTeam, program_team_id)
    if team is None:
        return False

    # Verify the member exists
    member = await db.get(TeamMember, member_uuid)
    if member is None:
        return False

    # Check if assignment already exists
    stmt = select(ProgramAssignment).where(
        ProgramAssignment.member_uuid == member_uuid,
        ProgramAssignment.program_id == team.program_id,
    )
    result = await db.execute(stmt)
    assignment = result.scalar_one_or_none()

    if assignment is None:
        # Auto-create the program assignment
        assignment = ProgramAssignment(
            member_uuid=member_uuid,
            program_id=team.program_id,
        )
        db.add(assignment)

    assignment.program_team_id = program_team_id
    await db.commit()
    return True


async def remove_member_from_program_team(
    db: AsyncSession, program_team_id: int, member_uuid: uuid.UUID
) -> bool:
    """
    Remove a member from a program team by setting program_team_id to None.

    Keeps the program assignment intact. Returns True if updated, False if not found.
    """
    stmt = select(ProgramAssignment).where(
        ProgramAssignment.member_uuid == member_uuid,
        ProgramAssignment.program_team_id == program_team_id,
    )
    result = await db.execute(stmt)
    assignment = result.scalar_one_or_none()
    if assignment is None:
        return False
    assignment.program_team_id = None
    await db.commit()
    return True
