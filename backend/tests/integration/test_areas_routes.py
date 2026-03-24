async def test_list_areas_empty(client):
    resp = await client.get("/api/areas/")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_area(client):
    resp = await client.post("/api/areas/", json={"name": "Engineering"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "Engineering"


async def test_get_area(client):
    resp = await client.post("/api/areas/", json={"name": "Engineering"})
    area_id = resp.json()["id"]
    resp = await client.get(f"/api/areas/{area_id}")
    assert resp.status_code == 200


async def test_get_area_not_found(client):
    resp = await client.get("/api/areas/99999")
    assert resp.status_code == 404


async def test_update_area(client):
    resp = await client.post("/api/areas/", json={"name": "Engineering"})
    area_id = resp.json()["id"]
    resp = await client.put(f"/api/areas/{area_id}", json={"name": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


async def test_update_area_not_found(client):
    resp = await client.put("/api/areas/99999", json={"name": "X"})
    assert resp.status_code == 404


async def test_delete_area(client):
    resp = await client.post("/api/areas/", json={"name": "ToDelete"})
    area_id = resp.json()["id"]
    resp = await client.delete(f"/api/areas/{area_id}")
    assert resp.status_code == 204
    resp = await client.get(f"/api/areas/{area_id}")
    assert resp.status_code == 404


async def test_delete_area_not_found(client):
    resp = await client.delete("/api/areas/99999")
    assert resp.status_code == 404


async def test_area_tree_not_found(client):
    resp = await client.get("/api/areas/99999/tree")
    assert resp.status_code == 404


async def test_area_tree_returns_area_node(client, area):
    resp = await client.get(f"/api/areas/{area.id}/tree")
    assert resp.status_code == 200
    body = resp.json()
    node_ids = [n["id"] for n in body["nodes"]]
    assert f"area-{area.id}" in node_ids
