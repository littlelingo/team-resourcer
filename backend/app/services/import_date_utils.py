"""Date parsing utility for the import pipeline.

Tries several common date formats and returns a ``datetime.date`` or ``None``.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta

_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")
_NUMERIC_RE = re.compile(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$")
_NAMED_FMTS = [
    "%B %d, %Y",  # January 15, 2024
    "%b %d, %Y",  # Jan 15, 2024
    "%d %B %Y",   # 15 January 2024
    "%d %b %Y",   # 15 Jan 2024
]


def parse_date(raw: str) -> date | None:
    """Try to parse a date string in several common formats.

    Returns a ``date`` on success, or ``None`` if the value is unparseable.
    """
    s = raw.strip()
    if not s:
        return None

    # Strategy 1 — ISO 8601 (with optional time component)
    if _ISO_RE.match(s):
        try:
            return date.fromisoformat(s[:10])
        except ValueError:
            pass

    # Strategy 2 — Excel serial number (pure digits only)
    if s.isdigit():
        try:
            return date(1899, 12, 30) + timedelta(days=int(s))
        except (ValueError, OverflowError):
            pass

    # Strategy 3 — Slash/dot/dash delimited numeric (MDY default, DMY fallback)
    m = _NUMERIC_RE.match(s)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 100:
            y += 2000 if y < 69 else 1900
        if a > 12:
            month, day = b, a  # must be DMY
        else:
            month, day = a, b  # assume MDY
        try:
            return date(y, month, day)
        except ValueError:
            pass

    # Strategy 4 — Named-month formats
    for fmt in _NAMED_FMTS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue

    return None
