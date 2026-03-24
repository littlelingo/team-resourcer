from pathlib import Path

import pytest

import app.services.import_session as sess_mod
from app.schemas.import_schemas import MappingConfig
from app.services.import_mapper import apply_mapping
from app.services.import_parser import parse_upload
from app.services.import_session import SessionNotFoundError, create_session

FIXTURES = Path(__file__).parent.parent / "fixtures"


def setup_function(fn):
    sess_mod._sessions.clear()


def teardown_function(fn):
    sess_mod._sessions.clear()


def make_config(sid, col_map):
    return MappingConfig(session_id=sid, column_map=col_map)


def test_apply_mapping_happy_path_all_valid():
    rows = [{"Col_ID": "EMP001", "Col_Name": "Alice"}]
    sid = create_session(rows, ["Col_ID", "Col_Name"])
    config = make_config(sid, {"Col_ID": "employee_id", "Col_Name": "name"})
    result = apply_mapping(sid, config)
    assert result.error_count == 0
    assert result.warning_count == 0
    assert result.rows[0].data["employee_id"] == "EMP001"
    assert result.rows[0].data["name"] == "Alice"


def test_apply_mapping_missing_employee_id_is_error():
    rows = [{"Col_ID": "", "Col_Name": "Alice"}]
    sid = create_session(rows, ["Col_ID", "Col_Name"])
    config = make_config(sid, {"Col_ID": "employee_id", "Col_Name": "name"})
    result = apply_mapping(sid, config)
    assert result.error_count == 1
    assert any("employee_id" in e for e in result.rows[0].errors)


def test_apply_mapping_missing_name_is_error():
    rows = [{"Col_ID": "EMP001", "Col_Name": ""}]
    sid = create_session(rows, ["Col_ID", "Col_Name"])
    config = make_config(sid, {"Col_ID": "employee_id", "Col_Name": "name"})
    result = apply_mapping(sid, config)
    assert result.error_count == 1
    assert any("name" in e for e in result.rows[0].errors)


def test_apply_mapping_invalid_email_is_error():
    rows = [{"id": "EMP001", "n": "Alice", "e": "not-an-email"}]
    sid = create_session(rows, ["id", "n", "e"])
    config = make_config(sid, {"id": "employee_id", "n": "name", "e": "email"})
    result = apply_mapping(sid, config)
    assert result.error_count == 1
    assert any("Invalid email" in e for e in result.rows[0].errors)


def test_apply_mapping_non_numeric_salary_is_error():
    rows = [{"id": "EMP001", "n": "Alice", "s": "not-a-number"}]
    sid = create_session(rows, ["id", "n", "s"])
    config = make_config(sid, {"id": "employee_id", "n": "name", "s": "salary"})
    result = apply_mapping(sid, config)
    assert result.error_count == 1
    assert any("salary" in e and "numeric" in e for e in result.rows[0].errors)


def test_apply_mapping_duplicate_employee_id_is_warning():
    rows = [
        {"id": "EMP001", "n": "Alice"},
        {"id": "EMP001", "n": "Duplicate"},
    ]
    sid = create_session(rows, ["id", "n"])
    config = make_config(sid, {"id": "employee_id", "n": "name"})
    result = apply_mapping(sid, config)
    assert result.warning_count == 1
    assert result.error_count == 0
    assert any("Duplicate employee_id" in w for w in result.rows[1].warnings)


def test_apply_mapping_skipped_column_none_not_in_data():
    rows = [{"id": "EMP001", "n": "Alice", "skip": "ignored"}]
    sid = create_session(rows, ["id", "n", "skip"])
    config = make_config(sid, {"id": "employee_id", "n": "name", "skip": None})
    result = apply_mapping(sid, config)
    assert "skip" not in result.rows[0].data


def test_apply_mapping_unknown_target_field_raises_value_error():
    rows = [{"id": "EMP001"}]
    sid = create_session(rows, ["id"])
    config = make_config(sid, {"id": "not_a_real_field"})
    with pytest.raises(ValueError, match="Unknown target field"):
        apply_mapping(sid, config)


def test_apply_mapping_unknown_session_raises():
    config = make_config("does-not-exist", {"id": "employee_id"})
    with pytest.raises(SessionNotFoundError):
        apply_mapping("does-not-exist", config)


def test_apply_mapping_from_csv_fixture():
    file_bytes = (FIXTURES / "valid_members.csv").read_bytes()
    parsed = parse_upload(file_bytes, "valid_members.csv")
    sid = create_session(parsed.raw_rows, parsed.headers)
    col_map = {h: h for h in parsed.headers}
    config = make_config(sid, col_map)
    result = apply_mapping(sid, config)
    assert result.error_count == 0
    assert len(result.rows) == 5


def test_apply_mapping_from_invalid_csv_fixture():
    file_bytes = (FIXTURES / "invalid_members.csv").read_bytes()
    parsed = parse_upload(file_bytes, "invalid_members.csv")
    sid = create_session(parsed.raw_rows, parsed.headers)
    col_map = {h: h for h in parsed.headers}
    config = make_config(sid, col_map)
    result = apply_mapping(sid, config)
    assert result.error_count >= 3


def test_apply_mapping_from_duplicate_csv_fixture():
    file_bytes = (FIXTURES / "duplicate_ids.csv").read_bytes()
    parsed = parse_upload(file_bytes, "duplicate_ids.csv")
    sid = create_session(parsed.raw_rows, parsed.headers)
    col_map = {h: h for h in parsed.headers}
    config = make_config(sid, col_map)
    result = apply_mapping(sid, config)
    assert result.warning_count == 1
    assert any("EMP020" in w for w in result.rows[1].warnings)
