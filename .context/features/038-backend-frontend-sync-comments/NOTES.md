# Research: Backend-Frontend Sync Comments

## Problem

The backend defines authoritative sets of field names (`_FINANCIAL_FIELDS`, `ENTITY_CONFIGS`, `EntityType`) that the frontend replicates as string literals. Only one `// Keep in sync with...` comment exists in the entire codebase (feature 035). Adding a field to one side but not the other causes silent drift.

## Audit Results

### Existing sync comments: 1

- `MemberDetailSheet.tsx:11` — `HISTORY_FIELD_STYLES` → cites `import_commit.py::_FINANCIAL_FIELDS`

### Missing sync comments: 7 high-value locations

| Frontend Location | Backend Authoritative Source | Risk |
|---|---|---|
| `MapColumnsStep.tsx:13-32` — `MEMBER_TARGET_FIELDS` | `import_mapper.py` — `ENTITY_CONFIGS["member"].target_fields` | High — new field won't appear in wizard dropdown |
| `MapColumnsStep.tsx:34-38` — `PROGRAM_TARGET_FIELDS` | `import_mapper.py` — `ENTITY_CONFIGS["program"].target_fields` | Medium |
| `MapColumnsStep.tsx:50-54` — `TEAM_TARGET_FIELDS` | `import_mapper.py` — `ENTITY_CONFIGS["team"].target_fields` | Medium |
| `MapColumnsStep.tsx:56-75` — `*_HISTORY_TARGET_FIELDS` | `import_mapper.py` — `ENTITY_CONFIGS["salary_history"/"bonus_history"/"pto_history"]` | High |
| `importApi.ts:12` — `EntityType` union | `import_schemas.py:9-11` — `EntityType = Literal[...]` | Highest — new entity type silently unsupported |
| `ImportWizard.tsx:32-42` — `requiredFields` per entity | `import_mapper.py` — `ENTITY_CONFIGS[*].required_fields` | High — frontend accepts rows backend rejects |
| `MemberDetailSheet.tsx:261-264` — history format switch | `import_commit.py:25` — `_FINANCIAL_FIELDS` | Low (same file as existing comment) |

### Backend-side coupling (3 sources must agree on financial fields)

1. `import_commit.py:25` — `_FINANCIAL_FIELDS = ("salary", "bonus", "pto_used")`
2. `member_history.py:11-14` — `HistoryFieldEnum`
3. `import_mapper.py:76` — `ENTITY_CONFIGS["member"].numeric_fields`

None of these reference each other with comments.

## Proposed Fix

### 1. Add sync comments to 7 frontend locations

Each gets a `// Keep in sync with [backend_file]::[constant]` comment.

### 2. Add sync comments to 3 backend locations

Each of the 3 financial field sources gets a `# Keep in sync with` comment referencing the other two.

### 3. Document the convention in CODE_PATTERNS.md

Add a "Cross-Stack Coupling" pattern entry establishing sync comments as required.

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/import/MapColumnsStep.tsx` | Add 4 sync comments on `*_TARGET_FIELDS` arrays |
| `frontend/src/api/importApi.ts` | Add sync comment on `EntityType` |
| `frontend/src/components/import/ImportWizard.tsx` | Add sync comment on `requiredFields` |
| `frontend/src/components/members/MemberDetailSheet.tsx` | Update existing comment to also cite `member_history.py` |
| `backend/app/services/import_commit.py` | Add sync comment on `_FINANCIAL_FIELDS` |
| `backend/app/models/member_history.py` | Add sync comment on `HistoryFieldEnum` |
| `backend/app/services/import_mapper.py` | Add sync comment on `numeric_fields` in member config |
| `.context/patterns/CODE_PATTERNS.md` | Add Cross-Stack Coupling pattern |
