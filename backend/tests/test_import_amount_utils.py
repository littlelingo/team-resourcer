from decimal import Decimal

from app.services.import_amount_utils import parse_amount


class TestPlainNumeric:
    def test_integer(self):
        assert parse_amount("75000") == Decimal("75000")

    def test_decimal(self):
        assert parse_amount("1500.00") == Decimal("1500.00")

    def test_zero(self):
        assert parse_amount("0") == Decimal("0")

    def test_negative(self):
        assert parse_amount("-500") == Decimal("-500")

    def test_small_decimal(self):
        assert parse_amount("0.99") == Decimal("0.99")


class TestCurrencySymbols:
    def test_dollar(self):
        assert parse_amount("$75,000") == Decimal("75000")

    def test_pound(self):
        assert parse_amount("£1,500.00") == Decimal("1500.00")

    def test_euro(self):
        assert parse_amount("€1200") == Decimal("1200")

    def test_yen(self):
        assert parse_amount("¥50000") == Decimal("50000")


class TestThousandsCommas:
    def test_one_comma(self):
        assert parse_amount("1,500.00") == Decimal("1500.00")

    def test_two_commas(self):
        assert parse_amount("1,000,000") == Decimal("1000000")


class TestWhitespace:
    def test_leading_trailing(self):
        assert parse_amount("  75000  ") == Decimal("75000")

    def test_space_after_symbol(self):
        assert parse_amount("$ 1,200") == Decimal("1200")


class TestParenthesesNegative:
    def test_plain(self):
        assert parse_amount("(500)") == Decimal("-500")

    def test_with_currency_and_comma(self):
        assert parse_amount("($1,200.50)") == Decimal("-1200.50")

    def test_large(self):
        assert parse_amount("(75000)") == Decimal("-75000")


class TestFailureCases:
    def test_empty_string(self):
        assert parse_amount("") is None

    def test_whitespace_only(self):
        assert parse_amount("   ") is None

    def test_na(self):
        assert parse_amount("N/A") is None

    def test_tbd(self):
        assert parse_amount("TBD") is None

    def test_currency_symbol_only(self):
        assert parse_amount("$") is None

    def test_dash_only(self):
        assert parse_amount("-") is None

    def test_multiple_decimal_points(self):
        assert parse_amount("1,500.00.00") is None

    def test_nan(self):
        assert parse_amount("NaN") is None

    def test_infinity(self):
        assert parse_amount("Infinity") is None
