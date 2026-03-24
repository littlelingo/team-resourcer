

async def test_list_teams_empty(client, area):
    resp = await client.get(f"/api/areas/{area.id}/teams/")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_team(client, area):
    resp = await client.post(
        f"/api/areas/{area.id}/teams/",
        json={"name": "Backend", "functional_area_id": area.id},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Backend"
    assert body["functional_area_id"] == area.id


async def test_get_team(client, area, team):
    resp = await client.get(f"/api/areas/{area.id}/teams/{team.id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Backend"


async def test_get_team_wrong_area_returns_404(client, area, team):
    # Create a second area
    resp = await client.post("/api/areas/", json={"name": "Design"})
    design_id = resp.json()["id"]
    resp = await client.get(f"/api/areas/{design_id}/teams/{team.id}")
    assert resp.status_code == 404


async def test_update_team(client, area, team):
    resp = await client.put(f"/api/areas/{area.id}/teams/{team.id}", json={"name": "Updated"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"


async def test_delete_team(client, area, team):
    resp = await client.delete(f"/api/areas/{area.id}/teams/{team.id}")
    assert resp.status_code == 204
    resp = await client.get(f"/api/areas/{area.id}/teams/{team.id}")
    assert resp.status_code == 404


async def test_add_member_to_team(client, area, team, member):
    resp = await client.post(
        f"/api/areas/{area.id}/teams/{team.id}/members",
        json={"member_uuid": str(member.uuid)},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


async def test_add_member_not_found(client, area, team):
    resp = await client.post(
        f"/api/areas/{area.id}/teams/{team.id}/members",
        json={"member_uuid": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 404


async def test_remove_member_from_team(client, area, team, member):
    # First add
    await client.post(
        f"/api/areas/{area.id}/teams/{team.id}/members",
        json={"member_uuid": str(member.uuid)},
    )
    # Then remove
    resp = await client.delete(f"/api/areas/{area.id}/teams/{team.id}/members/{member.uuid}")
    assert resp.status_code == 204


async def test_remove_member_not_in_team(client, area, team, member):
    resp = await client.delete(f"/api/areas/{area.id}/teams/{team.id}/members/{member.uuid}")
    assert resp.status_code == 404
