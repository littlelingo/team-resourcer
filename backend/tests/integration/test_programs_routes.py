async def test_list_programs_empty(client):
    resp = await client.get("/api/programs/")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_program(client):
    resp = await client.post("/api/programs/", json={"name": "Alpha"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "Alpha"


async def test_get_program(client):
    resp = await client.post("/api/programs/", json={"name": "Alpha"})
    pid = resp.json()["id"]
    resp = await client.get(f"/api/programs/{pid}")
    assert resp.status_code == 200


async def test_get_program_not_found(client):
    resp = await client.get("/api/programs/99999")
    assert resp.status_code == 404


async def test_update_program(client):
    resp = await client.post("/api/programs/", json={"name": "Alpha"})
    pid = resp.json()["id"]
    resp = await client.put(f"/api/programs/{pid}", json={"name": "Beta"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Beta"


async def test_delete_program(client):
    resp = await client.post("/api/programs/", json={"name": "ToDelete"})
    pid = resp.json()["id"]
    resp = await client.delete(f"/api/programs/{pid}")
    assert resp.status_code == 204
    resp = await client.get(f"/api/programs/{pid}")
    assert resp.status_code == 404


async def test_assign_member(client, program, member):
    resp = await client.post(
        f"/api/programs/{program.id}/assignments",
        json={"member_uuid": str(member.uuid), "program_id": program.id, "role": "Lead"},
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "Lead"


async def test_assign_member_program_not_found(client, member):
    resp = await client.post(
        "/api/programs/99999/assignments",
        json={"member_uuid": str(member.uuid), "program_id": 99999},
    )
    assert resp.status_code == 404
    assert "Program 99999 not found" in resp.json()["detail"]


async def test_unassign_member(client, program, member):
    await client.post(
        f"/api/programs/{program.id}/assignments",
        json={"member_uuid": str(member.uuid), "program_id": program.id, "role": "Lead"},
    )
    resp = await client.delete(f"/api/programs/{program.id}/assignments/{member.uuid}")
    assert resp.status_code == 204


async def test_unassign_not_found(client, program, member):
    resp = await client.delete(f"/api/programs/{program.id}/assignments/{member.uuid}")
    assert resp.status_code == 404


async def test_get_program_members(client, program, member):
    await client.post(
        f"/api/programs/{program.id}/assignments",
        json={"member_uuid": str(member.uuid), "program_id": program.id},
    )
    resp = await client.get(f"/api/programs/{program.id}/members")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["uuid"] == str(member.uuid)


async def test_program_tree_not_found(client):
    resp = await client.get("/api/programs/99999/tree")
    assert resp.status_code == 404


async def test_program_tree_returns_program_node(client, program, member):
    await client.post(
        f"/api/programs/{program.id}/assignments",
        json={"member_uuid": str(member.uuid), "program_id": program.id},
    )
    resp = await client.get(f"/api/programs/{program.id}/tree")
    assert resp.status_code == 200
    body = resp.json()
    node_ids = [n["id"] for n in body["nodes"]]
    assert f"program-{program.id}" in node_ids
    assert f"member-{member.uuid}" in node_ids
    assert len(body["edges"]) == 1
