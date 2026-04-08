---
name: Feature 056 complete
description: Feature 056 multi-program member import — all 5 sections implemented as of 2026-04-06
type: project
---

Feature 056 (multi-program member import) implemented and complete as of 2026-04-06.

**Why:** The import pipeline previously assumed one program per member; this adds semicolon-delimited multi-program support with replace semantics and program-team linkage.

**How to apply:** The feature is shipped. Future import-related work should be aware:
- `program_name` target field is now `program_names` (breaking rename in CSV fixtures)
- `_split_semicolon_list` in `import_mapper.py` is the canonical token parser
- Replace semantics fire only when `program_names` column is mapped; unmapped = skip delete
- `compute_unassignments` flag on preview endpoint triggers per-member DB diff (gated for cost)
- `program_assignments` on list endpoint now eager-loads `program_team` via `selectinload`
- Program tree `build_program_tree` now emits `program_count` per member node for the `×N` badge
