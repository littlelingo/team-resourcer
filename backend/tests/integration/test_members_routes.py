from app.models.functional_area import FunctionalArea


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


async def test_upload_image_member_not_found(client):
    resp = await client.post(
        "/api/members/00000000-0000-0000-0000-000000000000/image",
        files={"file": ("test.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 100, "image/png")},
    )
    assert resp.status_code == 404
