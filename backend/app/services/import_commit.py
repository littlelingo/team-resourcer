from __future__ import annotations

"""Commit mapped import rows to the database, handling upserts and history."""

import uuid as uuid_mod
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import Agency
from app.models.functional_area import FunctionalArea
from app.models.member_history import MemberHistory
from app.models.program import Program
from app.models.program_assignment import ProgramAssignment
from app.models.team import Team
from app.models.team_member import TeamMember
from app.schemas.import_schemas import CommitResult, MappedRow, MappingConfig
from app.services.import_mapper import apply_mapping
from app.services.import_session import delete_session
from app.services.import_supervisor import resolve_supervisors

_FINANCIAL_FIELDS = ("salary", "bonus", "pto_used")


async def _get_or_create_functional_area(db: AsyncSession, name: str) -> FunctionalArea:
    """Fetch a functional area by name or create it if it does not exist."""
    result = await db.execute(select(FunctionalArea).where(FunctionalArea.name == name))
    area = result.scalar_one_or_none()
    if area is None:
        area = FunctionalArea(name=name)
        db.add(area)
        await db.flush()
    return area


async def _get_or_create_team(db: AsyncSession, name: str, functional_area_id: int | None) -> Team:
    """Fetch a team by name and area or create it if it does not exist."""
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
    """Fetch a program by name or create it if it does not exist."""
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
    """Insert or update a program assignment for a member."""
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
) -> None:
    """Append a MemberHistory record only when an existing member's financial value changes."""
    if new_value is None or new_value == "":
        return
    try:
        new_decimal = Decimal(str(new_value))
    except (ValueError, InvalidOperation):
        return

    existing = getattr(member, field, None)
    if existing is not None and existing != new_decimal:
        entry = MemberHistory(
            member_uuid=member.uuid,
            field=field,
            value=new_decimal,
            effective_date=date.today(),
            notes="Imported",
        )
        db.add(entry)
        await db.flush()


def _dedup_rows(valid_rows: list[MappedRow], dedup_field: str) -> list[MappedRow]:
    """Deduplicate rows by a field value; first occurrence wins."""
    seen: set[str] = set()
    deduped: list[MappedRow] = []
    for row in valid_rows:
        val = str(row.data.get(dedup_field, "")).strip()
        if val in seen:
            continue
        seen.add(val)
        deduped.append(row)
    return deduped


async def _commit_agencies(db: AsyncSession, rows: list[MappedRow]) -> tuple[int, int]:
    """Upsert agencies by name. Returns (created, updated)."""
    created = updated = 0
    for row in rows:
        name = str(row.data.get("name", "")).strip()
        if not name:
            continue
        result = await db.execute(select(Agency).where(Agency.name == name))
        agency = result.scalar_one_or_none()
        if agency is None:
            agency = Agency(name=name)
            db.add(agency)
            created += 1
        else:
            updated += 1
        desc = row.data.get("description")
        if desc is not None and desc != "":
            agency.description = str(desc)
        await db.flush()
    return created, updated


async def _commit_areas(db: AsyncSession, rows: list[MappedRow]) -> tuple[int, int]:
    """Upsert functional areas by name. Returns (created, updated)."""
    created = updated = 0
    for row in rows:
        name = str(row.data.get("name", "")).strip()
        if not name:
            continue
        result = await db.execute(select(FunctionalArea).where(FunctionalArea.name == name))
        area = result.scalar_one_or_none()
        if area is None:
            area = FunctionalArea(name=name)
            db.add(area)
            created += 1
        else:
            updated += 1
        desc = row.data.get("description")
        if desc is not None and desc != "":
            area.description = str(desc)
        await db.flush()
    return created, updated


async def _commit_programs(db: AsyncSession, rows: list[MappedRow]) -> tuple[int, int]:
    """Upsert programs by name. Returns (created, updated)."""
    created = updated = 0
    for row in rows:
        name = str(row.data.get("name", "")).strip()
        if not name:
            continue
        result = await db.execute(select(Program).where(Program.name == name))
        program = result.scalar_one_or_none()
        if program is None:
            program = Program(name=name)
            db.add(program)
            created += 1
        else:
            updated += 1
        desc = row.data.get("description")
        if desc is not None and desc != "":
            program.description = str(desc)
        # Resolve agency by name (lookup-only — do not create)
        agency_name = row.data.get("agency_name")
        if agency_name:
            agency_result = await db.execute(
                select(Agency).where(Agency.name == str(agency_name).strip())
            )
            found_agency = agency_result.scalar_one_or_none()
            if found_agency is not None:
                program.agency_id = found_agency.id
        await db.flush()
    return created, updated


async def _commit_teams(db: AsyncSession, rows: list[MappedRow]) -> tuple[int, int]:
    """Upsert teams by (name, area). Returns (created, updated)."""
    created = updated = 0
    for row in rows:
        name = str(row.data.get("name", "")).strip()
        if not name:
            continue
        fa_name = row.data.get("functional_area_name")
        functional_area_id: int | None = None
        if fa_name:
            area = await _get_or_create_functional_area(db, str(fa_name))
            functional_area_id = area.id

        if functional_area_id is None:
            area = await _get_or_create_functional_area(db, "Unassigned")
            functional_area_id = area.id

        result = await db.execute(
            select(Team).where(Team.name == name, Team.functional_area_id == functional_area_id)
        )
        team = result.scalar_one_or_none()
        if team is None:
            team = Team(name=name, functional_area_id=functional_area_id)
            db.add(team)
            created += 1
        else:
            updated += 1
        desc = row.data.get("description")
        if desc is not None and desc != "":
            team.description = str(desc)
        await db.flush()
    return created, updated


async def _commit_members(
    db: AsyncSession,
    deduped_valid: list[MappedRow],
    error_rows: list[MappedRow],
) -> tuple[int, int]:
    """Upsert members with FK resolution and history. Returns (created, updated)."""
    created_count = 0
    updated_count = 0
    employee_id_to_uuid: dict[str, uuid_mod.UUID] = {}

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
            if functional_area_id is None:
                area = await _get_or_create_functional_area(db, "Unassigned")
                functional_area_id = area.id

            member = TeamMember(
                employee_id=emp_id,
                first_name=str(data.get("first_name", "")),
                last_name=str(data.get("last_name", "")),
                functional_area_id=functional_area_id,
            )
            db.add(member)
            await db.flush()
            created_count += 1
        else:
            updated_count += 1

        employee_id_to_uuid[emp_id] = member.uuid

        scalar_fields = [
            "first_name",
            "last_name",
            "title",
            "city",
            "state",
            "email",
            "phone",
            "slack_handle",
        ]
        for f in scalar_fields:
            val = data.get(f)
            if val is not None and val != "":
                setattr(member, f, str(val))

        hire_date_val = data.get("hire_date")
        if hire_date_val and hire_date_val != "":
            try:
                member.hire_date = date.fromisoformat(str(hire_date_val))
            except ValueError:
                pass  # Already caught at preview validation stage

        if functional_area_id is not None:
            member.functional_area_id = functional_area_id
        if team_id is not None:
            member.team_id = team_id

        for fin_field in _FINANCIAL_FIELDS:
            val = data.get(fin_field)
            if val is not None and val != "":
                await _append_history_if_changed(db, member, fin_field, val)
                setattr(member, fin_field, Decimal(str(val)))

        await db.flush()

        if program is not None:
            role = data.get("program_role")
            await _upsert_program_assignment(
                db, member.uuid, program.id, str(role) if role else None
            )

    # Second pass: resolve supervisor_employee_id FKs
    await resolve_supervisors(db, deduped_valid, employee_id_to_uuid, error_rows)

    return created_count, updated_count


async def _commit_financial_history(
    db: AsyncSession,
    rows: list[MappedRow],
    error_rows: list[MappedRow],
    field_name: str,
) -> tuple[int, int]:
    """Import financial history rows for salary, bonus, or pto_used. Returns (created, 0)."""
    # Build employee_id lookup
    emp_ids = [str(r.data.get("employee_id", "")).strip() for r in rows]
    emp_ids = [e for e in emp_ids if e]
    result = await db.execute(select(TeamMember).where(TeamMember.employee_id.in_(emp_ids)))
    members = result.scalars().all()
    emp_lookup: dict[str, TeamMember] = {m.employee_id: m for m in members}

    created_count = 0
    # Track which member+date+amount combos we just inserted to update scalar later
    affected: dict[str, list[tuple[date, Decimal]]] = {}

    for row in rows:
        data = row.data
        emp_id = str(data.get("employee_id", "")).strip()

        if emp_id not in emp_lookup:
            row.errors.append(f"No member found with employee_id '{emp_id}'")
            error_rows.append(row)
            continue

        member = emp_lookup[emp_id]

        # Parse amount
        try:
            amount = Decimal(str(data.get("amount", "")))
        except InvalidOperation:
            row.errors.append(f"'amount' could not be parsed as a number.")
            error_rows.append(row)
            continue

        # Parse effective_date
        try:
            eff_date = date.fromisoformat(str(data.get("effective_date", "")))
        except ValueError:
            row.errors.append(f"'effective_date' could not be parsed as ISO date.")
            error_rows.append(row)
            continue

        notes_val = data.get("notes") or None

        # Dedup check: skip if identical record already exists
        existing_result = await db.execute(
            select(MemberHistory).where(
                MemberHistory.member_uuid == member.uuid,
                MemberHistory.field == field_name,
                MemberHistory.value == amount,
                MemberHistory.effective_date == eff_date,
            )
        )
        if existing_result.scalar_one_or_none() is not None:
            continue

        entry = MemberHistory(
            member_uuid=member.uuid,
            field=field_name,
            value=amount,
            effective_date=eff_date,
            notes=notes_val,
        )
        db.add(entry)
        created_count += 1

        if emp_id not in affected:
            affected[emp_id] = []
        affected[emp_id].append((eff_date, amount))

    await db.flush()

    # Scalar update pass: set member.field to the amount at the max effective_date
    for emp_id, imported_entries in affected.items():
        member = emp_lookup[emp_id]
        max_result = await db.execute(
            select(func.max(MemberHistory.effective_date)).where(
                MemberHistory.member_uuid == member.uuid,
                MemberHistory.field == field_name,
            )
        )
        max_date = max_result.scalar_one_or_none()
        if max_date is not None:
            # Check if the max date is one we just imported
            matching = [amt for (d, amt) in imported_entries if d == max_date]
            if matching:
                setattr(member, field_name, matching[-1])

    return created_count, 0


async def commit_import(
    session_id: str,
    mapping_config: MappingConfig,
    db: AsyncSession,
) -> CommitResult:
    """Apply mapping, validate rows, and write valid rows to the database.

    Dispatches to entity-specific commit logic based on mapping_config.entity_type.
    After commit, the session is deleted.
    """
    mapped_result = apply_mapping(session_id, mapping_config)

    valid_rows = [r for r in mapped_result.rows if not r.errors]
    error_rows = [r for r in mapped_result.rows if r.errors]

    entity_type = mapping_config.entity_type
    from app.services.import_mapper import ENTITY_CONFIGS

    dedup_field = ENTITY_CONFIGS[entity_type].dedup_field
    if dedup_field is not None:
        deduped_valid = _dedup_rows(valid_rows, dedup_field)
        dedup_skipped = len(valid_rows) - len(deduped_valid)
    else:
        deduped_valid = valid_rows
        dedup_skipped = 0

    if entity_type == "area":
        created, updated = await _commit_areas(db, deduped_valid)
    elif entity_type == "program":
        created, updated = await _commit_programs(db, deduped_valid)
    elif entity_type == "team":
        created, updated = await _commit_teams(db, deduped_valid)
    elif entity_type == "agency":
        created, updated = await _commit_agencies(db, deduped_valid)
    elif entity_type == "salary_history":
        created, updated = await _commit_financial_history(db, deduped_valid, error_rows, "salary")
    elif entity_type == "bonus_history":
        created, updated = await _commit_financial_history(db, deduped_valid, error_rows, "bonus")
    elif entity_type == "pto_history":
        created, updated = await _commit_financial_history(
            db, deduped_valid, error_rows, "pto_used"
        )
    else:
        created, updated = await _commit_members(db, deduped_valid, error_rows)

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    delete_session(session_id)

    return CommitResult(
        created_count=created,
        updated_count=updated,
        skipped_count=len(error_rows) + dedup_skipped,
        error_rows=error_rows,
    )
