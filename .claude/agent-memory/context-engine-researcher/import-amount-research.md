---
name: import-amount-research
description: 2026-03-28 findings on how the import pipeline handles salary/bonus/pto amounts, current type coercion gaps, and the date-parsing pattern to follow
type: project
---

# Import Pipeline: Amount/Numeric Field Handling

## 1. Import Pipeline Architecture

Data flow: file upload → parse → session → map+validate → preview → commit.

| Stage | File | What happens to numeric values |
|---|---|---|
| Upload/parse | `backend/app/services/import_parser.py` | CSV cells become raw strings. xlsx cells may be Python `int`/`float` (pandas/openpyxl). No normalization. |
| Session | `backend/app/services/import_session.py` | Stores raw rows as-is, no transformation. |
| Map + validate | `backend/app/services/import_mapper.py` lines 197–203 | **Validation only** — calls `Decimal(str(val))`. If `InvalidOperation`, appends an error. Does NOT strip `$`, commas, or spaces. |
| Commit (member) | `backend/app/services/import_commit.py` line 326 | `Decimal(str(val))` — same blind cast. No stripping. |
| Commit (history) | `import_commit.py` lines 372–377 | `Decimal(str(data.get("amount", "")))` — same blind cast. |

**The gap**: `Decimal("$75,000")` raises `InvalidOperation`. `Decimal("1,500.00")` also raises `InvalidOperation`. The mapper marks these rows as errors and they never reach the DB. There is zero pre-processing to strip currency symbols or thousands separators.

---

## 2. Entity Configs for Financial Fields

Defined in `backend/app/services/import_mapper.py` lines 52–120.

### `member` entity (line 53)
- `numeric_fields = {"salary", "bonus", "pto_used"}`
- These map to `TeamMember.salary`, `.bonus`, `.pto_used` (all `Numeric(12,2)`)

### `salary_history`, `bonus_history`, `pto_history` entities (lines 99–119)
- `numeric_fields = {"amount"}` for all three
- `required_fields = {"employee_id", "effective_date", "amount"}`
- `dedup_field = None` (no row-level dedup; duplicate detection is done against the DB in `_commit_financial_history`)

---

## 3. Current Type Coercion — Detailed

### Mapper validation (import_mapper.py lines 197–203)
```python
for num_field in config.numeric_fields:
    val = data.get(num_field)
    if val is not None and val != "":
        try:
            Decimal(str(val))
        except InvalidOperation:
            errors.append(f"'{num_field}' must be numeric, got '{val}'.")
```
- Calls `Decimal(str(val))` — no sanitization.
- `"$75,000"` → `InvalidOperation` → row error at preview. User sees the error but there is no hint about what format is expected.
- `"75000"`, `"75000.00"`, `75000` (int from xlsx), `75000.0` (float from xlsx) all pass.
- Normalized value is **not written back** into `data`. Even if we fixed the validation, the raw string would still reach the commit layer.

### Commit layer — member (import_commit.py lines 322–326)
```python
for fin_field in _FINANCIAL_FIELDS:
    val = data.get(fin_field)
    if val is not None and val != "":
        await _append_history_if_changed(db, member, fin_field, val, is_new)
        setattr(member, fin_field, Decimal(str(val)))
```
- Same `Decimal(str(val))` — no stripping. Because the mapper already rejected bad values, this is a secondary safety net, but it is also a silent failure path: if a bad value somehow slipped through, it would raise an unhandled `InvalidOperation` and blow up the whole commit transaction.

### Commit layer — `_append_history_if_changed` (import_commit.py lines 87–112)
```python
try:
    new_decimal = Decimal(str(new_value))
except (ValueError, InvalidOperation):
    return   # silently drops the history entry
```
- Catches the exception and silently returns. So a bad value causes history to be skipped without any error surfacing.

### Commit layer — `_commit_financial_history` (import_commit.py lines 370–377)
```python
try:
    amount = Decimal(str(data.get("amount", "")))
except InvalidOperation:
    row.errors.append(f"'amount' could not be parsed as a number.")
    error_rows.append(row)
    continue
```
- This one properly surfaces the error to `error_rows`, consistent with the mapper. Still no stripping.

---

## 4. Date Format Pattern — The Precedent to Follow

Feature 024 (`import_date_utils.py`) established the pattern for adding flexible parsing to the import pipeline. It is the direct model for amount parsing.

### How date normalization was implemented

**New file**: `backend/app/services/import_date_utils.py`
- Pure function `parse_date(raw: str) -> date | None`
- Tries multiple strategies in order: ISO, Excel serial, slash/dot/dash delimited, named-month formats
- Returns `None` on failure; caller decides how to report the error

**Integration point — mapper validators only** (`import_mapper.py` lines 26–49)
- `_validate_hire_date` (line 26): calls `parse_date(str(val))`, if not None writes `data["hire_date"] = str(parsed)` (ISO string) back in place
- `_validate_effective_date` (line 42): same pattern for `effective_date`
- The normalized ISO value flows through to commit automatically because commit calls `apply_mapping()` again

**Key design principle**: normalization happens **in the mapper validators**, not in the commit layer. This means:
1. Preview accurately shows what will be committed
2. The commit's own `date.fromisoformat()` calls become cheap safety nets, not primary parsers
3. No logic duplication

**Test file**: `backend/tests/test_import_date_utils.py` — standalone unit tests for the utility function, separate from mapper/commit tests.

### Amount parsing should follow the exact same pattern

Proposed approach:
1. Create `backend/app/services/import_amount_utils.py` with `parse_amount(raw: str) -> Decimal | None`
2. Strip leading/trailing whitespace, currency symbols (`$`, `£`, `€`, `¥`), thousands separators (`,`), and handle parenthetical negatives `(1500)` → `-1500`
3. Integrate via a new `_validate_numeric_fields` validator OR by extending the inline numeric validation loop in `apply_mapping` to normalize-then-validate
4. Write normalized `str(decimal_value)` back into `data[num_field]` so the commit layer's `Decimal(str(val))` works unchanged

---

## 5. Database Column Types

### `team_members` table — `backend/app/models/team_member.py`
| Column | SQLAlchemy type | Python type |
|---|---|---|
| `salary` | `Numeric(12, 2)` | `Decimal \| None` |
| `bonus` | `Numeric(12, 2)` | `Decimal \| None` |
| `pto_used` | `Numeric(6, 2)` | `Decimal \| None` |

Note: `pto_used` has a tighter precision — `Numeric(6,2)` caps at 9999.99. This is probably fine for PTO days but worth flagging.

### `member_history` table — `backend/app/models/member_history.py`
| Column | SQLAlchemy type | Python type |
|---|---|---|
| `value` | `Numeric(12, 2)` | `Decimal` (NOT NULL) |

The `member_history.value` column is shared across salary, bonus, and pto_used records (distinguished by the `field` column). It uses `Numeric(12,2)` not `Numeric(6,2)`, so PTO history values can exceed what the scalar column stores.

---

## 6. Formats to Handle

| Input | Parsed value | Notes |
|---|---|---|
| `"75000"` | `75000.00` | Already works |
| `"75000.00"` | `75000.00` | Already works |
| `75000` (int) | `75000.00` | Already works (xlsx) |
| `75000.0` (float) | `75000.00` | Already works (xlsx) |
| `"$75,000"` | `75000.00` | **Broken** — needs stripping |
| `"$75,000.00"` | `75000.00` | **Broken** — needs stripping |
| `"1,500.00"` | `1500.00` | **Broken** — needs stripping |
| `"£60,000"` | `60000.00` | **Broken** — needs stripping |
| `"(5000)"` | `-5000.00` | Optional — accounting negative notation |
| `""` / None | skip | Already handled (guard in mapper) |

---

## 7. Touch Points for the Fix

Only the mapper needs to change. The commit layer is already correct once the mapper normalizes values.

1. **New file**: `backend/app/services/import_amount_utils.py` — `parse_amount(raw) -> Decimal | None`
2. **`import_mapper.py` lines 197–203** — replace the bare `Decimal(str(val))` validation with a call to `parse_amount()`; if not None, write normalized string back to `data[num_field]`; if None, append error as before
3. **No changes needed** in `import_commit.py` — its `Decimal(str(val))` calls will receive clean strings
4. **Tests**: `backend/tests/test_import_amount_utils.py` following the same structure as `test_import_date_utils.py`

---

## 8. Risks and Edge Cases

- **Thousands separators vs. decimal separator**: European locales use `.` as thousands separator and `,` as decimal (e.g., `1.500,00`). Stripping all commas and dots would mis-parse these. Safest policy: strip commas only (US/UK convention); document that European formats are not supported. Alternatively, detect whether a comma precedes exactly 3 digits followed by end-of-string.
- **`pto_used` precision cap**: `Numeric(6,2)` means max 9999.99. An import row with `pto_used = "10000"` will be truncated or raise a DB error depending on PostgreSQL configuration. The mapper could add a range check for this field specifically.
- **`_append_history_if_changed` silent drop**: `import_commit.py` lines 95–100 silently returns on `InvalidOperation`. Once the mapper normalizes values, this should never trigger — but it is a latent silent failure. Consider adding a log warning there.
