from datetime import date

import pytest

from app.services.import_date_utils import parse_date


class TestISO8601:
    def test_standard(self):
        assert parse_date("2024-01-15") == date(2024, 1, 15)

    def test_with_time(self):
        assert parse_date("2024-01-15T00:00:00") == date(2024, 1, 15)

    def test_end_of_year(self):
        assert parse_date("2024-12-31") == date(2024, 12, 31)

    def test_invalid_iso_month(self):
        assert parse_date("2024-13-01") is None


class TestExcelSerial:
    def test_known_serial(self):
        result = parse_date("45306")
        assert result is not None
        assert isinstance(result, date)

    def test_serial_one(self):
        assert parse_date("1") == date(1899, 12, 31)

    def test_serial_zero(self):
        assert parse_date("0") == date(1899, 12, 30)

    def test_serial_overflow(self):
        assert parse_date("999999999999") is None


class TestNumericDelimited:
    def test_mdy_slash(self):
        assert parse_date("01/15/2024") == date(2024, 1, 15)

    def test_mdy_single_digit(self):
        assert parse_date("1/5/2024") == date(2024, 1, 5)

    def test_mdy_end_of_year(self):
        assert parse_date("12/31/2023") == date(2023, 12, 31)

    def test_mdy_dot(self):
        assert parse_date("01.15.2024") == date(2024, 1, 15)

    def test_mdy_dash(self):
        assert parse_date("01-15-2024") == date(2024, 1, 15)

    def test_dmy_day_over_12(self):
        assert parse_date("15/01/2024") == date(2024, 1, 15)

    def test_dmy_end_of_year(self):
        assert parse_date("31/12/2023") == date(2023, 12, 31)


class TestTwoDigitYears:
    def test_recent_year(self):
        assert parse_date("01/15/24") == date(2024, 1, 15)

    def test_old_year(self):
        assert parse_date("01/15/99") == date(1999, 1, 15)

    def test_boundary_year(self):
        assert parse_date("01/15/68") == date(2068, 1, 15)


class TestNamedMonth:
    def test_full_month_mdy(self):
        assert parse_date("January 15, 2024") == date(2024, 1, 15)

    def test_short_month_mdy(self):
        assert parse_date("Jan 15, 2024") == date(2024, 1, 15)

    def test_full_month_dmy(self):
        assert parse_date("15 January 2024") == date(2024, 1, 15)

    def test_short_month_dmy(self):
        assert parse_date("15 Jan 2024") == date(2024, 1, 15)


class TestEdgeCases:
    def test_empty(self):
        assert parse_date("") is None

    def test_whitespace(self):
        assert parse_date("   ") is None

    def test_garbage(self):
        assert parse_date("not-a-date") is None

    def test_words(self):
        assert parse_date("hello world") is None

    def test_invalid_day_month(self):
        assert parse_date("13/45/2024") is None

    def test_leading_trailing_whitespace(self):
        assert parse_date("  2024-01-15  ") == date(2024, 1, 15)
