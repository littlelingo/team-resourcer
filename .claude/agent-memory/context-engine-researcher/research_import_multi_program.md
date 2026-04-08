---
name: Research: Multi-Program Member Import
description: 2026-04-06 audit of current state for importing members with multiple programs — covers import layer, data model, UI, and gaps
type: project
---

## Summary (2026-04-06)

### Data Model: Already Many-to-Many
- `program_assignments` join table (member_uuid PK, program_id PK, role, program_team_id) — NO single FK on team_members
- Composite PK prevents duplicate (member, program) pairs
- `program_team_id` nullable FK added in migration `1ead305befa8_add_program_teams.py`
- `_upsert_program_assignment` in import_commit.py does a SELECT-then-INSERT-or-UPDATE approach

### Import Layer: Supports Only ONE Program Per Row
- `ENTITY_CONFIGS["member"]` in import_mapper.py has `program_name` and `program_role` as singular fields
- `_commit_members` in import_commit_members.py lines 55-59 reads `data.get("program_name")` — one value
- `_upsert_program_assignment` is called once per row (line 120-124)
- No delimiter-split or multi-value logic exists anywhere in the import pipeline
- If a CSV has "Program A; Program B" in one cell, it is treated as a single program name and will fail to match (or create a new program with that literal name)
- No support for repeating rows with same employee_id for multiple programs (dedup logic at import_mapper.py lines 183-195 uses employee_id as dedup_field — second row gets a "Duplicate" warning and is SKIPPED during commit)

### Frontend Import UI: Single-Value Only
- `MEMBER_TARGET_FIELDS` in MapColumnsStep.tsx lines 30-31 exposes exactly one `program_name` and one `program_role` field
- No concept of multi-value or delimited cell

### UI Layer: Fully Multi-Program Already
- Edit form (useMemberForm.ts): `program_ids: z.array(z.string())` — multi-select, diff-based assign/unassign
- MemberCard: renders `member.program_assignments?.map(...)` badges but list endpoint never returns program_assignments (always empty on card view)
- MemberDetailSheet: renders program badges correctly from detail endpoint
- No gaps in the UI assign flow itself

### Key Gaps for Multi-Program Import Support
1. **Single-value parser**: import_commit_members.py reads one program_name per row — needs extension
2. **Dedup conflict**: employee_id dedup in import_mapper.py skips duplicate rows — multi-program via repeated rows is impossible today
3. **No delimiter convention**: no agreed delimiter for multi-value in one cell (semicolon, comma, pipe all possible)
4. **program_role ambiguity**: if multiple programs, which role applies to which program?

### Files That Would Need to Change
- `backend/app/services/import_mapper.py` — ENTITY_CONFIGS["member"] target_fields: rename or add plural fields
- `backend/app/services/import_commit_members.py` — lines 55-124: parse multi-value, loop assignments
- `frontend/src/components/import/MapColumnsStep.tsx` — MEMBER_TARGET_FIELDS: add multi-program column concept
- Possibly `backend/app/schemas/import_schemas.py` — if new field types needed

**Why:** Multi-program support is a data model non-issue (already M2M) but an import-layer design gap.
