"""Preview helpers for the import pipeline."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.program_assignment import ProgramAssignment
from app.models.team_member import TeamMember
from app.schemas.import_schemas import MappedRow


async def compute_unassignments_for_rows(
    db: AsyncSession,
    rows: list[MappedRow],
) -> None:
    """Annotate each mapped member row with programs that would be unassigned on commit.

    Mutates rows in-place, setting row.unassignments to a list of program names
    that would be removed (existing assignments not present in the incoming
    program_names list). Only runs when program_names is mapped on the row.
    """
    # Collect unique employee_ids that have program_names mapped
    employee_ids = [
        str(row.data.get("employee_id", "")).strip()
        for row in rows
        if "program_names" in row.data and not row.errors
    ]
    if not employee_ids:
        return

    # Load existing members with their program assignments
    stmt = (
        select(TeamMember)
        .where(TeamMember.employee_id.in_(employee_ids))
        .options(
            selectinload(TeamMember.program_assignments).selectinload(ProgramAssignment.program)
        )
    )
    result = await db.execute(stmt)
    members = result.scalars().all()
    member_map: dict[str, TeamMember] = {m.employee_id: m for m in members}

    for row in rows:
        if "program_names" not in row.data or row.errors:
            continue

        emp_id = str(row.data.get("employee_id", "")).strip()
        member = member_map.get(emp_id)
        if member is None:
            # New member — no existing assignments to unassign
            continue

        # Case-sensitive match — mirrors _get_or_create_program in import_commit.py.
        # If commit becomes case-insensitive, update both sides together.
        incoming_names: set[str] = set(row.data["program_names"] or [])  # type: ignore[arg-type]
        to_unassign = [
            pa.program.name
            for pa in member.program_assignments
            if pa.program is not None and pa.program.name not in incoming_names
        ]
        if to_unassign:
            row.unassignments = to_unassign
