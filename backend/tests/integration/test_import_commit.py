from sqlalchemy import select

import app.services.import_session as sess_mod
from app.models.functional_area import FunctionalArea
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
