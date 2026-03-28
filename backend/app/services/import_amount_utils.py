"""Amount parsing utility for the import pipeline.

Strips currency symbols, thousands separators, and whitespace, then returns
a ``Decimal`` or ``None``.

NOTE: European number formatting (e.g. "1.500,00" meaning 1500) is not
supported. Commas are always treated as thousands separators (US convention).
"1.500,00" would be silently misparsed as 1.5 — the same ambiguity trade-off
as MDY/DMY date detection.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

_CURRENCY_RE = re.compile(r"[$£€¥]")
_PARENS_RE = re.compile(r"^\((.+)\)$")


def parse_amount(raw: str) -> Decimal | None:
    """Try to parse an amount string into a Decimal.

    Handles currency symbols, thousands commas, whitespace, and
    parentheses-negative notation.  Returns ``None`` on failure.
    """
    s = raw.strip()
    if not s:
        return None

    # Parentheses-negative: (500) -> -500, ($1,200) -> -$1,200
    m = _PARENS_RE.match(s)
    if m:
        s = "-" + m.group(1)

    # Strip currency symbols
    s = _CURRENCY_RE.sub("", s)

    # Strip thousands commas (US convention only — see module docstring for European format limitation)
    s = s.replace(",", "")

    # Strip remaining whitespace (handles "$ 1,200")
    s = s.strip()

    if not s or s == "-":
        return None

    try:
        result = Decimal(s)
    except InvalidOperation:
        return None
    return result if result.is_finite() else None
