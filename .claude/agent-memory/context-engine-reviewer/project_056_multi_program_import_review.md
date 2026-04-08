---
name: project_056_multi_program_import_review
description: Feature 056 multi-program member import review (2026-04-06) — key findings and fragile areas
type: project
---

Review of feature 056 (multi-program member import) on 2026-04-06. Verdict: CHANGES_REQUESTED.

**Critical findings:**

1. **Mapped-but-empty-cell mass-delete** (`import_commit_members.py:137-162`): when `program_names` column is mapped but the cell value is blank/semicolons-only, `programs_mapped=True` and `resolved_programs=[]`, so `incoming_program_ids=set()`. The delete loop then removes ALL existing assignments for that member. Untested edge case.

2. **Blank-token positional alignment is broken** (`import_mapper.py:18-25` + `_validate_program_lists`): `_split_semicolon_list` drops empty tokens, but the PRP spec says "blank tokens are allowed at any index (meaning no team for that program)". So `"Alpha;Beta"` + `";Team2"` → `["Alpha","Beta"]` (2) vs `["Team2"]` (1) → validator errors. The feature cannot express "Alpha with no team, Beta with Team2". Tests do not cover this case.

3. **`program_teams` no unique constraint on `(program_id, name)`**: `_get_or_create_program_team` can create duplicate rows under concurrent imports (no DB-level uniqueness guard). Pattern exists on `programs.name` but not here.

**Warnings:**

4. **`program_count` query N+1 potential** (`tree_service.py:71-76`): batched in a single query across all members in the program, which is correct. Not N+1.

5. **`compute_unassignments` always true for member entity** (`MapColumnsStep.tsx:141`): every preview call for members hits the DB to compute unassignments, even before the user is done mapping columns (the flag is set unconditionally when `entityType === 'member'`). This is a performance concern for large member sets.

6. **`_upsert_program_assignment` clears `program_team_id` cannot be reset to null**: the `else` branch only updates `program_team_id` when the new value is non-None. A user who removes a team assignment via re-import cannot clear it.

**Fragile areas to watch in future reviews:**
- The `programs_mapped` flag must continue to be set ONLY when `"program_names"` key is physically present in `data` (not just non-empty). The `"program_names" in data` check is the load-bearing guard.
- `_split_semicolon_list` treats non-string inputs via `str(value)` — this handles numbers (e.g., a numeric cell) but will turn `None` into `""` (empty list). That is correct but subtle.

**Why:** Blank-cell mass-delete is the most dangerous issue — a CSV row with a mapped-but-empty Programs column would silently wipe all existing assignments for that member with no warning shown (unassignments preview only runs for members with program_names in data AND rows without errors).
**How to apply:** Future reviews of this file should always verify the `programs_mapped`/`resolved_programs` empty-list case is tested.
