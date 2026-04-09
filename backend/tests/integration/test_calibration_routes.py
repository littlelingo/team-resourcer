"""Integration tests for calibration cycles and member calibration routes."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


@pytest.fixture()
async def cycle(client: AsyncClient):
    """Create a calibration cycle and return the response JSON."""
    resp = await client.post(
        "/api/calibration-cycles/",
        json={"label": "2026 Q1", "start_date": "2026-01-01", "end_date": "2026-03-31"},
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture()
async def member_uuid(client: AsyncClient, area):
    """Create a member and return its UUID."""
    resp = await client.post(
        "/api/members/",
        json={
            "employee_id": "EMP001",
            "first_name": "Alice",
            "last_name": "Smith",
            "functional_area_id": area.id,
        },
    )
    assert resp.status_code == 201
    return resp.json()["uuid"]


class TestCalibrationCycles:
    async def test_create_cycle(self, client: AsyncClient):
        resp = await client.post(
            "/api/calibration-cycles/",
            json={"label": "2026 Q2", "start_date": "2026-04-01"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["label"] == "2026 Q2"
        assert data["sequence_number"] == 1
        assert data["is_active"] is True

    async def test_list_cycles(self, client: AsyncClient, cycle):
        resp = await client.get("/api/calibration-cycles/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["label"] == "2026 Q1"

    async def test_sequence_number_auto_increments(self, client: AsyncClient):
        await client.post(
            "/api/calibration-cycles/",
            json={"label": "First"},
        )
        resp2 = await client.post(
            "/api/calibration-cycles/",
            json={"label": "Second"},
        )
        assert resp2.json()["sequence_number"] == 2


class TestMemberCalibrations:
    async def test_create_calibration_returns_201_with_computed_fields(
        self, client: AsyncClient, cycle, member_uuid
    ):
        resp = await client.post(
            f"/api/members/{member_uuid}/calibrations/",
            json={
                "cycle_id": cycle["id"],
                "box": 4,
                "effective_date": "2026-03-15",
                "rationale": "Strong quarter",
                "ready_for_promotion": "Yes",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["box"] == 4
        assert data["label"] == "High Professional Plus"
        assert data["performance"] == 3
        assert data["potential"] == 2
        assert data["ready_for_promotion"] == "Yes"
        assert data["cycle"]["label"] == "2026 Q1"

    async def test_all_nine_boxes_have_correct_axes(self, client: AsyncClient, area):
        """Verify all 9 box values map to correct (performance, potential)."""
        expected = {
            1: (3, 3), 2: (2, 3), 3: (1, 3),
            4: (3, 2), 5: (2, 2), 6: (1, 2),
            7: (3, 1), 8: (2, 1), 9: (1, 1),
        }
        # Create a cycle
        cycle_resp = await client.post(
            "/api/calibration-cycles/", json={"label": "Test Cycle"}
        )
        cycle_id = cycle_resp.json()["id"]

        for box_num, (exp_perf, exp_pot) in expected.items():
            # Create a fresh member for each box
            member_resp = await client.post(
                "/api/members/",
                json={
                    "employee_id": f"EMP{box_num:03d}",
                    "first_name": f"Box{box_num}",
                    "last_name": "Test",
                    "functional_area_id": area.id,
                },
            )
            mu = member_resp.json()["uuid"]
            cal_resp = await client.post(
                f"/api/members/{mu}/calibrations/",
                json={"cycle_id": cycle_id, "box": box_num, "effective_date": "2026-03-01"},
            )
            assert cal_resp.status_code == 201
            data = cal_resp.json()
            assert data["performance"] == exp_perf, f"box {box_num} expected perf {exp_perf}"
            assert data["potential"] == exp_pot, f"box {box_num} expected pot {exp_pot}"

    async def test_upsert_on_same_member_cycle(self, client: AsyncClient, cycle, member_uuid):
        """Second POST to same (member, cycle) updates rather than creates."""
        await client.post(
            f"/api/members/{member_uuid}/calibrations/",
            json={"cycle_id": cycle["id"], "box": 4, "effective_date": "2026-03-15"},
        )
        resp2 = await client.post(
            f"/api/members/{member_uuid}/calibrations/",
            json={"cycle_id": cycle["id"], "box": 7, "effective_date": "2026-03-15"},
        )
        assert resp2.status_code == 201
        assert resp2.json()["box"] == 7
        # History should still show only one entry
        hist = await client.get(f"/api/members/{member_uuid}/calibrations/")
        assert len(hist.json()) == 1

    async def test_update_calibration(self, client: AsyncClient, cycle, member_uuid):
        create_resp = await client.post(
            f"/api/members/{member_uuid}/calibrations/",
            json={"cycle_id": cycle["id"], "box": 5, "effective_date": "2026-03-01"},
        )
        cal_id = create_resp.json()["id"]
        upd_resp = await client.put(
            f"/api/members/{member_uuid}/calibrations/{cal_id}",
            json={"box": 2, "rationale": "Updated"},
        )
        assert upd_resp.status_code == 200
        assert upd_resp.json()["box"] == 2
        assert upd_resp.json()["rationale"] == "Updated"

    async def test_delete_calibration(self, client: AsyncClient, cycle, member_uuid):
        create_resp = await client.post(
            f"/api/members/{member_uuid}/calibrations/",
            json={"cycle_id": cycle["id"], "box": 3, "effective_date": "2026-03-01"},
        )
        cal_id = create_resp.json()["id"]
        del_resp = await client.delete(
            f"/api/members/{member_uuid}/calibrations/{cal_id}"
        )
        assert del_resp.status_code == 204

        hist = await client.get(f"/api/members/{member_uuid}/calibrations/")
        assert hist.json() == []

    async def test_member_detail_includes_calibrations_and_latest(
        self, client: AsyncClient, cycle, member_uuid
    ):
        """MemberDetailResponse.calibrations and latest_calibration populated."""
        await client.post(
            f"/api/members/{member_uuid}/calibrations/",
            json={"cycle_id": cycle["id"], "box": 4, "effective_date": "2026-03-15"},
        )
        detail = await client.get(f"/api/members/{member_uuid}")
        assert detail.status_code == 200
        data = detail.json()
        assert len(data["calibrations"]) == 1
        assert data["calibrations"][0]["box"] == 4
        assert data["latest_calibration"]["box"] == 4
        assert data["latest_calibration"]["label"] == "High Professional Plus"


class TestCalibrationAnalytics:
    async def test_latest_calibrations_returns_list(
        self, client: AsyncClient, cycle, member_uuid
    ):
        await client.post(
            f"/api/members/{member_uuid}/calibrations/",
            json={"cycle_id": cycle["id"], "box": 5, "effective_date": "2026-03-01"},
        )
        resp = await client.get("/api/calibrations/latest")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["box"] == 5

    async def test_movement_endpoint(self, client: AsyncClient, area):
        # Create two cycles and a member with calibrations in both
        c1 = (await client.post("/api/calibration-cycles/", json={"label": "C1"})).json()
        c2 = (await client.post("/api/calibration-cycles/", json={"label": "C2"})).json()
        m = (
            await client.post(
                "/api/members/",
                json={
                    "employee_id": "EMPX",
                    "first_name": "John",
                    "last_name": "Doe",
                    "functional_area_id": area.id,
                },
            )
        ).json()
        mu = m["uuid"]
        await client.post(
            f"/api/members/{mu}/calibrations/",
            json={"cycle_id": c1["id"], "box": 5, "effective_date": "2026-01-01"},
        )
        await client.post(
            f"/api/members/{mu}/calibrations/",
            json={"cycle_id": c2["id"], "box": 3, "effective_date": "2026-04-01"},
        )
        resp = await client.get(
            f"/api/calibrations/movement?from={c1['id']}&to={c2['id']}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["from_box"] == 5
        assert data[0]["to_box"] == 3
