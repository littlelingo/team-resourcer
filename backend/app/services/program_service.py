from __future__ import annotations

"""CRUD operations for programs and program-member assignments."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.program import Program
from app.models.program_assignment import ProgramAssignment
from app.models.team_member import TeamMember
from app.schemas.program import ProgramCreate, ProgramUpdate
from app.schemas.program_assignment import ProgramAssignmentCreate


async def list_programs(db: AsyncSession) -> list[Program]:
    """Return all programs ordered by name."""
    result = await db.execute(
        select(Program).options(selectinload(Program.agency)).order_by(Program.name)
    )
    return list(result.scalars().all())


async def get_program(db: AsyncSession, program_id: int) -> Program | None:
    """Fetch a single program by ID."""
    result = await db.execute(
        select(Program).options(selectinload(Program.agency)).where(Program.id == program_id)
    )
    return result.scalar_one_or_none()


async def create_program(db: AsyncSession, data: ProgramCreate) -> Program:
    """Create a new program."""
    program = Program(**data.model_dump())
    db.add(program)
    await db.commit()
    await db.refresh(program)
    result = await db.execute(
        select(Program).options(selectinload(Program.agency)).where(Program.id == program.id)
    )
    return result.scalar_one()


async def update_program(db: AsyncSession, program_id: int, data: ProgramUpdate) -> Program | None:
    """Update an existing program. Returns None if not found."""
    program = await get_program(db, program_id)
    if program is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(program, field, value)
    await db.commit()
    await db.refresh(program)
    result = await db.execute(
        select(Program).options(selectinload(Program.agency)).where(Program.id == program.id)
    )
    return result.scalar_one()


async def delete_program(db: AsyncSession, program_id: int) -> bool:
    """Delete a program. Returns True if found and deleted, False otherwise."""
    program = await get_program(db, program_id)
    if program is None:
        return False
    await db.delete(program)
    await db.commit()
    return True


async def get_program_members(db: AsyncSession, program_id: int) -> list[TeamMember]:
    """Return all members assigned to a program."""
    stmt = (
        select(TeamMember)
        .join(
            ProgramAssignment,
            (ProgramAssignment.member_uuid == TeamMember.uuid)
            & (ProgramAssignment.program_id == program_id),
        )
        .options(
            selectinload(TeamMember.functional_area),
            selectinload(TeamMember.team),
            selectinload(TeamMember.program_assignments).selectinload(
                ProgramAssignment.program
            ),
        )
        .order_by(TeamMember.first_name, TeamMember.last_name)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def assign_member(
    db: AsyncSession, program_id: int, data: ProgramAssignmentCreate
) -> ProgramAssignment:
    """Assign a member to a program, or update their role if already assigned (upsert)."""
    program = await get_program(db, program_id)
    if not program:
        raise ValueError(f"Program {program_id} not found")

    member = await db.get(TeamMember, data.member_uuid)
    if not member:
        raise ValueError(f"Member {data.member_uuid} not found")

    result = await db.execute(
        select(ProgramAssignment).where(
            ProgramAssignment.program_id == program_id,
            ProgramAssignment.member_uuid == data.member_uuid,
        )
    )
    assignment = result.scalar_one_or_none()
    if assignment is not None:
        assignment.role = data.role
    else:
        assignment = ProgramAssignment(
            program_id=program_id,
            member_uuid=data.member_uuid,
            role=data.role,
        )
        db.add(assignment)
    await db.commit()
    # Re-query with eager loading to avoid lazy-load in async response serialization
    result = await db.execute(
        select(ProgramAssignment)
        .where(
            ProgramAssignment.program_id == program_id,
            ProgramAssignment.member_uuid == data.member_uuid,
        )
        .options(selectinload(ProgramAssignment.program))
    )
    return result.scalar_one()


async def unassign_member(db: AsyncSession, program_id: int, member_uuid: uuid.UUID) -> bool:
    """Remove a member's assignment from a program. Returns True if found and removed."""
    result = await db.execute(
        select(ProgramAssignment).where(
            ProgramAssignment.program_id == program_id,
            ProgramAssignment.member_uuid == member_uuid,
        )
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        return False
    await db.delete(assignment)
    await db.commit()
    return True
