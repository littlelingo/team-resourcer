import uuid as uuid_mod

from app.models.functional_area import FunctionalArea
from app.models.program import Program
from app.models.program_assignment import ProgramAssignment
from app.models.team import Team


async def test_list_members_empty(client, area):
    resp = await client.get("/api/members/")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_member_returns_201(client, area):
    resp = await client.post(
        "/api/members/",
        json={
            "employee_id": "T001",
            "first_name": "Test",
            "last_name": "User",
            "functional_area_id": area.id,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["employee_id"] == "T001"
    assert body["first_name"] == "Test"
    assert body["last_name"] == "User"
    assert "uuid" in body


async def test_get_member_by_uuid(client, area):
    resp = await client.post(
        "/api/members/",
        json={
            "employee_id": "T002",
            "first_name": "Test",
            "last_name": "User",
            "functional_area_id": area.id,
        },
    )
    uuid = resp.json()["uuid"]
    resp = await client.get(f"/api/members/{uuid}")
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Test"
    assert resp.json()["last_name"] == "User"


async def test_get_member_not_found(client):
    resp = await client.get("/api/members/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


async def test_update_member(client, area):
    resp = await client.post(
        "/api/members/",
        json={
            "employee_id": "T003",
            "first_name": "Test",
            "last_name": "User",
            "functional_area_id": area.id,
        },
    )
    uuid = resp.json()["uuid"]
    resp = await client.put(f"/api/members/{uuid}", json={"title": "Senior Engineer"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Senior Engineer"


async def test_update_member_not_found(client):
    resp = await client.put(
        "/api/members/00000000-0000-0000-0000-000000000000",
        json={"title": "X"},
    )
    assert resp.status_code == 404


async def test_delete_member(client, area):
    resp = await client.post(
        "/api/members/",
        json={
            "employee_id": "T004",
            "first_name": "Test",
            "last_name": "User",
            "functional_area_id": area.id,
        },
    )
    uuid = resp.json()["uuid"]
    resp = await client.delete(f"/api/members/{uuid}")
    assert resp.status_code == 204
    resp = await client.get(f"/api/members/{uuid}")
    assert resp.status_code == 404


async def test_delete_member_not_found(client):
    resp = await client.delete("/api/members/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


async def test_create_member_records_history_for_financial_fields(client, area):
    resp = await client.post(
        "/api/members/",
        json={
            "employee_id": "T005",
            "first_name": "Rich",
            "last_name": "User",
            "functional_area_id": area.id,
            "salary": 100000,
            "bonus": 5000,
        },
    )
    uuid = resp.json()["uuid"]
    resp = await client.get(f"/api/members/{uuid}/history/")
    assert resp.status_code == 200
    entries = resp.json()
    assert any(e["field"] == "salary" for e in entries)
    assert any(e["field"] == "bonus" for e in entries)


async def test_update_member_records_history_on_salary_change(client, area):
    resp = await client.post(
        "/api/members/",
        json={
            "employee_id": "T006",
            "first_name": "Salary",
            "last_name": "User",
            "functional_area_id": area.id,
            "salary": 100000,
        },
    )
    uuid = resp.json()["uuid"]
    await client.put(f"/api/members/{uuid}", json={"salary": 120000})
    resp = await client.get(f"/api/members/{uuid}/history/")
    history = [e for e in resp.json() if e["field"] == "salary"]
    assert len(history) == 2  # initial + update


async def test_list_members_filtered_by_area(client, db_session, area):
    design = FunctionalArea(name="Design")
    db_session.add(design)
    await db_session.flush()
    await client.post(
        "/api/members/",
        json={
            "employee_id": "T007",
            "first_name": "Eng",
            "last_name": "User",
            "functional_area_id": area.id,
        },
    )
    await client.post(
        "/api/members/",
        json={
            "employee_id": "T008",
            "first_name": "Design",
            "last_name": "User",
            "functional_area_id": design.id,
        },
    )
    resp = await client.get(f"/api/members/?area_id={area.id}")
    assert len(resp.json()) == 1
    assert resp.json()[0]["employee_id"] == "T007"


async def test_upload_image_success(client, member):
    """Uploading a valid PNG returns 200 with the image_path."""
    # Minimal valid 1x1 red PNG (created via Pillow)
    import io
    from PIL import Image

    buf = io.BytesIO()
    img = Image.new("RGB", (1, 1), color="red")
    img.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    resp = await client.post(
        f"/api/members/{member.uuid}/image",
        files={"file": ("photo.png", png_bytes, "image/png")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "image_path" in data
    assert data["image_path"].endswith(".png")


async def test_upload_image_member_not_found(client):
    resp = await client.post(
        "/api/members/00000000-0000-0000-0000-000000000000/image",
        files={"file": ("test.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 100, "image/png")},
    )
    assert resp.status_code == 404


async def test_list_members_includes_nested_objects(client, db_session, area):
    """List endpoint serializes functional_area, team, and program_assignments."""
    team = Team(name="Backend", functional_area_id=area.id)
    db_session.add(team)
    await db_session.flush()

    resp = await client.post(
        "/api/members/",
        json={
            "employee_id": "T100",
            "first_name": "Nested",
            "last_name": "Test",
            "functional_area_id": area.id,
            "team_id": team.id,
        },
    )
    member_uuid = resp.json()["uuid"]

    prog = Program(name="Phoenix")
    db_session.add(prog)
    await db_session.flush()
    pa = ProgramAssignment(
        member_uuid=uuid_mod.UUID(member_uuid), program_id=prog.id, role="Lead"
    )
    db_session.add(pa)
    await db_session.commit()

    resp = await client.get("/api/members/")
    assert resp.status_code == 200
    members = resp.json()
    member = next(m for m in members if m["uuid"] == member_uuid)

    assert member["functional_area"] == {
        "id": area.id,
        "name": "Engineering",
        "description": None,
        "member_count": 0,
    }
    assert member["team"] == {
        "id": team.id,
        "name": "Backend",
        "functional_area_id": area.id,
    }
    assert len(member["program_assignments"]) == 1
    assert member["program_assignments"][0]["program"]["name"] == "Phoenix"
    assert member["program_assignments"][0]["role"] == "Lead"


async def test_list_members_no_team_returns_null(client, area):
    """A member with no team returns team: null without error."""
    resp = await client.post(
        "/api/members/",
        json={
            "employee_id": "T101",
            "first_name": "No",
            "last_name": "Team",
            "functional_area_id": area.id,
        },
    )
    member_uuid = resp.json()["uuid"]

    resp = await client.get("/api/members/")
    member = next(m for m in resp.json() if m["uuid"] == member_uuid)
    assert member["team"] is None
    assert member["program_assignments"] == []
