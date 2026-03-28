# Research: Import Amount String-to-Numeric Conversion

## Problem Statement

When importing salaries, bonuses, or PTO amounts, values may arrive as strings with currency symbols and formatting (e.g., `"$75,000"`, `"1,500.00"`, `"€2000"`). The current pipeline calls `Decimal(str(val))` with no pre-processing, which raises `InvalidOperation` on any non-numeric characters. These rows surface as errors in the preview — they never reach the DB.

## Current State

### Numeric Validation (`backend/app/services/import_mapper.py:197-203`)

The mapper iterates `numeric_fields` and calls `Decimal(str(val))`. No stripping of currency symbols or thousands separators. Bad values produce row-level errors visible at preview.

### Commit Layer (`backend/app/services/import_commit.py`)

- `_commit_members` (lines 322-326): `Decimal(str(val))` for salary/bonus/pto_used
- `_commit_financial_history` (lines 370-377): `Decimal(str(val))` for history value
- `_append_history_if_changed` (lines 95-100): `Decimal(str(val))` — silently swallows `InvalidOperation`

All use bare `Decimal(str(val))` — no sanitization. But since the mapper already rejects bad values, they never reach the commit layer.

### Database Column Types

- `team_member.salary`: `Numeric(12,2)`
- `team_member.bonus`: `Numeric(12,2)`
- `team_member.pto_used`: `Numeric(6,2)` (max 9999.99)
- `member_history.value`: `Numeric(12,2)` (NOT NULL)

### Existing Pattern: Date Format Detection (Feature 024)

Feature 024 established the canonical pattern for import value normalization:

1. New utility module: `import_date_utils.py` with pure `detect_and_normalize_date()` function
2. Integration via mapper validators only — normalize value and write back into `data[field]`
3. Commit layer unchanged — `date.fromisoformat()` becomes a cheap safety net

## Proposed Approach

Follow the feature 024 pattern exactly:

1. **New file**: `backend/app/services/import_amount_utils.py`
   - `parse_amount(raw: str) -> Decimal | None`
   - Strip: currency symbols (`$`, `£`, `€`, `¥`), thousands commas, whitespace, parentheses (for negative notation)
   - Return `Decimal` on success, `None` on failure

2. **Modify**: `backend/app/services/import_mapper.py` (lines 197-203)
   - Replace bare `Decimal(str(val))` with `parse_amount()` call
   - Write `str(result)` back to `data[num_field]` on success (normalization step)

3. **New tests**: `backend/tests/test_import_amount_utils.py`

## Files to Modify

| File | Change |
|------|--------|
| `backend/app/services/import_amount_utils.py` | NEW — `parse_amount()` function |
| `backend/app/services/import_mapper.py` | Replace numeric validation with `parse_amount()` call + write-back |
| `backend/tests/test_import_amount_utils.py` | NEW — unit tests for `parse_amount()` |

## Scope

- All `numeric_fields` across all entity configs benefit (member, salary_history, bonus_history, pto_history)
- One fix in the mapper covers all cases

## Out of Scope

- European number formatting (`.` as thousands, `,` as decimal) — ambiguous with US format, same trade-off as MDY/DMY dates
- Range validation for `pto_used` `Numeric(6,2)` cap — separate concern

## Risks

- Stripping commas could misinterpret European decimals (e.g., `1,50` meaning `1.50`). Document US format assumption.
- `_append_history_if_changed` silently swallows `InvalidOperation` — latent bug, but won't trigger after this fix.
