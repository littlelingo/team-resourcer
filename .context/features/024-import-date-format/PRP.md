---
feature: 024-import-date-format
status: COMPLETE
complexity: LOW
testing_strategy: implement-then-test
created: 2026-03-28
depends_on: 021-financial-history-import
---

# PRP: Import Date Format Normalization

## Problem Statement

The import pipeline accepts only ISO 8601 `YYYY-MM-DD` dates. Both `hire_date` (member import) and `effective_date` (salary/bonus/PTO history import) call `date.fromisoformat()` with zero pre-processing. Any other format — US slash-delimited, named-month, Excel serial — causes a row-level validation error and blocks the import. Common spreadsheet exports use none of these formats.

## Solution Overview

Introduce a `parse_date(raw: str) -> date | None` utility in a new file `backend/app/services/import_date_utils.py`. The function tries a ranked sequence of format strategies (ISO, Excel serial, numeric-delimited, named-month) and returns `None` on total failure. Update the two validator functions in `import_mapper.py` to call `parse_date()` instead of `date.fromisoformat()`, and normalize the value in `data` to an ISO string in-place on success. The commit layer's existing `date.fromisoformat()` calls are unchanged — they remain a cheap safety net against anything that somehow escaped the mapper.

---

## Implementation Steps

### Step 1 — Create `backend/app/services/import_date_utils.py`

**File:** `backend/app/services/import_date_utils.py` — CREATE

Implement a single public function `parse_date(raw: str) -> date | None` using only the Python standard library (`datetime`, `re`). No third-party dependencies.

The function must try the following strategies in order, returning the first successful `date` object, or `None` if all strategies fail.

**Strategy 1 — ISO 8601 (with or without time component)**

Check whether the stripped string matches the pattern `^\d{4}-\d{2}-\d{2}`. If so, call `date.fromisoformat(s[:10])`. Handles `2024-01-15` and `2024-01-15T00:00:00` (Google Sheets datetime export). Return on success, catch `ValueError` and continue.

**Strategy 2 — Excel serial number**

Check whether the stripped string is a pure integer using `s.isdigit()`. If so, compute `date(1899, 12, 30) + timedelta(days=int(s))`. This uses the 1900 Windows Excel epoch with its standard off-by-one correction. Return immediately — no try/except needed since any positive integer will produce a valid date.

Do not attempt this strategy if the string contains any non-digit characters, to avoid treating short numeric strings that are actually partial dates as serials.

**Strategy 3 — Slash, dot, or dash-delimited numeric (MDY / DMY)**

Use the regex `^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$` to match the three components `a`, `b`, `y`. If the pattern matches:

1. Parse all three groups as integers.
2. If `y < 100`: apply the century pivot — `y += 2000 if y < 69 else 1900`. This matches Python's `strptime` behavior and is correct for modern hire dates.
3. Disambiguate MDY vs DMY:
   - If `a > 12`: the first component cannot be a month, so interpret as DMY (`month=b`, `day=a`).
   - Otherwise: assume MDY (`month=a`, `day=b`). This is the US convention default. When both `a <= 12` and `b <= 12`, the ambiguity is unresolvable — MDY wins silently.
4. Call `date(y, month, day)`. Catch `ValueError` (e.g., `month=13` after wrong disambiguation path) and continue to the next strategy.

**Strategy 4 — Named-month formats**

Try each format string in the following list, in order, using `datetime.strptime(s, fmt).date()`:

```
"%B %d, %Y"   →  January 15, 2024
"%b %d, %Y"   →  Jan 15, 2024
"%d %B %Y"    →  15 January 2024
"%d %b %Y"    →  15 Jan 2024
```

Return the first success. Catch `ValueError` for each and continue.

**Failure**

If all strategies are exhausted, return `None`.

**Edge cases the function must handle gracefully (return `None`, not raise):**

- Empty string or whitespace-only string.
- Non-string input should not be passed; the callers always convert to `str` first, but if `raw` is falsy after stripping, return `None` immediately.
- Any string that matches a strategy's syntax but produces an invalid date (e.g., `13/45/2024`) must return `None`, not raise.

**Validation:**

```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -c "
from app.services.import_date_utils import parse_date
from datetime import date
assert parse_date('2024-01-15') == date(2024, 1, 15)
assert parse_date('2024-01-15T00:00:00') == date(2024, 1, 15)
assert parse_date('45306') is not None        # Excel serial — any valid date
assert parse_date('01/15/2024') == date(2024, 1, 15)
assert parse_date('15/01/2024') == date(2024, 1, 15)  # DMY because day>12
assert parse_date('January 15, 2024') == date(2024, 1, 15)
assert parse_date('Jan 15, 2024') == date(2024, 1, 15)
assert parse_date('15 Jan 2024') == date(2024, 1, 15)
assert parse_date('') is None
assert parse_date('not-a-date') is None
print('all ok')
"
```

---

### Step 2 — Update `_validate_hire_date` in `backend/app/services/import_mapper.py`

**File:** `backend/app/services/import_mapper.py` — MODIFY

**2a. Add the import.** At the top of the file, after the existing `from datetime import date` import, add:

```
from app.services.import_date_utils import parse_date
```

**2b. Replace the body of `_validate_hire_date` (lines 26–32).** The current implementation:

```python
def _validate_hire_date(data: dict[str, Any], errors: list[str]) -> None:
    val = data.get("hire_date")
    if val and val != "":
        try:
            date.fromisoformat(str(val))
        except ValueError:
            errors.append(f"'hire_date' must be ISO date format (YYYY-MM-DD), got '{val}'.")
```

Replace with:

```python
def _validate_hire_date(data: dict[str, Any], errors: list[str]) -> None:
    val = data.get("hire_date")
    if val and val != "":
        parsed = parse_date(str(val))
        if parsed is None:
            errors.append(f"'hire_date' could not be parsed as a date, got '{val}'.")
        else:
            data["hire_date"] = str(parsed)   # normalize to ISO string in-place
```

The in-place normalization of `data["hire_date"]` is the critical behavior: after this validator runs, `data["hire_date"]` is always a clean `YYYY-MM-DD` string if valid, so the commit layer's `date.fromisoformat()` call at `import_commit.py` line 313 continues to work without modification.

**Validation:**

```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -c "
from app.services.import_mapper import apply_mapping
print('import ok')
"
```

---

### Step 3 — Update `_validate_effective_date` in `backend/app/services/import_mapper.py`

**File:** `backend/app/services/import_mapper.py` — MODIFY (same file as Step 2)

**Replace the body of `_validate_effective_date` (lines 41–47).** The current implementation:

```python
def _validate_effective_date(data: dict[str, Any], errors: list[str]) -> None:
    val = data.get("effective_date")
    if val and val != "":
        try:
            date.fromisoformat(str(val))
        except ValueError:
            errors.append(f"'effective_date' must be ISO date format (YYYY-MM-DD), got '{val}'.")
```

Replace with:

```python
def _validate_effective_date(data: dict[str, Any], errors: list[str]) -> None:
    val = data.get("effective_date")
    if val and val != "":
        parsed = parse_date(str(val))
        if parsed is None:
            errors.append(f"'effective_date' could not be parsed as a date, got '{val}'.")
        else:
            data["effective_date"] = str(parsed)   # normalize to ISO string in-place
```

Same normalization rationale as Step 2. The commit layer's `date.fromisoformat()` call at `import_commit.py` line 381 continues to work without modification.

**Validation:**

```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -c "
from app.services.import_mapper import ENTITY_CONFIGS, apply_mapping
# Quick smoke test: valid non-ISO date passes through
from app.services.import_session import ImportSession
import app.services.import_session as _sess
sid = 'test-024'
_sess._sessions[sid] = type('S', (), {'raw_rows': [{'date_col': '01/15/2024', 'emp': 'E1', 'fn': 'A', 'ln': 'B'}]})()
print('mapper loads ok')
"
```

---

### Step 4 — Write tests for `parse_date` in `backend/tests/test_import_date_utils.py`

**File:** `backend/tests/test_import_date_utils.py` — CREATE

Use plain `pytest` — no async, no database, no fixtures. All tests are synchronous unit tests of the pure `parse_date` function.

Test groups and cases:

**ISO 8601**
- `parse_date("2024-01-15")` returns `date(2024, 1, 15)`
- `parse_date("2024-01-15T00:00:00")` returns `date(2024, 1, 15)` (strips time component)
- `parse_date("2024-12-31")` returns `date(2024, 12, 31)`

**Excel serial numbers**
- `parse_date("45306")` returns a valid `date` instance (not `None`)
- `parse_date("1")` returns `date(1899, 12, 31)` (epoch + 1 day)
- `parse_date("0")` is either `None` or a valid date — the test should assert it does not raise (behavior for serial `0` is ambiguous; `date(1899, 12, 30)` is valid Python, so accept either `date(1899, 12, 30)` or `None`)

Note: `"0".isdigit()` is `True`, so the current implementation will attempt the serial strategy and return `date(1899, 12, 30) + timedelta(0)` = `date(1899, 12, 30)`. The test should accept this as a valid date rather than asserting `None`, since it is technically correct behavior for serial 0.

**Slash/dot/dash numeric — MDY (US convention)**
- `parse_date("01/15/2024")` returns `date(2024, 1, 15)`
- `parse_date("1/5/2024")` returns `date(2024, 1, 5)` (single-digit month and day)
- `parse_date("12/31/2023")` returns `date(2023, 12, 31)`
- `parse_date("01.15.2024")` returns `date(2024, 1, 15)` (dot separator)
- `parse_date("01-15-2024")` returns `date(2024, 1, 15)` (dash separator, non-ISO order)

**Slash-numeric — DMY disambiguation (first component > 12)**
- `parse_date("15/01/2024")` returns `date(2024, 1, 15)` (15 > 12, must be DMY)
- `parse_date("31/12/2023")` returns `date(2023, 12, 31)`

**Two-digit years**
- `parse_date("01/15/24")` returns `date(2024, 1, 15)` (24 < 69 → 2024)
- `parse_date("01/15/99")` returns `date(1999, 1, 15)` (99 >= 69 → 1999)
- `parse_date("01/15/68")` returns `date(2068, 1, 15)` (68 < 69 → 2068)

**Named-month formats**
- `parse_date("January 15, 2024")` returns `date(2024, 1, 15)`
- `parse_date("Jan 15, 2024")` returns `date(2024, 1, 15)`
- `parse_date("15 January 2024")` returns `date(2024, 1, 15)`
- `parse_date("15 Jan 2024")` returns `date(2024, 1, 15)`

**Failure / edge cases**
- `parse_date("")` returns `None`
- `parse_date("   ")` returns `None` (whitespace only)
- `parse_date("not-a-date")` returns `None`
- `parse_date("hello world")` returns `None`
- `parse_date("13/45/2024")` returns `None` (invalid day/month combination)
- `parse_date("2024-13-01")` returns `None` (invalid ISO month)

**Validation:**

```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -m pytest tests/test_import_date_utils.py -v
# All tests must pass
```

---

## File Manifest

| File | Action |
|------|--------|
| `backend/app/services/import_date_utils.py` | Create — `parse_date()` utility |
| `backend/app/services/import_mapper.py` | Modify — update `_validate_hire_date` and `_validate_effective_date`; add import |
| `backend/tests/test_import_date_utils.py` | Create — unit tests for `parse_date()` |

---

## Validation Criteria

- `python -c "from app.services.import_date_utils import parse_date"` succeeds with no errors
- `python -c "from app.services.import_mapper import apply_mapping"` succeeds with no errors — confirms the new import resolves correctly
- All existing mapper tests (if any) continue to pass — the error message wording changed from "must be ISO date format (YYYY-MM-DD)" to "could not be parsed as a date"; update any test that asserts on the old message
- `apply_mapping()` for `member` entity: a row with `hire_date="01/15/2024"` produces zero errors and `data["hire_date"] == "2024-01-15"`
- `apply_mapping()` for `salary_history` entity: a row with `effective_date="Jan 15, 2024"` produces zero errors and `data["effective_date"] == "2024-01-15"`
- `apply_mapping()` for `member` entity: a row with `hire_date="not-a-date"` produces one error containing `"hire_date"`
- All unit tests in `test_import_date_utils.py` pass
- `python -m pytest backend/` passes with no regressions

---

## Risks and Gotchas

1. **Ambiguous dates when both components <= 12** — `01/02/2024` could be January 2 (MDY) or February 1 (DMY). The implementation always defaults to MDY for these cases. This is a documented trade-off, not a bug. European-format CSVs where both day and month are <= 12 will silently be misinterpreted as MDY. There is no reliable way to auto-detect the convention without metadata.

2. **Excel serial `0` edge case** — `"0".isdigit()` is `True`, so `parse_date("0")` will return `date(1899, 12, 30)`. This is technically correct per the 1900 Excel epoch but is almost certainly a data error in a real CSV. The function does not guard against very early dates; callers are expected to validate date range plausibility separately if needed.

3. **`"0"` and other small integer strings** — Short numeric strings like `"1"`, `"2"` etc. will match the Excel serial strategy before the MDY-numeric strategy. This means a single-digit number in a date column will be interpreted as an Excel serial, not as a day or month component. In practice this should not occur in well-formed CSVs, but implementors should be aware of the precedence.

4. **Regex `[/\-.]` dash placement** — In a character class, `-` must be either first, last, or escaped. The implementation sketch in NOTES.md writes `[/\-.]` (escaped dash). This is correct. Do not rearrange to `[/-.]` without verifying the regex engine does not interpret it as a range.

5. **Named-month formats are case-sensitive in `strptime`** — `datetime.strptime("january 15, 2024", "%B %d, %Y")` raises `ValueError` on some platforms. Consider normalizing the string with `.strip()` only — do not lowercase it, as `strptime` on CPython handles mixed case for `%B` and `%b` correctly. If case sensitivity becomes an issue, test with lowercase month names and add a `.title()` normalization step.

6. **Commit-layer `pass` on `hire_date` parse failure** — `import_commit.py` line 315 has `pass` on `ValueError` from `date.fromisoformat()`. With normalization in place, this branch should never be reached for rows that passed preview. It remains a latent risk for any edge case that slips through. It is acceptable to leave it as-is for this feature; a future cleanup PRP could add a warning log there.

7. **Error message wording change** — The old messages were `"must be ISO date format (YYYY-MM-DD), got '...'"`. The new messages are `"could not be parsed as a date, got '...'"`. If any existing test in the project asserts the old message text verbatim, it will break. Check with:
   ```bash
   grep -r "must be ISO date format" /Users/clint/Workspace/team-resourcer/backend/tests/
   ```
   Update any matching assertion to the new wording.
