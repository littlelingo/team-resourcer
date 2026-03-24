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
    rows = [{"id": "CI_NEW_001", "nm": "New Person"}]
    sid = create_session(rows, ["id", "nm"])
    config = make_commit_config(sid, {"id": "employee_id", "nm": "name"})
    result = await commit_import(sid, config, db_session)
    assert result.created_count == 1
    assert result.updated_count == 0
    assert result.skipped_count == 0
    row = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_NEW_001"))
    ).scalar_one_or_none()
    assert row is not None
    assert row.name == "New Person"


async def test_commit_updates_existing_member(db_session, area):
    member = TeamMember(employee_id="CI_UPD_001", name="Old Name", functional_area_id=area.id)
    db_session.add(member)
    await db_session.flush()
    rows = [{"id": "CI_UPD_001", "nm": "New Name"}]
    sid = create_session(rows, ["id", "nm"])
    config = make_commit_config(sid, {"id": "employee_id", "nm": "name"})
    result = await commit_import(sid, config, db_session)
    assert result.created_count == 0
    assert result.updated_count == 1
    updated = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_UPD_001"))
    ).scalar_one()
    assert updated.name == "New Name"


async def test_commit_get_or_create_functional_area(db_session):
    rows = [{"id": "CI_FA_001", "nm": "Person", "fa": "NewArea"}]
    sid = create_session(rows, ["id", "nm", "fa"])
    config = make_commit_config(
        sid, {"id": "employee_id", "nm": "name", "fa": "functional_area_name"}
    )
    await commit_import(sid, config, db_session)
    area = (
        await db_session.execute(select(FunctionalArea).where(FunctionalArea.name == "NewArea"))
    ).scalar_one_or_none()
    assert area is not None


async def test_commit_get_or_create_team_scoped_by_area(db_session):
    rows = [{"id": "CI_TM_001", "nm": "Person", "fa": "AreaX", "tm": "TeamX"}]
    sid = create_session(rows, ["id", "nm", "fa", "tm"])
    config = make_commit_config(
        sid, {"id": "employee_id", "nm": "name", "fa": "functional_area_name", "tm": "team_name"}
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
        {"id": "CI_SUP_001", "nm": "Alice"},
        {"id": "CI_SUP_002", "nm": "Bob", "sup": "CI_SUP_001"},
    ]
    sid = create_session(rows, ["id", "nm", "sup"])
    config = make_commit_config(
        sid, {"id": "employee_id", "nm": "name", "sup": "supervisor_employee_id"}
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
        {"id": "CI_CYC_001", "nm": "Alice", "sup": "CI_CYC_002"},
        {"id": "CI_CYC_002", "nm": "Bob", "sup": "CI_CYC_001"},
    ]
    sid = create_session(rows, ["id", "nm", "sup"])
    config = make_commit_config(
        sid, {"id": "employee_id", "nm": "name", "sup": "supervisor_employee_id"}
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
        {"id": "CI_DUP_001", "nm": "First"},
        {"id": "CI_DUP_001", "nm": "Second"},
    ]
    sid = create_session(rows, ["id", "nm"])
    config = make_commit_config(sid, {"id": "employee_id", "nm": "name"})
    result = await commit_import(sid, config, db_session)
    assert result.created_count == 1
    member = (
        await db_session.execute(select(TeamMember).where(TeamMember.employee_id == "CI_DUP_001"))
    ).scalar_one()
    assert member.name == "First"


async def test_commit_session_deleted_after_commit(db_session):
    rows = [{"id": "CI_DEL_001", "nm": "Gone"}]
    sid = create_session(rows, ["id", "nm"])
    config = make_commit_config(sid, {"id": "employee_id", "nm": "name"})
    await commit_import(sid, config, db_session)
    assert sid not in sess_mod._sessions


async def test_commit_skips_error_rows(db_session):
    rows = [
        {"id": "CI_ERR_001", "nm": "Valid"},
        {"id": "", "nm": "Invalid"},
    ]
    sid = create_session(rows, ["id", "nm"])
    config = make_commit_config(sid, {"id": "employee_id", "nm": "name"})
    result = await commit_import(sid, config, db_session)
    assert result.created_count == 1
    assert result.skipped_count == 1
