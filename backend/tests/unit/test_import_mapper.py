from pathlib import Path

import pytest

import app.services.import_session as sess_mod
from app.schemas.import_schemas import MappingConfig
from app.services.import_mapper import _split_semicolon_list, apply_mapping
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
    rows = [{"Col_ID": "EMP001", "Col_FN": "Alice", "Col_LN": "Smith"}]
    sid = create_session(rows, ["Col_ID", "Col_FN", "Col_LN"])
    config = make_config(
        sid, {"Col_ID": "employee_id", "Col_FN": "first_name", "Col_LN": "last_name"}
    )
    result = apply_mapping(sid, config)
    assert result.error_count == 0
    assert result.warning_count == 0
    assert result.rows[0].data["employee_id"] == "EMP001"
    assert result.rows[0].data["first_name"] == "Alice"
    assert result.rows[0].data["last_name"] == "Smith"


def test_apply_mapping_missing_employee_id_is_error():
    rows = [{"Col_ID": "", "Col_FN": "Alice", "Col_LN": "Smith"}]
    sid = create_session(rows, ["Col_ID", "Col_FN", "Col_LN"])
    config = make_config(
        sid, {"Col_ID": "employee_id", "Col_FN": "first_name", "Col_LN": "last_name"}
    )
    result = apply_mapping(sid, config)
    assert result.error_count == 1
    assert any("employee_id" in e for e in result.rows[0].errors)


def test_apply_mapping_missing_name_is_error():
    rows = [{"Col_ID": "EMP001", "Col_FN": "", "Col_LN": "Smith"}]
    sid = create_session(rows, ["Col_ID", "Col_FN", "Col_LN"])
    config = make_config(
        sid, {"Col_ID": "employee_id", "Col_FN": "first_name", "Col_LN": "last_name"}
    )
    result = apply_mapping(sid, config)
    assert result.error_count == 1
    assert any("first_name" in e for e in result.rows[0].errors)


def test_apply_mapping_invalid_email_is_error():
    rows = [{"id": "EMP001", "fn": "Alice", "ln": "Test", "e": "not-an-email"}]
    sid = create_session(rows, ["id", "fn", "ln", "e"])
    config = make_config(
        sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name", "e": "email"}
    )
    result = apply_mapping(sid, config)
    assert result.error_count == 1
    assert any("Invalid email" in e for e in result.rows[0].errors)


def test_apply_mapping_non_numeric_salary_is_error():
    rows = [{"id": "EMP001", "fn": "Alice", "ln": "Test", "s": "not-a-number"}]
    sid = create_session(rows, ["id", "fn", "ln", "s"])
    config = make_config(
        sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name", "s": "salary"}
    )
    result = apply_mapping(sid, config)
    assert result.error_count == 1
    assert any("salary" in e and "numeric" in e for e in result.rows[0].errors)


def test_apply_mapping_duplicate_employee_id_is_warning():
    rows = [
        {"id": "EMP001", "fn": "Alice", "ln": "Test"},
        {"id": "EMP001", "fn": "Duplicate", "ln": "Test"},
    ]
    sid = create_session(rows, ["id", "fn", "ln"])
    config = make_config(sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name"})
    result = apply_mapping(sid, config)
    assert result.warning_count == 1
    assert result.error_count == 0
    assert any("Duplicate employee_id" in w for w in result.rows[1].warnings)


def test_apply_mapping_skipped_column_none_not_in_data():
    rows = [{"id": "EMP001", "fn": "Alice", "ln": "Test", "skip": "ignored"}]
    sid = create_session(rows, ["id", "fn", "ln", "skip"])
    config = make_config(
        sid, {"id": "employee_id", "fn": "first_name", "ln": "last_name", "skip": None}
    )
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


# ─── Feature 056: Multi-program import tests ──────────────────────────────────


def test_split_semicolon_list_basic():
    assert _split_semicolon_list("Alpha; Beta") == ["Alpha", "Beta"]


def test_split_semicolon_list_strips_and_drops_empties():
    assert _split_semicolon_list("; Alpha;;Beta;") == ["Alpha", "Beta"]


def test_split_semicolon_list_single_no_semicolon():
    """A cell with no semicolon returns a single-element list (backward compat)."""
    assert _split_semicolon_list("Alpha") == ["Alpha"]


def test_split_semicolon_list_empty_string():
    assert _split_semicolon_list("") == []


def test_split_semicolon_list_whitespace_only():
    assert _split_semicolon_list("   ") == []


def test_apply_mapping_program_names_normalized_to_list():
    rows = [{"id": "EMP001", "fn": "Alice", "ln": "Smith", "pg": "Alpha; Beta"}]
    sid = create_session(rows, ["id", "fn", "ln", "pg"])
    config = make_config(
        sid,
        {"id": "employee_id", "fn": "first_name", "ln": "last_name", "pg": "program_names"},
    )
    result = apply_mapping(sid, config)
    assert result.error_count == 0
    assert result.rows[0].data["program_names"] == ["Alpha", "Beta"]


def test_apply_mapping_program_names_single_backward_compat():
    """Single program name without semicolon → list with one element."""
    rows = [{"id": "EMP001", "fn": "Alice", "ln": "Smith", "pg": "Alpha"}]
    sid = create_session(rows, ["id", "fn", "ln", "pg"])
    config = make_config(
        sid,
        {"id": "employee_id", "fn": "first_name", "ln": "last_name", "pg": "program_names"},
    )
    result = apply_mapping(sid, config)
    assert result.error_count == 0
    assert result.rows[0].data["program_names"] == ["Alpha"]


def test_apply_mapping_program_team_names_normalized_to_list():
    rows = [{"id": "EMP001", "fn": "Alice", "ln": "Smith", "pg": "Alpha; Beta", "pt": "T1; T2"}]
    sid = create_session(rows, ["id", "fn", "ln", "pg", "pt"])
    config = make_config(
        sid,
        {
            "id": "employee_id",
            "fn": "first_name",
            "ln": "last_name",
            "pg": "program_names",
            "pt": "program_team_names",
        },
    )
    result = apply_mapping(sid, config)
    assert result.error_count == 0
    assert result.rows[0].data["program_team_names"] == ["T1", "T2"]


def test_apply_mapping_program_list_length_mismatch_is_error():
    """Mismatched lengths between program_names and program_team_names → row error."""
    rows = [{"id": "EMP001", "fn": "Alice", "ln": "Smith", "pg": "Alpha; Beta", "pt": "T1"}]
    sid = create_session(rows, ["id", "fn", "ln", "pg", "pt"])
    config = make_config(
        sid,
        {
            "id": "employee_id",
            "fn": "first_name",
            "ln": "last_name",
            "pg": "program_names",
            "pt": "program_team_names",
        },
    )
    result = apply_mapping(sid, config)
    assert result.error_count == 1
    assert any("align positionally" in e for e in result.rows[0].errors)


def test_apply_mapping_program_list_same_length_no_error():
    """Matching lengths between program_names and program_team_names → no error."""
    rows = [{"id": "EMP001", "fn": "Alice", "ln": "Smith", "pg": "Alpha; Beta", "pt": "T1; T2"}]
    sid = create_session(rows, ["id", "fn", "ln", "pg", "pt"])
    config = make_config(
        sid,
        {
            "id": "employee_id",
            "fn": "first_name",
            "ln": "last_name",
            "pg": "program_names",
            "pt": "program_team_names",
        },
    )
    result = apply_mapping(sid, config)
    assert result.error_count == 0
