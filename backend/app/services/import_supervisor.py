from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team_member import TeamMember
from app.schemas.import_schemas import MappedRow


def _has_cycle(start: Any, target: Any, mapping: dict[Any, Any]) -> bool:
    """Walk up the proposed chain from `start`; return True if `target` is reached."""
    visited: set[Any] = set()
    current = start
    while current is not None:
        if current in visited:
            break
        visited.add(current)
        current = mapping.get(current)
        if current == target:
            return True
    return False


async def resolve_supervisors(
    db: AsyncSession,
    deduped_valid: list[MappedRow],
    employee_id_to_uuid: dict[str, Any],
    error_rows: list[MappedRow],
) -> None:
    """Resolve supervisor_employee_id FKs with cycle detection.

    Modifies `error_rows` in place for rows that would create cycles.
    """
    proposed_supervisor: dict[Any, Any] = {}

    for row in deduped_valid:
        data = row.data
        sup_emp_id = data.get("supervisor_employee_id")
        if not sup_emp_id:
            continue
        sup_emp_id_str = str(sup_emp_id).strip()
        emp_id = str(data.get("employee_id", "")).strip()
        member_uuid = employee_id_to_uuid.get(emp_id)
        if member_uuid is None:
            continue

        sup_uuid = employee_id_to_uuid.get(sup_emp_id_str)
        if sup_uuid is None:
            sup_result = await db.execute(
                select(TeamMember).where(TeamMember.employee_id == sup_emp_id_str)
            )
            sup_member = sup_result.scalar_one_or_none()
            if sup_member is not None:
                sup_uuid = sup_member.uuid

        if sup_uuid is None:
            continue

        if sup_uuid == member_uuid:
            continue

        proposed_supervisor[member_uuid] = sup_uuid

    for member_uuid, sup_uuid in proposed_supervisor.items():
        if _has_cycle(sup_uuid, member_uuid, proposed_supervisor):
            cycle_row = next(
                (
                    r
                    for r in deduped_valid
                    if employee_id_to_uuid.get(str(r.data.get("employee_id", "")).strip())
                    == member_uuid
                ),
                None,
            )
            if cycle_row is not None:
                error_rows.append(cycle_row)
            continue

        mem_result = await db.execute(select(TeamMember).where(TeamMember.uuid == member_uuid))
        member = mem_result.scalar_one_or_none()
        if member is not None:
            member.supervisor_id = sup_uuid
            await db.flush()
