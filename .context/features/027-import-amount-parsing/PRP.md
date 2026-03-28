---
feature: 027-import-amount-parsing
status: APPROVED
complexity: LOW
testing_strategy: implement-then-test
created: 2026-03-28
depends_on: 021-financial-history-import
---

# PRP: Import Amount Parsing

## Problem Statement

The numeric field validator in `backend/app/services/import_mapper.py` (lines 197–203) calls `Decimal(str(val))` with no pre-processing. Real-world spreadsheet exports produce values like `"$75,000"`, `"1,500.00"`, `"(500)"`, and `" €1,200 "`. All of these raise `InvalidOperation` and produce row-level validation errors that block the import.

## Solution Overview

Introduce a `parse_amount(raw: str) -> Decimal | None` utility in a new file `backend/app/services/import_amount_utils.py`. The function strips currency symbols, thousands commas, and whitespace, then handles parentheses for negative notation before calling `Decimal()`. On failure it returns `None`. Update the numeric field validation loop in `import_mapper.py` to call `parse_amount()` instead of bare `Decimal()`, and normalize the value in `data` in-place on success. The commit layer's `Numeric(12,2)` / `Numeric(6,2)` column types remain unchanged — they remain a cheap safety net.

---

## Implementation Steps

### Step 1 — Create `backend/app/services/import_amount_utils.py`

**File:** `backend/app/services/import_amount_utils.py` — CREATE

Implement a single public function `parse_amount(raw: str) -> Decimal | None` using only the Python standard library (`decimal`, `re`). No third-party dependencies.

The function must apply the following transformations in order before attempting to construct a `Decimal`, then return the `Decimal` on success or `None` on any failure.

**Pre-processing pipeline (applied to the stripped string in sequence):**

1. Strip leading and trailing whitespace.
2. If the result is empty, return `None`.
3. Check for parentheses-negative notation: if the string matches `^\(.*\)$` (opens with `(` and closes with `)`), strip the parentheses and prepend a `-` sign. Example: `"(500)"` → `"-500"`, `"($1,200)"` → `"-$1,200"`.
4. Strip currency symbols: remove all occurrences of `$`, `£`, `€`, `¥` from the string.
5. Strip thousands separators: remove all commas (`,`) from the string.
6. Strip any remaining whitespace (handles cases like `"$ 1,200"` where there is a space after the symbol).

**Decimal construction:**

Call `Decimal(cleaned)` inside a `try/except InvalidOperation` block. Return the `Decimal` on success, `None` on `InvalidOperation`.

**Edge cases the function must handle gracefully (return `None`, not raise):**

- Empty string or whitespace-only string.
- Strings with only a currency symbol, e.g. `"$"`.
- Strings that are not numbers after stripping, e.g. `"N/A"`, `"TBD"`.
- Negative sign alone, e.g. `"-"`.

**Validation:**

```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -c "
from decimal import Decimal
from app.services.import_amount_utils import parse_amount
assert parse_amount('75000') == Decimal('75000')
assert parse_amount('\$75,000') == Decimal('75000')
assert parse_amount('1,500.00') == Decimal('1500.00')
assert parse_amount('(500)') == Decimal('-500')
assert parse_amount('(\$1,200.50)') == Decimal('-1200.50')
assert parse_amount('  \$  1,200  ') == Decimal('1200')
assert parse_amount('') is None
assert parse_amount('\$') is None
assert parse_amount('N/A') is None
print('all ok')
"
```

---

### Step 2 — Update numeric field validation in `backend/app/services/import_mapper.py`

**File:** `backend/app/services/import_mapper.py` — MODIFY

**2a. Add the import.** Near the top of the file, after the existing `from decimal import Decimal, InvalidOperation` import line, add:

```
from app.services.import_amount_utils import parse_amount
```

**2b. Replace the numeric validation block (lines 197–203).** The current implementation:

```python
        # Numeric field validation
        for num_field in config.numeric_fields:
            val = data.get(num_field)
            if val is not None and val != "":
                try:
                    Decimal(str(val))
                except InvalidOperation:
                    errors.append(f"'{num_field}' must be numeric, got '{val}'.")
```

Replace with:

```python
        # Numeric field validation
        for num_field in config.numeric_fields:
            val = data.get(num_field)
            if val is not None and val != "":
                result = parse_amount(str(val))
                if result is None:
                    errors.append(f"'{num_field}' must be numeric, got '{val}'.")
                else:
                    data[num_field] = str(result)  # normalize to plain decimal string in-place
```

The in-place normalization of `data[num_field]` is the critical behavior: after this block runs, any numeric field is a clean decimal string (e.g. `"75000"`, `"-1200.50"`) so the commit layer's `Numeric` column assignment continues to work without modification.

The `InvalidOperation` import may still be needed elsewhere in the file. Do not remove it — only add the new import.

**Validation:**

```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -c "
from app.services.import_mapper import apply_mapping
print('import ok')
"
```

---

### Step 3 — Write tests for `parse_amount` in `backend/tests/test_import_amount_utils.py`

**File:** `backend/tests/test_import_amount_utils.py` — CREATE

Use plain `pytest` — no async, no database, no fixtures. All tests are synchronous unit tests of the pure `parse_amount` function. Import `Decimal` from `decimal` for all expected values.

**Test groups and cases:**

**Plain numeric strings**
- `parse_amount("75000")` returns `Decimal("75000")`
- `parse_amount("1500.00")` returns `Decimal("1500.00")`
- `parse_amount("0")` returns `Decimal("0")`
- `parse_amount("-500")` returns `Decimal("-500")`
- `parse_amount("0.99")` returns `Decimal("0.99")`

**Currency symbols**
- `parse_amount("$75,000")` returns `Decimal("75000")`
- `parse_amount("£1,500.00")` returns `Decimal("1500.00")`
- `parse_amount("€1200")` returns `Decimal("1200")`
- `parse_amount("¥50000")` returns `Decimal("50000")`

**Thousands commas (no symbol)**
- `parse_amount("1,500.00")` returns `Decimal("1500.00")`
- `parse_amount("1,000,000")` returns `Decimal("1000000")`

**Whitespace**
- `parse_amount("  75000  ")` returns `Decimal("75000")`
- `parse_amount("$ 1,200")` returns `Decimal("1200")` (space after symbol)

**Parentheses-negative notation**
- `parse_amount("(500)")` returns `Decimal("-500")`
- `parse_amount("($1,200.50)")` returns `Decimal("-1200.50")`
- `parse_amount("(75000)")` returns `Decimal("-75000")`

**Failure / edge cases**
- `parse_amount("")` returns `None`
- `parse_amount("   ")` returns `None`
- `parse_amount("N/A")` returns `None`
- `parse_amount("TBD")` returns `None`
- `parse_amount("$")` returns `None`
- `parse_amount("-")` returns `None`
- `parse_amount("1,500.00.00")` returns `None` (multiple decimal points)

**Validation:**

```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -m pytest tests/test_import_amount_utils.py -v
# All tests must pass
```

---

## File Manifest

| File | Action |
|------|--------|
| `backend/app/services/import_amount_utils.py` | Create — `parse_amount()` utility |
| `backend/app/services/import_mapper.py` | Modify — replace numeric validation block; add import |
| `backend/tests/test_import_amount_utils.py` | Create — unit tests for `parse_amount()` |

---

## Validation Criteria

- [ ] `cd /Users/clint/Workspace/team-resourcer/backend && python -c "from app.services.import_amount_utils import parse_amount"` exits 0
- [ ] `cd /Users/clint/Workspace/team-resourcer/backend && python -c "from app.services.import_mapper import apply_mapping"` exits 0
- [ ] `cd /Users/clint/Workspace/team-resourcer/backend && python -m pytest tests/test_import_amount_utils.py -v` — all tests pass
- [ ] `cd /Users/clint/Workspace/team-resourcer/backend && python -m pytest` — no regressions in existing tests
- [ ] Manual smoke: a row with `salary="$75,000"` produces zero errors and `data["salary"] == "75000"` after `apply_mapping()`
- [ ] Manual smoke: a row with `salary="(1500)"` produces zero errors and `data["salary"] == "-1500"` after `apply_mapping()`
- [ ] Manual smoke: a row with `salary="not-a-number"` produces one error containing `"salary"`

---

## Risks and Gotchas

1. **`InvalidOperation` import may appear unused after the change** — The `from decimal import Decimal, InvalidOperation` import in `import_mapper.py` may be flagged by a linter as having an unused `InvalidOperation` if nothing else in the file catches it. Check whether `InvalidOperation` is used elsewhere in the file before removing it. The safe default is to leave the import as-is.

2. **European number format is out of scope** — Strings using `.` as thousands separator and `,` as decimal separator (e.g. `"1.500,00"`) are not handled. `parse_amount("1.500,00")` will return `None` after stripping the comma, because `"1.500.00"` — wait, it will actually strip the comma to yield `"1.500"` and return `Decimal("1.500")` which equals `1.5`, silently wrong. This is a documented limitation, not a bug to fix here. If European formatting is encountered, the correct behavior (returning `None`) requires detecting the locale from the string structure, which is out of scope.

   Concretely: `"1.500,00"` after comma-strip becomes `"1.500"` → `Decimal("1.500")` = 1.5. This is a silent misparse. Document this limitation in a comment in `import_amount_utils.py`.

3. **Commas inside parentheses** — `"(1,200)"` pre-processes to `"-1,200"` (negate first, strip symbol, then strip commas) → `"-1200"` → `Decimal("-1200")`. This is the correct result. The pre-processing order in Step 1 (parentheses → strip symbol → strip commas) handles this correctly.

4. **`str(result)` normalization may change precision** — `str(Decimal("1500.00"))` is `"1500.00"` (Decimal preserves trailing zeros). `str(Decimal("1500"))` is `"1500"`. SQLAlchemy's `Numeric(12,2)` column accepts both. No precision loss occurs at the DB layer. This is expected behavior.

5. **Existing tests asserting on the old error message** — The old error message was `"'{num_field}' must be numeric, got '{val}'."`. The new message is identical in wording. No test message updates are needed.

   Confirm with:
   ```bash
   grep -r "must be numeric" /Users/clint/Workspace/team-resourcer/backend/tests/
   ```
