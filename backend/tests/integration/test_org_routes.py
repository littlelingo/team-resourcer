from app.models.team_member import TeamMember


async def test_org_tree_empty(client):
    resp = await client.get("/api/org/tree")
    assert resp.status_code == 200
    body = resp.json()
    assert body["nodes"] == []
    assert body["edges"] == []


async def test_org_tree_with_members(client, area, db_session):
    alice = TeamMember(
        employee_id="ORG001", first_name="Alice", last_name="Test", functional_area_id=area.id
    )
    bob = TeamMember(
        employee_id="ORG002", first_name="Bob", last_name="Test", functional_area_id=area.id
    )
    db_session.add_all([alice, bob])
    await db_session.flush()
    bob.supervisor_id = alice.uuid
    await db_session.flush()
    resp = await client.get("/api/org/tree")
    assert resp.status_code == 200
    body = resp.json()
    node_ids = [n["id"] for n in body["nodes"]]
    assert f"member-{alice.uuid}" in node_ids
    assert f"member-{bob.uuid}" in node_ids
    assert len(body["edges"]) == 1
    edge = body["edges"][0]
    assert edge["source"] == f"member-{alice.uuid}"
    assert edge["target"] == f"member-{bob.uuid}"


async def test_set_supervisor_success(client, area, db_session):
    alice = TeamMember(
        employee_id="SUP001", first_name="Alice", last_name="Test", functional_area_id=area.id
    )
    bob = TeamMember(
        employee_id="SUP002", first_name="Bob", last_name="Test", functional_area_id=area.id
    )
    db_session.add_all([alice, bob])
    await db_session.flush()
    resp = await client.put(
        f"/api/org/members/{bob.uuid}/supervisor",
        json={"supervisor_id": str(alice.uuid)},
    )
    assert resp.status_code == 200
    assert resp.json()["supervisor_id"] == str(alice.uuid)


async def test_set_supervisor_to_null(client, area, db_session):
    alice = TeamMember(
        employee_id="NUL001", first_name="Alice", last_name="Test", functional_area_id=area.id
    )
    bob = TeamMember(
        employee_id="NUL002", first_name="Bob", last_name="Test", functional_area_id=area.id
    )
    db_session.add_all([alice, bob])
    await db_session.flush()
    bob.supervisor_id = alice.uuid
    await db_session.flush()
    resp = await client.put(
        f"/api/org/members/{bob.uuid}/supervisor",
        json={"supervisor_id": None},
    )
    assert resp.status_code == 200
    assert resp.json()["supervisor_id"] is None


async def test_set_supervisor_self_reference_returns_400(client, area, db_session):
    alice = TeamMember(
        employee_id="SELF001", first_name="Alice", last_name="Test", functional_area_id=area.id
    )
    db_session.add(alice)
    await db_session.flush()
    resp = await client.put(
        f"/api/org/members/{alice.uuid}/supervisor",
        json={"supervisor_id": str(alice.uuid)},
    )
    assert resp.status_code == 400
    assert "own supervisor" in resp.json()["detail"].lower()


async def test_set_supervisor_cycle_returns_400(client, area, db_session):
    alice = TeamMember(
        employee_id="CYC001", first_name="Alice", last_name="Test", functional_area_id=area.id
    )
    bob = TeamMember(
        employee_id="CYC002", first_name="Bob", last_name="Test", functional_area_id=area.id
    )
    db_session.add_all([alice, bob])
    await db_session.flush()
    # Alice reports to Bob
    alice.supervisor_id = bob.uuid
    await db_session.flush()
    # Now try: Bob reports to Alice (would create cycle)
    resp = await client.put(
        f"/api/org/members/{bob.uuid}/supervisor",
        json={"supervisor_id": str(alice.uuid)},
    )
    assert resp.status_code == 400
    assert "circular" in resp.json()["detail"].lower()


async def test_set_supervisor_member_not_found(client):
    resp = await client.put(
        "/api/org/members/00000000-0000-0000-0000-000000000000/supervisor",
        json={"supervisor_id": None},
    )
    assert resp.status_code == 404


# ─── Functional Manager Tests ────────────────────────────────────────────────


async def test_set_functional_manager_success(client, area, db_session):
    alice = TeamMember(
        employee_id="FM001", first_name="Alice", last_name="Test", functional_area_id=area.id
    )
    bob = TeamMember(
        employee_id="FM002", first_name="Bob", last_name="Test", functional_area_id=area.id
    )
    db_session.add_all([alice, bob])
    await db_session.flush()
    resp = await client.put(
        f"/api/org/members/{bob.uuid}/functional-manager",
        json={"functional_manager_id": str(alice.uuid)},
    )
    assert resp.status_code == 200
    assert resp.json()["functional_manager_id"] == str(alice.uuid)


async def test_set_functional_manager_to_null(client, area, db_session):
    alice = TeamMember(
        employee_id="FMN001", first_name="Alice", last_name="Test", functional_area_id=area.id
    )
    bob = TeamMember(
        employee_id="FMN002", first_name="Bob", last_name="Test", functional_area_id=area.id
    )
    db_session.add_all([alice, bob])
    await db_session.flush()
    bob.functional_manager_id = alice.uuid
    await db_session.flush()
    resp = await client.put(
        f"/api/org/members/{bob.uuid}/functional-manager",
        json={"functional_manager_id": None},
    )
    assert resp.status_code == 200
    assert resp.json()["functional_manager_id"] is None


async def test_set_functional_manager_self_reference_returns_400(client, area, db_session):
    alice = TeamMember(
        employee_id="FMS001", first_name="Alice", last_name="Test", functional_area_id=area.id
    )
    db_session.add(alice)
    await db_session.flush()
    resp = await client.put(
        f"/api/org/members/{alice.uuid}/functional-manager",
        json={"functional_manager_id": str(alice.uuid)},
    )
    assert resp.status_code == 400
    assert "own functional manager" in resp.json()["detail"].lower()


async def test_set_functional_manager_cycle_returns_400(client, area, db_session):
    alice = TeamMember(
        employee_id="FMC001", first_name="Alice", last_name="Test", functional_area_id=area.id
    )
    bob = TeamMember(
        employee_id="FMC002", first_name="Bob", last_name="Test", functional_area_id=area.id
    )
    db_session.add_all([alice, bob])
    await db_session.flush()
    alice.functional_manager_id = bob.uuid
    await db_session.flush()
    resp = await client.put(
        f"/api/org/members/{bob.uuid}/functional-manager",
        json={"functional_manager_id": str(alice.uuid)},
    )
    assert resp.status_code == 400
    assert "circular" in resp.json()["detail"].lower()


async def test_set_functional_manager_member_not_found(client):
    resp = await client.put(
        "/api/org/members/00000000-0000-0000-0000-000000000000/functional-manager",
        json={"functional_manager_id": None},
    )
    assert resp.status_code == 404


async def test_detail_response_includes_resolved_supervisor(client, area, db_session):
    alice = TeamMember(
        employee_id="RES001", first_name="Alice", last_name="Manager", functional_area_id=area.id
    )
    bob = TeamMember(
        employee_id="RES002", first_name="Bob", last_name="Report", functional_area_id=area.id
    )
    db_session.add_all([alice, bob])
    await db_session.flush()
    bob.supervisor_id = alice.uuid
    await db_session.commit()
    resp = await client.get(f"/api/members/{bob.uuid}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["supervisor"]["first_name"] == "Alice"
    assert body["supervisor"]["last_name"] == "Manager"
