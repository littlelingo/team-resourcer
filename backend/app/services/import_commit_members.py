"""Commit handlers for member and financial history imports."""

from __future__ import annotations

import uuid as uuid_mod
from datetime import date
from decimal import Decimal, InvalidOperation

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.member_history import MemberHistory
from app.models.program import Program
from app.models.program_assignment import ProgramAssignment
from app.models.team_member import TeamMember
from app.schemas.import_schemas import MappedRow
from app.services.import_commit import (
    _FINANCIAL_FIELDS,
    _append_history_if_changed,
    _get_or_create_functional_area,
    _get_or_create_program,
    _get_or_create_program_team,
    _get_or_create_team,
    _upsert_program_assignment,
)
from app.services.import_supervisor import resolve_supervisors


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

        # Resolve Programs (multi-program support)
        # program_names is a list[str] after mapper normalization, or absent if not mapped
        program_names_raw = data.get("program_names")
        program_team_names_raw = data.get("program_team_names")
        # Treat an empty/blank program_names cell as "no change" rather than mass-delete.
        # Only mapped-AND-non-empty triggers replace semantics.
        programs_mapped = bool(program_names_raw)

        resolved_programs: list[tuple[Program, str | None]] = []
        if program_names_raw:
            program_names_list: list[str] = program_names_raw  # type: ignore[assignment]
            # Build aligned team-name list; pad with None if program_team_names not mapped
            if program_team_names_raw:
                team_names_list: list[str | None] = list(program_team_names_raw)  # type: ignore[assignment]
            else:
                team_names_list = [None] * len(program_names_list)

            for prog_name, team_name in zip(program_names_list, team_names_list):
                if not prog_name:
                    continue
                prog = await _get_or_create_program(db, prog_name)
                resolved_programs.append((prog, team_name if team_name else None))

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

        # `member` is non-None at this point: either freshly created in the
        # `if is_new` branch, or fetched as a non-None row in the `else` branch
        # (is_new = member is None). The assert narrows the type for mypy.
        assert member is not None
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

        if programs_mapped:
            # program_names column was mapped — apply upserts and replace semantics
            role = data.get("program_role")
            role_str = str(role) if role else None
            incoming_program_ids: set[int] = set()

            for prog, team_name in resolved_programs:
                incoming_program_ids.add(prog.id)
                # Resolve or create program team if team_name supplied
                pt_id: int | None = None
                if team_name:
                    pt = await _get_or_create_program_team(db, prog.id, team_name)
                    pt_id = pt.id
                await _upsert_program_assignment(db, member.uuid, prog.id, role_str, pt_id)

            # Replace semantics: delete assignments for programs NOT in incoming set
            existing_result = await db.execute(
                select(ProgramAssignment).where(
                    ProgramAssignment.member_uuid == member.uuid
                )
            )
            existing_assignments = existing_result.scalars().all()
            for existing_pa in existing_assignments:
                if existing_pa.program_id not in incoming_program_ids:
                    await db.delete(existing_pa)
            await db.flush()

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
            row.errors.append("'amount' could not be parsed as a number.")
            error_rows.append(row)
            continue

        # Parse effective_date
        try:
            eff_date = date.fromisoformat(str(data.get("effective_date", "")))
        except ValueError:
            row.errors.append("'effective_date' could not be parsed as ISO date.")
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
