from pathlib import Path

import pytest

from app.services.import_parser import ImportParseError, parse_upload

FIXTURES = Path(__file__).parent.parent / "fixtures"


def test_parse_csv_valid_returns_headers_and_rows():
    file_bytes = (FIXTURES / "valid_members.csv").read_bytes()
    result = parse_upload(file_bytes, "valid_members.csv")
    assert result.total_row_count == 5
    assert "employee_id" in result.headers
    assert "name" in result.headers
    assert "email" in result.headers
    assert len(result.preview_rows) == 5
    assert result.raw_rows[0]["employee_id"] == "EMP001"


def test_parse_csv_preview_capped_at_10():
    header = "employee_id,name\n"
    rows = "".join(f"EMP{i:03d},Person {i}\n" for i in range(15))
    file_bytes = (header + rows).encode()
    result = parse_upload(file_bytes, "big.csv")
    assert result.total_row_count == 15
    assert len(result.preview_rows) == 10


def test_parse_csv_latin1_encoding_fallback():
    encoded = "employee_id,name\nEMP001,Ren\xe9".encode("latin-1")
    result = parse_upload(encoded, "latin.csv")
    assert result.raw_rows[0]["name"] == "René"


def test_parse_xlsx_valid():
    file_bytes = (FIXTURES / "valid_members.xlsx").read_bytes()
    result = parse_upload(file_bytes, "valid_members.xlsx")
    assert result.total_row_count == 5
    # openpyxl via pandas reads numeric columns as numbers, employee_id header col was string
    assert result.raw_rows[0]["employee_id"] == "EMP001"


def test_parse_xls_raises():
    with pytest.raises(ImportParseError, match="not supported"):
        parse_upload(b"dummy", "file.xls")


def test_parse_unsupported_extension_raises():
    with pytest.raises(ImportParseError, match=r"\.txt"):
        parse_upload(b"dummy", "file.txt")


def test_parse_empty_csv_returns_zero_rows():
    result = parse_upload(b"employee_id,name\n", "empty.csv")
    assert result.total_row_count == 0
    assert result.headers == ["employee_id", "name"]
