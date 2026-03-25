from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.functional_area import FunctionalArea
from app.models.member_history import MemberHistory
from app.models.program import Program
from app.models.program_assignment import ProgramAssignment
from app.models.team import Team
from app.models.team_member import TeamMember
from app.schemas.import_schemas import CommitResult, MappedRow, MappingConfig
from app.services.import_mapper import apply_mapping
from app.services.import_session import delete_session

_FINANCIAL_FIELDS = ("salary", "bonus", "pto_used")


async def _get_or_create_functional_area(db: AsyncSession, name: str) -> FunctionalArea:
    result = await db.execute(select(FunctionalArea).where(FunctionalArea.name == name))
    area = result.scalar_one_or_none()
    if area is None:
        area = FunctionalArea(name=name)
        db.add(area)
        await db.flush()
    return area


async def _get_or_create_team(db: AsyncSession, name: str, functional_area_id: int | None) -> Team:
    if functional_area_id is None:
        # Need at least a placeholder area — create/fetch one called "Unassigned"
        area = await _get_or_create_functional_area(db, "Unassigned")
        functional_area_id = area.id

    result = await db.execute(
        select(Team).where(Team.name == name, Team.functional_area_id == functional_area_id)
    )
    team = result.scalar_one_or_none()
    if team is None:
        team = Team(name=name, functional_area_id=functional_area_id)
        db.add(team)
        await db.flush()
    return team


async def _get_or_create_program(db: AsyncSession, name: str) -> Program:
    result = await db.execute(select(Program).where(Program.name == name))
    program = result.scalar_one_or_none()
    if program is None:
        program = Program(name=name)
        db.add(program)
        await db.flush()
    return program


async def _upsert_program_assignment(
    db: AsyncSession, member_uuid: Any, program_id: int, role: str | None
) -> None:
    result = await db.execute(
        select(ProgramAssignment).where(
            ProgramAssignment.member_uuid == member_uuid,
            ProgramAssignment.program_id == program_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        assignment = ProgramAssignment(member_uuid=member_uuid, program_id=program_id, role=role)
        db.add(assignment)
    elif role is not None:
        assignment.role = role
    await db.flush()


async def _append_history_if_changed(
    db: AsyncSession,
    member: TeamMember,
    field: str,
    new_value: Any,
    is_new: bool,
) -> None:
    """Append a MemberHistory record if the financial value changed (or member is new)."""
    if new_value is None or new_value == "":
        return
    try:
        new_decimal = Decimal(str(new_value))
    except Exception:
        return

    existing = getattr(member, field, None)
    if is_new or existing != new_decimal:
        entry = MemberHistory(
            member_uuid=member.uuid,
            field=field,
            value=new_decimal,
            effective_date=date.today(),
            notes="Imported",
        )
        db.add(entry)
        await db.flush()


async def commit_import(
    session_id: str,
    mapping_config: MappingConfig,
    db: AsyncSession,
) -> CommitResult:
    """Apply mapping, validate rows, and write valid rows to the database.

    Rows with errors are skipped. Rows with only warnings are imported.
    After commit, the session is deleted.

    Args:
        session_id: The import session token.
        mapping_config: Column mapping configuration.
        db: Async database session.

    Returns:
        CommitResult with created/updated/skipped counts and error rows.
    """
    mapped_result = apply_mapping(session_id, mapping_config)

    valid_rows = [r for r in mapped_result.rows if not r.errors]
    error_rows = [r for r in mapped_result.rows if r.errors]

    # Deduplicate by employee_id (first occurrence wins)
    seen_employee_ids: set[str] = set()
    deduped_valid: list[MappedRow] = []
    for row in valid_rows:
        emp_id = str(row.data.get("employee_id", "")).strip()
        if emp_id in seen_employee_ids:
            continue
        seen_employee_ids.add(emp_id)
        deduped_valid.append(row)

    created_count = 0
    updated_count = 0

    # First pass: upsert all members (without supervisor resolution)
    # Track employee_id -> uuid for second pass
    employee_id_to_uuid: dict[str, Any] = {}

    for row in deduped_valid:
        data = row.data
        emp_id = str(data.get("employee_id", "")).strip()

        # Resolve FunctionalArea
        fa_name = data.get("functional_area_name")
        functional_area_id: int | None = None
        if fa_name:
            area = await _get_or_create_functional_area(db, str(fa_name))
            functional_area_id = area.id

        # Resolve Team
        team_name = data.get("team_name")
        team_id: int | None = None
        if team_name:
            team = await _get_or_create_team(db, str(team_name), functional_area_id)
            team_id = team.id

        # Resolve Program
        program_name = data.get("program_name")
        program: Program | None = None
        if program_name:
            program = await _get_or_create_program(db, str(program_name))

        # Look up existing member by employee_id
        result = await db.execute(select(TeamMember).where(TeamMember.employee_id == emp_id))
        member = result.scalar_one_or_none()
        is_new = member is None

        if is_new:
            # For new members, functional_area_id is required
            if functional_area_id is None:
                area = await _get_or_create_functional_area(db, "Unassigned")
                functional_area_id = area.id

            member = TeamMember(
                employee_id=emp_id,
                name=str(data.get("name", "")),
                functional_area_id=functional_area_id,
            )
            db.add(member)
            await db.flush()
            created_count += 1
        else:
            updated_count += 1

        employee_id_to_uuid[emp_id] = member.uuid

        # Update scalar fields (only non-blank values)
        scalar_fields = [
            "name",
            "title",
            "location",
            "email",
            "phone",
            "slack_handle",
        ]
        for f in scalar_fields:
            val = data.get(f)
            if val is not None and val != "":
                setattr(member, f, str(val))

        # Update FK fields
        if functional_area_id is not None:
            member.functional_area_id = functional_area_id
        if team_id is not None:
            member.team_id = team_id

        # Financial fields with history
        for fin_field in _FINANCIAL_FIELDS:
            val = data.get(fin_field)
            if val is not None and val != "":
                await _append_history_if_changed(db, member, fin_field, val, is_new)
                setattr(member, fin_field, Decimal(str(val)))

        await db.flush()

        # Program assignment
        if program is not None:
            role = data.get("program_role")
            await _upsert_program_assignment(
                db, member.uuid, program.id, str(role) if role else None
            )

    # Second pass: resolve supervisor_employee_id FKs
    # Build the full proposed supervisor map before writing, then detect cycles.
    proposed_supervisor: dict[Any, Any] = {}  # member_uuid -> sup_uuid

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

        # Guard against self-reference
        sup_uuid = employee_id_to_uuid.get(sup_emp_id_str)
        if sup_uuid is None:
            # Try the database
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

    def _has_cycle(start: Any, target: Any, mapping: dict[Any, Any]) -> bool:
        """Walk up the proposed chain from `start`; return True if `target` is reached."""
        visited = set()
        current = start
        while current is not None:
            if current in visited:
                break
            visited.add(current)
            current = mapping.get(current)
            if current == target:
                return True
        return False

    for member_uuid, sup_uuid in proposed_supervisor.items():
        # Detect cycle: if walking up from sup_uuid ever reaches member_uuid, skip.
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

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    delete_session(session_id)

    return CommitResult(
        created_count=created_count,
        updated_count=updated_count,
        skipped_count=len(error_rows),
        error_rows=error_rows,
    )
