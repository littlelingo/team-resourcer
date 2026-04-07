"""Commit mapped import rows to the database, handling upserts and history."""

from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import Agency
from app.models.functional_area import FunctionalArea
from app.models.member_history import MemberHistory
from app.models.program import Program
from app.models.program_assignment import ProgramAssignment
from app.models.program_team import ProgramTeam
from app.models.team import Team
from app.models.team_member import TeamMember
from app.schemas.import_schemas import CommitResult, MappedRow, MappingConfig
from app.services.import_mapper import apply_mapping
from app.services.import_session import delete_session

# Keep in sync with: import_mapper.py numeric_fields, frontend HISTORY_FIELD_STYLES
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


async def _get_or_create_program_team(
    db: AsyncSession, program_id: int, name: str
) -> ProgramTeam:
    """Fetch a program team by (program_id, name) or create it if it does not exist.

    Concurrency: defended by the unique constraint on (program_id, name); on a
    race we catch IntegrityError and re-fetch.
    """
    from sqlalchemy.exc import IntegrityError

    result = await db.execute(
        select(ProgramTeam).where(ProgramTeam.program_id == program_id, ProgramTeam.name == name)
    )
    program_team = result.scalar_one_or_none()
    if program_team is not None:
        return program_team
    program_team = ProgramTeam(program_id=program_id, name=name)
    db.add(program_team)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(ProgramTeam).where(
                ProgramTeam.program_id == program_id, ProgramTeam.name == name
            )
        )
        program_team = result.scalar_one()
    return program_team


async def _upsert_program_assignment(
    db: AsyncSession,
    member_uuid: Any,
    program_id: int,
    role: str | None,
    program_team_id: int | None = None,
) -> None:
    """Insert or update a program assignment for a member.

    program_team_id is written unconditionally on update (None clears it).
    Callers from the import path should pass the desired final value.
    """
    result = await db.execute(
        select(ProgramAssignment).where(
            ProgramAssignment.member_uuid == member_uuid,
            ProgramAssignment.program_id == program_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        assignment = ProgramAssignment(
            member_uuid=member_uuid,
            program_id=program_id,
            role=role,
            program_team_id=program_team_id,
        )
        db.add(assignment)
    else:
        if role is not None:
            assignment.role = role
        assignment.program_team_id = program_team_id
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
    from app.services.import_commit_members import _commit_financial_history, _commit_members
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
