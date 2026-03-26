from datetime import date
from decimal import Decimal

from app.models.member_history import MemberHistory
from app.models.team_member import TeamMember


async def test_get_history_empty(client, area, db_session):
    m = TeamMember(
        employee_id="HIST001", first_name="No", last_name="History", functional_area_id=area.id
    )
    db_session.add(m)
    await db_session.flush()
    resp = await client.get(f"/api/members/{m.uuid}/history/")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_history_returns_entries(client, area, db_session):
    m = TeamMember(
        employee_id="HIST002", first_name="Has", last_name="History", functional_area_id=area.id
    )
    db_session.add(m)
    await db_session.flush()
    h1 = MemberHistory(
        member_uuid=m.uuid, field="salary", value=Decimal("100000"), effective_date=date.today()
    )
    h2 = MemberHistory(
        member_uuid=m.uuid, field="bonus", value=Decimal("5000"), effective_date=date.today()
    )
    db_session.add_all([h1, h2])
    await db_session.flush()
    resp = await client.get(f"/api/members/{m.uuid}/history/")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_get_history_filtered_by_field(client, area, db_session):
    m = TeamMember(
        employee_id="HIST003", first_name="Filter", last_name="History", functional_area_id=area.id
    )
    db_session.add(m)
    await db_session.flush()
    h1 = MemberHistory(
        member_uuid=m.uuid, field="salary", value=Decimal("100000"), effective_date=date.today()
    )
    h2 = MemberHistory(
        member_uuid=m.uuid, field="bonus", value=Decimal("5000"), effective_date=date.today()
    )
    db_session.add_all([h1, h2])
    await db_session.flush()
    resp = await client.get(f"/api/members/{m.uuid}/history/?field=salary")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["field"] == "salary"


async def test_get_history_invalid_field_filter(client, area, member):
    resp = await client.get(f"/api/members/{member.uuid}/history/?field=nonexistent_field")
    assert resp.status_code == 422
