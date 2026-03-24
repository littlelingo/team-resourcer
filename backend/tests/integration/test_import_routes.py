from pathlib import Path

import app.services.import_session as sess_mod

FIXTURES = Path(__file__).parent.parent / "fixtures"


def setup_function(fn):
    sess_mod._sessions.clear()


def teardown_function(fn):
    sess_mod._sessions.clear()


async def test_upload_csv_returns_session_id(client):
    csv_bytes = (FIXTURES / "valid_members.csv").read_bytes()
    resp = await client.post(
        "/api/import/upload",
        files={"file": ("valid_members.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "session_id" in body
    assert body["total_row_count"] == 5
    assert "employee_id" in body["headers"]


async def test_upload_xlsx_returns_session_id(client):
    xlsx_bytes = (FIXTURES / "valid_members.xlsx").read_bytes()
    resp = await client.post(
        "/api/import/upload",
        files={
            "file": (
                "valid_members.xlsx",
                xlsx_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert resp.status_code == 200
    assert resp.json()["total_row_count"] == 5


async def test_upload_xls_returns_422(client):
    resp = await client.post(
        "/api/import/upload",
        files={"file": ("file.xls", b"dummy", "application/octet-stream")},
    )
    assert resp.status_code == 422


async def test_upload_oversized_file_returns_413(client):
    big_bytes = b"x" * (11 * 1024 * 1024)
    resp = await client.post(
        "/api/import/upload",
        files={"file": ("big.csv", big_bytes, "text/csv")},
    )
    assert resp.status_code == 413


async def test_preview_returns_mapped_rows(client):
    csv_bytes = (FIXTURES / "valid_members.csv").read_bytes()
    upload_resp = await client.post(
        "/api/import/upload",
        files={"file": ("valid_members.csv", csv_bytes, "text/csv")},
    )
    body = upload_resp.json()
    sid = body["session_id"]
    headers = body["headers"]
    column_map = {h: h for h in headers}
    resp = await client.post(
        "/api/import/preview",
        json={
            "session_id": sid,
            "column_map": column_map,
        },
    )
    assert resp.status_code == 200
    pbody = resp.json()
    assert pbody["error_count"] == 0
    assert len(pbody["rows"]) == 5


async def test_preview_session_not_found_returns_404(client):
    resp = await client.post(
        "/api/import/preview",
        json={
            "session_id": "fake-id",
            "column_map": {},
        },
    )
    assert resp.status_code == 404


async def test_preview_unknown_target_field_returns_422(client):
    csv_bytes = (FIXTURES / "valid_members.csv").read_bytes()
    upload_resp = await client.post(
        "/api/import/upload",
        files={"file": ("valid_members.csv", csv_bytes, "text/csv")},
    )
    sid = upload_resp.json()["session_id"]
    resp = await client.post(
        "/api/import/preview",
        json={
            "session_id": sid,
            "column_map": {"employee_id": "totally_fake_field"},
        },
    )
    assert resp.status_code == 422


async def test_commit_creates_members(client):
    csv_bytes = (FIXTURES / "valid_members.csv").read_bytes()
    upload_resp = await client.post(
        "/api/import/upload",
        files={"file": ("valid_members.csv", csv_bytes, "text/csv")},
    )
    body = upload_resp.json()
    sid = body["session_id"]
    column_map = {h: h for h in body["headers"]}
    resp = await client.post(
        "/api/import/commit",
        json={
            "session_id": sid,
            "column_map": column_map,
        },
    )
    assert resp.status_code == 200
    rbody = resp.json()
    assert rbody["created_count"] == 5
    assert rbody["skipped_count"] == 0


async def test_commit_session_not_found_returns_404(client):
    resp = await client.post(
        "/api/import/commit",
        json={
            "session_id": "no-such-session",
            "column_map": {},
        },
    )
    assert resp.status_code == 404


async def test_commit_then_session_deleted(client):
    csv_bytes = (FIXTURES / "valid_members.csv").read_bytes()
    upload_resp = await client.post(
        "/api/import/upload",
        files={"file": ("valid_members.csv", csv_bytes, "text/csv")},
    )
    body = upload_resp.json()
    sid = body["session_id"]
    headers = body["headers"]
    column_map = {h: h for h in headers}
    # Commit
    await client.post(
        "/api/import/commit",
        json={
            "session_id": sid,
            "column_map": column_map,
        },
    )
    # Session should be deleted
    resp = await client.post(
        "/api/import/preview",
        json={
            "session_id": sid,
            "column_map": column_map,
        },
    )
    assert resp.status_code == 404
