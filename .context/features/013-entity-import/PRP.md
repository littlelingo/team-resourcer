# PRP: Per-Section Entity Import (Programs, Areas, Teams)

**Status**: APPROVED
**Strategy**: implement-then-test
**Complexity**: MEDIUM
**Branch**: `feat/entity-import`

## Summary
Add per-section CSV/Google Sheets import for programs, functional areas, and teams. The existing global member import stays as the "full load" option. Each section page gets an Import button that opens the existing wizard with entity-specific field mappings.

## Design Decisions
- Team import accepts `functional_area_name` (auto-resolves via `get_or_create`), not raw IDs
- `lead_id` excluded from team import v1 — add later if needed
- Per-section import uses the wizard in a dialog, keeping user in section context
- `MappingConfig.entity_type` defaults to `"member"` for backward compatibility
- Deduplication by `name` for all simple entities (like `employee_id` dedup for members)

## Steps

### Step 1: Add entity_type to MappingConfig schema
**File**: `backend/app/schemas/import_schemas.py`
- Add `entity_type: Literal["member", "program", "area", "team"] = "member"` to `MappingConfig`
- Import `Literal` from typing

### Step 2: Refactor import_mapper.py for multi-entity support
**File**: `backend/app/services/import_mapper.py`
- Create `ENTITY_CONFIGS` dict mapping entity_type → `{ target_fields, required_fields, numeric_fields, validators }`
- Member config: existing `TARGET_FIELDS`, `REQUIRED_FIELDS`, `_NUMERIC_FIELDS`, email validator
- Program config: `target_fields=["name", "description"]`, `required={"name"}`
- Area config: `target_fields=["name", "description"]`, `required={"name"}`
- Team config: `target_fields=["name", "functional_area_name", "description"]`, `required={"name"}`
- Update `apply_mapping()` to accept `entity_type` from `MappingConfig` and use the corresponding config
- Keep existing member validation logic, just gate it behind entity_type check

### Step 3: Add entity-specific commit functions
**File**: `backend/app/services/import_commit.py`
- Add `_commit_areas(db, rows) -> CommitResult` — upsert by name, deduplicate
- Add `_commit_programs(db, rows) -> CommitResult` — upsert by name, deduplicate
- Add `_commit_teams(db, rows) -> CommitResult` — resolve `functional_area_name` via `_get_or_create_functional_area`, upsert by `(name, area_id)`, deduplicate
- Rename existing commit body to `_commit_members(db, rows, ...)` (extract from `commit_import`)
- Update `commit_import()` to dispatch based on `mapping_config.entity_type`

### Step 4: Update router to pass entity_type through
**File**: `backend/app/api/routes/import_router.py`
- `/preview` endpoint: pass `mapping_config.entity_type` to `apply_mapping()`
- `/commit` endpoint: pass through to `commit_import()` (already receives full `MappingConfig`)
- No new endpoints needed — entity_type rides in the request body

### Step 5: Parameterize frontend MapColumnsStep
**File**: `frontend/src/components/import/MapColumnsStep.tsx`
- Accept `targetFields` and `requiredFields` as props instead of using hardcoded constants
- Keep existing hardcoded `TARGET_FIELDS` as the default (member) config
- Update required-field guard to use `requiredFields` prop
- Update descriptive text to be entity-generic ("Select the target field" not "member field")

### Step 6: Parameterize ImportWizard for entity type
**File**: `frontend/src/components/import/ImportWizard.tsx`
- Accept `entityType` prop (default `"member"`)
- Define entity configs: `{ targetFields, requiredFields, label }` per entity type
- Pass `targetFields` and `requiredFields` to `MapColumnsStep`
- Pass `entityType` to preview/commit API calls (include in `MappingConfig` body)

### Step 7: Update PreviewStep query invalidation
**File**: `frontend/src/components/import/PreviewStep.tsx`
- Accept `entityType` prop
- After commit success, invalidate the correct query key based on entity type:
  - `"member"` → `["members"]`
  - `"program"` → `["programs"]`
  - `"area"` → `["functionalAreas"]`
  - `"team"` → `["teams"]` (may need to invalidate all area-scoped team queries)

### Step 8: Add Import buttons to section pages
**Files**:
- `frontend/src/pages/FunctionalAreasPage.tsx` (or equivalent)
- `frontend/src/pages/ProgramsPage.tsx` (or equivalent)
- `frontend/src/pages/TeamsPage.tsx` (or equivalent)

For each page:
- Add `[importOpen, setImportOpen]` state
- Add "Import" button next to existing "Add" button in the page header
- Render `<ImportWizard entityType="area|program|team" />` in a Dialog when open
- On wizard completion, close dialog (query invalidation handles data refresh)

## Validation
- `make test` — all 108 existing tests pass (no regressions)
- Manual: import a CSV of programs from the Programs page — verify they appear
- Manual: import a CSV of areas from the Areas page — verify they appear
- Manual: import a CSV of teams (with `functional_area_name` column) — verify teams created under correct areas
- Manual: existing global member import still works unchanged
- Frontend TypeScript: `npx tsc --noEmit` clean
