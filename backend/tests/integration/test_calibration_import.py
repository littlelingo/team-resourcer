"""Integration tests for calibration import pipeline (Phase 2)."""

from __future__ import annotations

import pytest
from sqlalchemy import select

import app.services.import_session as sess_mod
from app.models.calibration import Calibration
from app.models.calibration_cycle import CalibrationCycle
from app.models.functional_area import FunctionalArea
from app.models.team_member import TeamMember
from app.schemas.import_schemas import ConstantMapping, MappingConfig, ResolveAmbiguousRequest
from app.services.import_commit import commit_import
from app.services.import_session import create_session

pytestmark = pytest.mark.anyio


def setup_function(fn):
    sess_mod._sessions.clear()


def teardown_function(fn):
    sess_mod._sessions.clear()


@pytest.fixture()
async def area_obj(db_session):
    area = FunctionalArea(name="Engineering")
    db_session.add(area)
    await db_session.flush()
    return area


@pytest.fixture()
async def two_unique_members(db_session, area_obj):
    """Two members with distinct names."""
    m1 = TeamMember(
        employee_id="C001",
        first_name="Alice",
        last_name="Smith",
        functional_area_id=area_obj.id,
    )
    m2 = TeamMember(
        employee_id="C002",
        first_name="Bob",
        last_name="Jones",
        functional_area_id=area_obj.id,
    )
    db_session.add_all([m1, m2])
    await db_session.flush()
    return m1, m2


@pytest.fixture()
async def duplicate_name_members(db_session, area_obj):
    """Two members with the same first+last name (ambiguous)."""
    m1 = TeamMember(
        employee_id="D001",
        first_name="Alex",
        last_name="Chen",
        functional_area_id=area_obj.id,
    )
    m2 = TeamMember(
        employee_id="D002",
        first_name="Alex",
        last_name="Chen",
        functional_area_id=area_obj.id,
    )
    db_session.add_all([m1, m2])
    await db_session.flush()
    return m1, m2


class TestCalibrationImportCommit:
    async def test_import_creates_cycle_and_calibrations(
        self, db_session, two_unique_members
    ):
        m1, m2 = two_unique_members
        rows = [
            {
                "First Name": "Alice",
                "Last Name": "Smith",
                "9-Box Matrix": "4",
                "effective_date": "2026-03-15",
            },
            {
                "First Name": "Bob",
                "Last Name": "Jones",
                "9-Box Matrix": "5 - Key Performer",
                "effective_date": "2026-03-15",
            },
        ]
        sid = create_session(
            rows, ["First Name", "Last Name", "9-Box Matrix", "effective_date"]
        )
        config = MappingConfig(
            session_id=sid,
            entity_type="calibration",
            column_map={
                "First Name": "first_name",
                "Last Name": "last_name",
                "9-Box Matrix": "box",
                "effective_date": "effective_date",
            },
            constant_mappings=[ConstantMapping(field="cycle_label", constant="2026 Q1")],
        )
        result = await commit_import(sid, config, db_session)
        assert result.created_calibrations == 2
        assert result.updated_calibrations == 0
        assert result.created_cycles == 1
        assert result.unmatched_rows == []
        assert result.ambiguous_rows == []

        # Verify cycle was created
        cycle = (
            await db_session.execute(
                select(CalibrationCycle).where(CalibrationCycle.label == "2026 Q1")
            )
        ).scalar_one_or_none()
        assert cycle is not None

        # Verify calibrations
        cals = (await db_session.execute(select(Calibration))).scalars().all()
        assert len(cals) == 2

    async def test_import_strips_label_from_box_value(
        self, db_session, two_unique_members
    ):
        m1, m2 = two_unique_members
        rows = [
            {
                "First Name": "Alice",
                "Last Name": "Smith",
                "9-Box Matrix": "5 - Key Performer",
                "effective_date": "2026-03-01",
            }
        ]
        sid = create_session(rows, ["First Name", "Last Name", "9-Box Matrix", "effective_date"])
        config = MappingConfig(
            session_id=sid,
            entity_type="calibration",
            column_map={
                "First Name": "first_name",
                "Last Name": "last_name",
                "9-Box Matrix": "box",
                "effective_date": "effective_date",
            },
            constant_mappings=[ConstantMapping(field="cycle_label", constant="Q1")],
        )
        result = await commit_import(sid, config, db_session)
        assert result.created_calibrations == 1
        cal = (await db_session.execute(select(Calibration))).scalar_one()
        assert cal.box == 5

    async def test_import_buckets_unmatched_rows(self, db_session, two_unique_members):
        rows = [
            {
                "First Name": "Unknown",
                "Last Name": "Person",
                "9-Box Matrix": "3",
                "effective_date": "2026-03-01",
            }
        ]
        sid = create_session(rows, ["First Name", "Last Name", "9-Box Matrix", "effective_date"])
        config = MappingConfig(
            session_id=sid,
            entity_type="calibration",
            column_map={
                "First Name": "first_name",
                "Last Name": "last_name",
                "9-Box Matrix": "box",
                "effective_date": "effective_date",
            },
            constant_mappings=[ConstantMapping(field="cycle_label", constant="Q1")],
        )
        result = await commit_import(sid, config, db_session)
        assert result.created_calibrations == 0
        assert len(result.unmatched_rows) == 1
        assert result.unmatched_rows[0]["first_name"] == "Unknown"

    async def test_import_buckets_ambiguous_rows(
        self, db_session, duplicate_name_members
    ):
        m1, m2 = duplicate_name_members
        rows = [
            {
                "First Name": "Alex",
                "Last Name": "Chen",
                "9-Box Matrix": "6",
                "effective_date": "2026-03-01",
            }
        ]
        sid = create_session(rows, ["First Name", "Last Name", "9-Box Matrix", "effective_date"])
        config = MappingConfig(
            session_id=sid,
            entity_type="calibration",
            column_map={
                "First Name": "first_name",
                "Last Name": "last_name",
                "9-Box Matrix": "box",
                "effective_date": "effective_date",
            },
            constant_mappings=[ConstantMapping(field="cycle_label", constant="Q1")],
        )
        result = await commit_import(sid, config, db_session)
        assert result.created_calibrations == 0
        assert len(result.ambiguous_rows) == 1
        assert len(result.ambiguous_rows[0]["candidates"]) == 2
        assert result.ambiguous_rows[0]["row_data"]["first_name"] == "Alex"

    async def test_upsert_on_reimport(self, db_session, two_unique_members):
        """Re-importing same member+cycle updates instead of creating."""
        m1, _ = two_unique_members

        # First import
        rows = [
            {
                "First Name": "Alice",
                "Last Name": "Smith",
                "9-Box Matrix": "4",
                "effective_date": "2026-03-01",
            }
        ]
        sid = create_session(rows, ["First Name", "Last Name", "9-Box Matrix", "effective_date"])
        config = MappingConfig(
            session_id=sid,
            entity_type="calibration",
            column_map={
                "First Name": "first_name",
                "Last Name": "last_name",
                "9-Box Matrix": "box",
                "effective_date": "effective_date",
            },
            constant_mappings=[ConstantMapping(field="cycle_label", constant="Q1")],
        )
        await commit_import(sid, config, db_session)

        # Second import — same cycle, different box
        rows2 = [
            {
                "First Name": "Alice",
                "Last Name": "Smith",
                "9-Box Matrix": "7",
                "effective_date": "2026-03-01",
            }
        ]
        sid2 = create_session(
            rows2, ["First Name", "Last Name", "9-Box Matrix", "effective_date"]
        )
        config2 = MappingConfig(
            session_id=sid2,
            entity_type="calibration",
            column_map={
                "First Name": "first_name",
                "Last Name": "last_name",
                "9-Box Matrix": "box",
                "effective_date": "effective_date",
            },
            constant_mappings=[ConstantMapping(field="cycle_label", constant="Q1")],
        )
        result2 = await commit_import(sid2, config2, db_session)
        assert result2.updated_calibrations == 1
        assert result2.created_calibrations == 0

        # Only one row should exist
        cals = (await db_session.execute(select(Calibration))).scalars().all()
        assert len(cals) == 1
        assert cals[0].box == 7


class TestResolveAmbiguous:
    async def test_resolve_applies_row_data(self, db_session, duplicate_name_members):
        m1, m2 = duplicate_name_members

        # First get a cycle
        cycle = CalibrationCycle(label="Test Cycle", sequence_number=1)
        db_session.add(cycle)
        await db_session.flush()

        from app.services.import_commit_calibrations import apply_calibration_resolutions

        resolutions = [
            {
                "member_uuid": str(m1.uuid),
                "row_data": {
                    "box": "6",
                    "effective_date": "2026-03-01",
                    "rationale": "Resolved manually",
                },
            }
        ]
        result = await apply_calibration_resolutions(db_session, cycle.id, resolutions)
        await db_session.commit()
        assert result["created_calibrations"] == 1

        cal = (await db_session.execute(select(Calibration))).scalar_one_or_none()
        assert cal is not None
        assert cal.box == 6
        assert cal.member_uuid == m1.uuid
