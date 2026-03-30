# PRP: Backend-Frontend Sync Comments

## Status: COMPLETE
## Complexity: LOW
## Testing Strategy: implement-then-test

## Context

Only 1 sync comment existed in the codebase. The backend defines authoritative constants that the frontend replicates as string literals. Added `// Keep in sync with...` comments at all coupling points and documented the convention.

## Changes

Added 5 new sync comments:
- `MapColumnsStep.tsx` — `*_TARGET_FIELDS` → `ENTITY_CONFIGS` in import_mapper.py
- `importApi.ts` — `EntityType` → `EntityType` in import_schemas.py
- `ImportWizard.tsx` — `ENTITY_CONFIGS` → `ENTITY_CONFIGS` in import_mapper.py
- `import_commit.py` — `_FINANCIAL_FIELDS` → import_mapper.py + frontend
- `import_mapper.py` — `numeric_fields` → `_FINANCIAL_FIELDS` in import_commit.py

Documented Cross-Stack Coupling pattern in CODE_PATTERNS.md.

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/import/MapColumnsStep.tsx` | 1 sync comment |
| `frontend/src/api/importApi.ts` | 1 sync comment |
| `frontend/src/components/import/ImportWizard.tsx` | 1 sync comment |
| `backend/app/services/import_commit.py` | 1 sync comment |
| `backend/app/services/import_mapper.py` | 1 sync comment |
| `.context/patterns/CODE_PATTERNS.md` | Cross-Stack Coupling pattern |

## Validation

`grep -r "Keep in sync"` returns 6 results (1 pre-existing + 5 new). All 301 tests pass.
