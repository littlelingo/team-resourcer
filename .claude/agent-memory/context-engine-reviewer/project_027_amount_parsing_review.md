---
name: project_027_amount_parsing_review
description: 027-import-amount-parsing (parse_amount utility, mapper numeric validation): key findings from review on 2026-03-28
type: project
---

Key findings from feature 027 review:

**Critical:**
1. `import_amount_utils.py:49-50` — `Decimal("NaN")` and `Decimal("Infinity")` do NOT raise `InvalidOperation` — Python's Decimal accepts them as special values. `parse_amount("NaN")` returns `Decimal("NaN")`, `parse_amount("Infinity")` returns `Decimal("Infinity")`. These pass validation, get written to `data[num_field]` as `"NaN"` / `"Infinity"`, and reach PostgreSQL's `NUMERIC` column (which accepts them as special values but they are meaningless for financial data). Fix: add `if not result.is_finite(): return None` after the Decimal() call.

**Warnings:**
2. `import_mapper.py:7` — `InvalidOperation` is now a dead import. After replacing bare `Decimal()`/`except InvalidOperation` with `parse_amount()`, `InvalidOperation` is no longer used anywhere in the file body. PRP noted this risk but said "leave it" — a linter will flag it. Should be removed.
3. `test_import_amount_utils.py:3` — `import pytest` is unused. No `pytest.raises`, fixtures, or marks are used in the test file. Pure assertion-only tests. Should be removed.
4. `import_amount_utils.py:18` — `_PARENS_RE = re.compile(r"^\((.+)\)$")` does not match `"( 500 )"` (spaces inside parens). After outer `.strip()`, a value like `" ( 500 ) "` becomes `"( 500 )"` which fails the regex because `.+` includes the spaces but the final strip-comma-strip pipeline still works. However, `"( 500 )"` as input returns `None`. This is an undocumented edge case — real spreadsheets are unlikely to produce it, but worth noting.

**Suggestions:**
5. `test_import_amount_utils.py` — No test for `"NaN"` returning `None` (currently a bug, but even after fix, the test should exist). No test for `"Infinity"` returning `None`. The PRP test list does not include these, but they are natural failure cases.
6. `import_amount_utils.py:17` — `_CURRENCY_RE` and `_PARENS_RE` are module-level compiled regexes (correct pattern from import_date_utils). Pattern compliance with 024 is good.

**Verified correct:**
- `"()"` returns `None` — `.+` requires at least one char inside parens, so `()` doesn't match the regex, falls through to `Decimal("()")` which raises `InvalidOperation`. Correct.
- `"(-)"` returns `None` — matches parens regex → `"-" + "-"` = `"--"` → Decimal raises → None. Correct.
- Write-back `data[num_field] = str(result)` in mapper is correct; `str(Decimal(...))` preserves precision.
- `"1e3"` → `Decimal("1E+3")` (1000) — passes through as scientific notation. SQLAlchemy Numeric accepts it. Acceptable.
- `"+500"` → `Decimal("500")` — correct.

**Why:** NaN/Infinity are Python Decimal special values that don't raise InvalidOperation but are invalid for financial amounts. The dead imports are minor but will cause linter noise.
**How to apply:** In future reviews of parse_* utilities, always probe `"NaN"`, `"Infinity"`, and `"inf"` as inputs — Python's Decimal accepts them silently.
