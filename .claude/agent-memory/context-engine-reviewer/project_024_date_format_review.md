---
name: project_024_date_format_review
description: 024-import-date-format (parse_date utility, mapper normalization): key findings from review on 2026-03-28
type: project
---

Key findings from feature 024 review:

**Warnings:**
1. `import_mapper.py:6` — `from datetime import date` is now a dead import after the validator bodies were replaced. `date` is no longer referenced anywhere in the mapper file. Should be removed.
2. `import_mapper.py:29,44` — `if val and val != "":` is redundant in both validators (pre-existing, not introduced here). An empty string is already falsy, so `val != ""` is dead code. Low priority cleanup.
3. `import_date_utils.py:39-41` — Strategy 2 (Excel serial) does `return None` on exception rather than `continue` (fall through to Strategy 3/4). For pure-digit strings this is safe since Strategy 3 requires a delimiter. But the asymmetry with all other strategies (which use `pass` and fall through) is a latent inconsistency if the strategy ordering ever changes.

**Not a bug (verified correct):**
- `str(parsed)` normalization produces `YYYY-MM-DD` — `str(date(...))` is guaranteed ISO on Python standard library.
- Excel serial OverflowError catch is defensive beyond PRP spec — correct addition.
- `"not-a-date"` returns None: Strategy 1 fails (no 4-digit prefix), Strategy 2 fails (not pure digit), Strategy 3 regex no-match (no delimiter between non-digit chars), Strategy 4 all fail.
- DMY fallback for `a > 12`: if b is also invalid (e.g., `15/45/2024`), ValueError is caught and None returned. Correct.
- `from datetime import date` unused in mapper after this change — dead import confirmed by reading the full file.

**Test gap:**
- No test for OverflowError path on huge Excel serial (e.g., `"999999999999"`). The catch is there but untested.
- `test_serial_zero` pins `date(1899, 12, 30)` specifically rather than PRP's permissive "either None or date(1899, 12, 30)" — acceptable but fragile if a future guard is added for serial 0.

**Why:** parse_date is the new shared entry point for all date validation in the import pipeline. The dead import in import_mapper is the only actionable finding.
**How to apply:** In future mapper reviews, check for dead `date` import from datetime. If financial history import ever adds a date field, it flows through _validate_effective_date — verify parse_date handles new formats.
