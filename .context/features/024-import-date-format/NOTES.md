# Feature 024: Import Date Format Normalization

## Current Date Handling in the Import Pipeline

### What format is expected everywhere
Both the mapper validator and the commit handler call `date.fromisoformat(str(val))` with zero pre-processing. This means **only ISO 8601 `YYYY-MM-DD` is accepted** at every point in the pipeline. Any other format fails silently or surfaces a row error.

### Pipeline stages, in order

| Stage | File | What happens to dates |
|---|---|---|
| Upload / parse | `import_parser.py`, `import_sheets.py` | Values are stored as raw strings from the CSV/sheet cell — no transformation. |
| Map + preview | `import_mapper.py` lines 26–47 | Calls `date.fromisoformat()` via `_validate_hire_date` (member) and `_validate_effective_date` (history). If it fails, an error is appended to the row and it becomes a preview error row. No normalization — reject only. |
| Commit | `import_commit.py` lines 310–315 (hire_date), 380–385 (effective_date) | Same `date.fromisoformat()` call again. On failure: `hire_date` silently skips (`pass`) while `effective_date` appends an error and moves the row to `error_rows`. So the two date fields have **inconsistent failure behavior** at commit time. |

### Schema / model types
- `TeamMember.hire_date` — SQLAlchemy `Date()`, `Mapped[date | None]` (`team_member.py` line 32).
- `MemberHistory.effective_date` — SQLAlchemy `Date`, `Mapped[date]` not nullable (`member_history.py` line 32).
- Pydantic schemas (`team_member.py`): `hire_date: date | None` on both `TeamMemberCreate` and `TeamMemberUpdate`. Pydantic accepts ISO strings automatically for `date` fields. No custom validator for `hire_date` on the schema — validation only happens in the import mapper.
- `period_start` / `period_end` do **not exist** in the codebase. The history model uses a single `effective_date` per record.

### Frontend
`MapColumnsStep.tsx` and all preview components do zero date handling. The component is a pure column-mapping UI; date values are passed to the backend as raw strings. No format detection, no transformation, no hint displayed to the user about expected format.

---

## Affected Fields

| Field | Entity type | Required? | Current behavior on bad format |
|---|---|---|---|
| `hire_date` | member | optional | Preview error (via `_validate_hire_date`) + silent skip at commit |
| `effective_date` | salary_history, bonus_history, pto_history | required | Preview error (via `_validate_effective_date`) + commit error row |

`period_start` and `period_end` do not exist in this codebase.

---

## Where Normalization Should Be Added

A single `parse_date(val: str) -> date | None` utility function should be introduced in a new `backend/app/services/import_date_utils.py` (or `backend/app/utils/date_utils.py` once that directory exists). It should be called **in the mapper validators**, before `date.fromisoformat()`, so that:

1. The preview accurately reflects what will be committed.
2. Normalized values are stored back into `row.data` so the commit layer sees clean ISO strings.
3. The commit layer's own `date.fromisoformat()` calls continue to work unchanged (they become a cheap safety net, not primary parsing).

Calling normalization only at preview is the right choke point because:
- The mapper is already the validation gate — all row errors surface there.
- The commit re-runs `apply_mapping` (`import_commit.py` line 446), so normalized values will flow through automatically.

**Do not** add normalization in the commit layer directly — it would duplicate logic and hide errors from the preview.

---

## Common Formats to Support

| Format | Example | Notes |
|---|---|---|
| ISO 8601 (current) | `2024-01-15` | Already works. |
| US slash, MDY | `01/15/2024` | Most common US spreadsheet export. |
| US slash, MDY short year | `01/15/24` | Common in older exports. |
| US slash, DMY | `15/01/2024` | Ambiguous with MDY for days > 12. |
| Dot-separated | `15.01.2024` | European spreadsheets. |
| Month-name long | `January 15, 2024` | Readable exports. |
| Month-name short | `Jan 15, 2024` / `15 Jan 2024` | Common in HR tools. |
| ISO with time | `2024-01-15T00:00:00` | Google Sheets datetime cells. |
| Excel serial | `45306` (integer string) | Excel date-as-number; needs epoch offset. |

---

## Risks

### Ambiguous formats (highest risk)
`MM/DD/YYYY` vs `DD/MM/YYYY` cannot be distinguished when day <= 12. For example, `01/02/2024` could be January 2 (US) or February 1 (European).

**Recommended policy**: treat slash-delimited dates as **MDY** (US convention) and document it. If day > 12 and month <= 12, the format must be DMY — attempt that as a fallback. If both interpretations are valid (both day and month <= 12), default to MDY and optionally surface a preview warning.

### Two-digit years
`01/15/24` — Python's `strptime` uses a century pivot (year >= 69 → 1900s, < 69 → 2000s). For hire dates this is almost always fine, but it should be documented.

### Excel serial numbers
These require knowing whether the workbook uses the 1900 or 1904 epoch. The 1900 epoch with Excel's off-by-one bug is standard for Windows Excel. Conversion: `date(1899, 12, 30) + timedelta(days=int(val))`. Only attempt this if the raw value is a pure integer string.

### Silent skip in `_commit_members`
The `pass` at `import_commit.py` line 315 means a `hire_date` that passed preview validation (because `_validate_hire_date` accepted it) but somehow fails `fromisoformat` at commit time is silently dropped. This should be investigated — with normalization in place it should not occur, but the silent `pass` is a latent risk and should at minimum log a warning.

---

## Implementation Sketch

```python
# backend/app/services/import_date_utils.py
from datetime import date, datetime, timedelta
import re

_ISO_RE = re.compile(r'^\d{4}-\d{2}-\d{2}')
_MDY_RE = re.compile(r'^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$')
_NAMED_FMTS = [
    "%B %d, %Y",   # January 15, 2024
    "%b %d, %Y",   # Jan 15, 2024
    "%d %B %Y",    # 15 January 2024
    "%d %b %Y",    # 15 Jan 2024
]

def parse_date(raw: str) -> date | None:
    """Try to parse a date string in several common formats.
    Returns a date or None if unparseable.
    """
    s = raw.strip()
    if not s:
        return None
    # ISO or ISO-with-time
    if _ISO_RE.match(s):
        try:
            return date.fromisoformat(s[:10])
        except ValueError:
            pass
    # Excel serial number
    if s.isdigit():
        return date(1899, 12, 30) + timedelta(days=int(s))
    # Slash/dot/dash delimited numeric
    m = _MDY_RE.match(s)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 100:
            y += 2000 if y < 69 else 1900
        # Disambiguate MDY vs DMY
        if a > 12:                  # must be DMY (a=day)
            return date(y, b, a)
        return date(y, a, b)        # assume MDY
    # Named-month formats
    for fmt in _NAMED_FMTS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None
```

The mapper validators would then call `parse_date()` and, if successful, normalize `data["hire_date"]` / `data["effective_date"]` to `str(parsed_date)` (ISO format) in place before the downstream `date.fromisoformat()` call.
