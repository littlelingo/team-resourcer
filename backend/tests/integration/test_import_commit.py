from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import selectinload

import app.services.import_session as sess_mod
from app.models.functional_area import FunctionalArea
from app.models.member_history import MemberHistory
from app.models.program import Program
from app.models.program_assignment import ProgramAssignment
from app.models.team import Team
from app.models.team_member import TeamMember
from app.schemas.import_schemas import MappingConfig
from app.services.import_commit import commit_import
from app.services.import_session import create_session


def setup_function(fn):
    sess_mod._sessions.clear()


def teardown_function(fn):
    sess_mod._sessions.clear()


def make_commit_config(sid, col_map):
    return MappingConfig(session_id=sid, column_map=col_map)


async def test_commit_creates_new_member(db_session):
    rows = [{"id": "CI_NEW_001", "fn": "New", "ln": "Person"}]
    sid = create_session(rows, ["id", "fn", "ln"])
    config = make_commit_config(sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name"})
    result = await commit_import(sid, config, db_session)
    assert result.created_count == 1
    assert result.updated_count == 0
    assert result.skipped_count == 0
    row = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_NEW_001"))
    ).scalar_one_or_none()
    assert row is not None
    assert row.first_name == "New"
    assert row.last_name == "Person"


async def test_commit_updates_existing_member(db_session, area):
    member = TeamMember(
        employee_id="CI_UPD_001", first_name="Old", last_name="Name", functional_area_id=area.id
    )
    db_session.add(member)
    await db_session.flush()
    rows = [{"id": "CI_UPD_001", "fn": "New", "ln": "Name"}]
    sid = create_session(rows, ["id", "fn", "ln"])
    config = make_commit_config(sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name"})
    result = await commit_import(sid, config, db_session)
    assert result.created_count == 0
    assert result.updated_count == 1
    updated = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_UPD_001"))
    ).scalar_one()
    assert updated.first_name == "New"
    assert updated.last_name == "Name"


async def test_commit_get_or_create_functional_area(db_session):
    rows = [{"id": "CI_FA_001", "fn": "Person", "ln": "Test", "fa": "NewArea"}]
    sid = create_session(rows, ["id", "fn", "ln", "fa"])
    config = make_commit_config(
        sid,
        {"id": "employee_id", "fn": "first_name", "ln": "last_name", "fa": "functional_area_name"},
    )
    await commit_import(sid, config, db_session)
    area = (
        await db_session.execute(select(FunctionalArea).where(FunctionalArea.name == "NewArea"))
    ).scalar_one_or_none()
    assert area is not None


async def test_commit_get_or_create_team_scoped_by_area(db_session):
    rows = [{"id": "CI_TM_001", "fn": "Person", "ln": "Test", "fa": "AreaX", "tm": "TeamX"}]
    sid = create_session(rows, ["id", "fn", "ln", "fa", "tm"])
    config = make_commit_config(
        sid,
        {
            "id": "employee_id",
            "fn": "first_name",
            "ln": "last_name",
            "fa": "functional_area_name",
            "tm": "team_name",
        },
    )
    await commit_import(sid, config, db_session)
    team = (await db_session.execute(select(Team).where(Team.name == "TeamX"))).scalar_one_or_none()
    assert team is not None
    area = (
        await db_session.execute(select(FunctionalArea).where(FunctionalArea.name == "AreaX"))
    ).scalar_one()
    assert team.functional_area_id == area.id


async def test_commit_supervisor_two_pass_resolved(db_session):
    rows = [
        {"id": "CI_SUP_001", "fn": "Alice", "ln": "Test"},
        {"id": "CI_SUP_002", "fn": "Bob", "ln": "Test", "sup": "CI_SUP_001"},
    ]
    sid = create_session(rows, ["id", "fn", "ln", "sup"])
    config = make_commit_config(
        sid,
        {
            "id": "employee_id",
            "fn": "first_name",
            "ln": "last_name",
            "sup": "supervisor_employee_id",
        },
    )
    await commit_import(sid, config, db_session)
    alice = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_SUP_001"))
    ).scalar_one()
    bob = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_SUP_002"))
    ).scalar_one()
    assert bob.supervisor_id == alice.uuid


async def test_commit_supervisor_cycle_skipped(db_session):
    rows = [
        {"id": "CI_CYC_001", "fn": "Alice", "ln": "Test", "sup": "CI_CYC_002"},
        {"id": "CI_CYC_002", "fn": "Bob", "ln": "Test", "sup": "CI_CYC_001"},
    ]
    sid = create_session(rows, ["id", "fn", "ln", "sup"])
    config = make_commit_config(
        sid,
        {
            "id": "employee_id",
            "fn": "first_name",
            "ln": "last_name",
            "sup": "supervisor_employee_id",
        },
    )
    await commit_import(sid, config, db_session)
    alice = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_CYC_001"))
    ).scalar_one()
    bob = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_CYC_002"))
    ).scalar_one()
    # Mutual A↔B cycle: both links are detected and dropped.
    assert alice.supervisor_id is None and bob.supervisor_id is None, (
        "mutual A↔B cycle: both supervisor links should be dropped"
    )


async def test_commit_duplicate_employee_id_first_wins(db_session):
    rows = [
        {"id": "CI_DUP_001", "fn": "First", "ln": "Test"},
        {"id": "CI_DUP_001", "fn": "Second", "ln": "Test"},
    ]
    sid = create_session(rows, ["id", "fn", "ln"])
    config = make_commit_config(sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name"})
    result = await commit_import(sid, config, db_session)
    assert result.created_count == 1
    member = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_DUP_001"))
    ).scalar_one()
    assert member.first_name == "First"


async def test_commit_session_deleted_after_commit(db_session):
    rows = [{"id": "CI_DEL_001", "fn": "Gone", "ln": "Test"}]
    sid = create_session(rows, ["id", "fn", "ln"])
    config = make_commit_config(sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name"})
    await commit_import(sid, config, db_session)
    assert sid not in sess_mod._sessions


async def test_commit_skips_error_rows(db_session):
    rows = [
        {"id": "CI_ERR_001", "fn": "Valid", "ln": "Test"},
        {"id": "", "fn": "Invalid", "ln": "Test"},
    ]
    sid = create_session(rows, ["id", "fn", "ln"])
    config = make_commit_config(sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name"})
    result = await commit_import(sid, config, db_session)
    assert result.created_count == 1
    assert result.skipped_count == 1


async def test_new_member_salary_no_history(db_session):
    """Importing a new member with salary should NOT create a history entry."""
    rows = [{"id": "CI_SAL_NEW_001", "fn": "Sal", "ln": "New", "sal": "75000"}]
    sid = create_session(rows, ["id", "fn", "ln", "sal"])
    config = make_commit_config(
        sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name", "sal": "salary"}
    )
    result = await commit_import(sid, config, db_session)
    assert result.created_count == 1

    member = (
        await db_session.execute(
            select(TeamMember).where(TeamMember.employee_id == "CI_SAL_NEW_001")
        )
    ).scalar_one()
    assert member.salary == Decimal("75000")

    history = (
        await db_session.execute(
            select(MemberHistory).where(MemberHistory.member_uuid == member.uuid)
        )
    ).scalars().all()
    assert history == []


async def test_existing_member_changed_salary_creates_history(db_session, area):
    """Importing an existing member with a different salary SHOULD create a history entry."""
    member = TeamMember(
        employee_id="CI_SAL_UPD_001",
        first_name="Sal",
        last_name="Upd",
        functional_area_id=area.id,
        salary=Decimal("50000"),
    )
    db_session.add(member)
    await db_session.flush()

    rows = [{"id": "CI_SAL_UPD_001", "fn": "Sal", "ln": "Upd", "sal": "80000"}]
    sid = create_session(rows, ["id", "fn", "ln", "sal"])
    config = make_commit_config(
        sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name", "sal": "salary"}
    )
    result = await commit_import(sid, config, db_session)
    assert result.updated_count == 1

    updated = (
        await db_session.execute(
            select(TeamMember).where(TeamMember.employee_id == "CI_SAL_UPD_001")
        )
    ).scalar_one()
    assert updated.salary == Decimal("80000")

    history = (
        await db_session.execute(
            select(MemberHistory).where(MemberHistory.member_uuid == updated.uuid)
        )
    ).scalars().all()
    assert len(history) == 1
    assert history[0].field == "salary"
    assert history[0].value == Decimal("80000")


async def test_existing_member_same_salary_no_history(db_session, area):
    """Importing an existing member with the same salary should NOT create a history entry."""
    member = TeamMember(
        employee_id="CI_SAL_SAME_001",
        first_name="Sal",
        last_name="Same",
        functional_area_id=area.id,
        salary=Decimal("60000"),
    )
    db_session.add(member)
    await db_session.flush()

    rows = [{"id": "CI_SAL_SAME_001", "fn": "Sal", "ln": "Same", "sal": "60000"}]
    sid = create_session(rows, ["id", "fn", "ln", "sal"])
    config = make_commit_config(
        sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name", "sal": "salary"}
    )
    result = await commit_import(sid, config, db_session)
    assert result.updated_count == 1

    unchanged = (
        await db_session.execute(
            select(TeamMember).where(TeamMember.employee_id == "CI_SAL_SAME_001")
        )
    ).scalar_one()

    history = (
        await db_session.execute(
            select(MemberHistory).where(MemberHistory.member_uuid == unchanged.uuid)
        )
    ).scalars().all()
    assert history == []


# ─── Feature 056: Multi-program member import ─────────────────────────────────


async def test_commit_multi_program_creates_multiple_assignments(db_session):
    """Importing a member with two programs creates two ProgramAssignment rows."""
    rows = [{"id": "MP_001", "fn": "Bob", "ln": "Multi", "pg": "Alpha; Beta"}]
    sid = create_session(rows, ["id", "fn", "ln", "pg"])
    config = make_commit_config(
        sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name", "pg": "program_names"}
    )
    result = await commit_import(sid, config, db_session)
    assert result.created_count == 1

    member = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "MP_001"))
    ).scalar_one()
    assignments = (
        await db_session.execute(
            select(ProgramAssignment).where(ProgramAssignment.member_uuid == member.uuid)
        )
    ).scalars().all()
    assert len(assignments) == 2
    # Verify both programs were created
    program_names_result = set()
    for pa in assignments:
        prog = (
            await db_session.execute(select(Program).where(Program.id == pa.program_id))
        ).scalar_one()
        program_names_result.add(prog.name)
    assert program_names_result == {"Alpha", "Beta"}


async def test_commit_multi_program_replace_semantics_unassigns_dropped_program(db_session, area):
    """Re-importing a member with fewer programs unassigns the dropped ones."""
    # Setup: member already has Alpha and Beta
    member = TeamMember(
        employee_id="MP_REPLACE_001", first_name="Alice", last_name="Rep",
        functional_area_id=area.id,
    )
    db_session.add(member)
    await db_session.flush()

    alpha = Program(name="AlphaReplace")
    beta = Program(name="BetaReplace")
    db_session.add_all([alpha, beta])
    await db_session.flush()

    db_session.add(ProgramAssignment(member_uuid=member.uuid, program_id=alpha.id))
    db_session.add(ProgramAssignment(member_uuid=member.uuid, program_id=beta.id))
    await db_session.flush()

    # Re-import with only Alpha
    rows = [{"id": "MP_REPLACE_001", "fn": "Alice", "ln": "Rep", "pg": "AlphaReplace"}]
    sid = create_session(rows, ["id", "fn", "ln", "pg"])
    config = make_commit_config(
        sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name", "pg": "program_names"}
    )
    await commit_import(sid, config, db_session)

    assignments = (
        await db_session.execute(
            select(ProgramAssignment).where(ProgramAssignment.member_uuid == member.uuid)
        )
    ).scalars().all()
    assert len(assignments) == 1
    remaining_prog = (
        await db_session.execute(select(Program).where(Program.id == assignments[0].program_id))
    ).scalar_one()
    assert remaining_prog.name == "AlphaReplace"


async def test_commit_no_program_column_mapped_preserves_existing_assignments(db_session, area):
    """When program_names is not in the column map, existing assignments are untouched."""
    member = TeamMember(
        employee_id="MP_PRESERVE_001", first_name="Carol", last_name="Pres",
        functional_area_id=area.id,
    )
    db_session.add(member)
    await db_session.flush()

    prog = Program(name="PreserveProgram")
    db_session.add(prog)
    await db_session.flush()
    db_session.add(ProgramAssignment(member_uuid=member.uuid, program_id=prog.id))
    await db_session.flush()

    # Import without mapping program_names column
    rows = [{"id": "MP_PRESERVE_001", "fn": "Carol", "ln": "Pres"}]
    sid = create_session(rows, ["id", "fn", "ln"])
    config = make_commit_config(
        sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name"}
    )
    await commit_import(sid, config, db_session)

    assignments = (
        await db_session.execute(
            select(ProgramAssignment).where(ProgramAssignment.member_uuid == member.uuid)
        )
    ).scalars().all()
    assert len(assignments) == 1, "Existing assignment must be preserved when program_names not mapped"


async def test_commit_program_team_assigned_via_import(db_session):
    """Importing with program_team_names links the program team to the assignment."""
    from app.models.program_team import ProgramTeam

    rows = [
        {
            "id": "MP_PT_001",
            "fn": "Dave",
            "ln": "Team",
            "pg": "TeamProg",
            "pt": "SquadA",
        }
    ]
    sid = create_session(rows, ["id", "fn", "ln", "pg", "pt"])
    config = make_commit_config(
        sid,
        {
            "id": "employee_id",
            "fn": "first_name",
            "ln": "last_name",
            "pg": "program_names",
            "pt": "program_team_names",
        },
    )
    await commit_import(sid, config, db_session)

    member = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "MP_PT_001"))
    ).scalar_one()
    assignment = (
        await db_session.execute(
            select(ProgramAssignment).where(ProgramAssignment.member_uuid == member.uuid)
        )
    ).scalar_one()
    assert assignment.program_team_id is not None
    pt = (
        await db_session.execute(select(ProgramTeam).where(ProgramTeam.id == assignment.program_team_id))
    ).scalar_one()
    assert pt.name == "SquadA"
