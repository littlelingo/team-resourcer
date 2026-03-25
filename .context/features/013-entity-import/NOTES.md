# Research: Per-Section Entity Import (Programs, Areas, Teams)

## Concept
- **Global import** (existing) = full-load member import, auto-creates areas/teams/programs via `get_or_create` — unchanged
- **Per-section import** (new) = lightweight bulk-add for programs, areas, or teams from their respective pages

## Reusable Infrastructure (already entity-agnostic)
- `import_parser.py` — CSV/XLSX parsing, returns generic `ParseResult`
- `import_session.py` — in-memory session store, stores `raw_rows + headers`
- `import_sheets.py` — Google Sheets fetch, returns same `ParseResult`
- `import_schemas.py` — `ParseResult`, `UploadResponse`, `MappingConfig`, `MappedRow`, `CommitResult` all generic
- Router `/upload` and `/google-sheets` endpoints — entity-agnostic
- Frontend: `SourceStep`, `ImportWizard` shell, `PreviewStep`, `ResultStep` — all reusable

## Member-Specific Coupling Points
| File | What's coupled |
|------|----------------|
| `import_mapper.py:12-31` | `TARGET_FIELDS` hardcoded to 15 member fields |
| `import_mapper.py:33-35` | `REQUIRED_FIELDS`, `_NUMERIC_FIELDS` — member-only |
| `import_mapper.py:88-120` | Validation logic for employee_id, email, numeric fields |
| `import_commit.py` (entire) | Member upsert, FK resolution, history, supervisor chains |
| `import_supervisor.py` (entire) | Supervisor cycle detection |
| `MapColumnsStep.tsx:8-24` | `TARGET_FIELDS` array hardcoded to member fields |
| `MapColumnsStep.tsx:90-93` | Required-field guard for employee_id + name |

## Entity Field Requirements
| Entity | Required | Optional | FK Constraints |
|--------|----------|----------|----------------|
| FunctionalArea | `name` (unique) | `description` | None |
| Program | `name` (unique) | `description` | None |
| Team | `name`, `functional_area_id` | `description`, `lead_id` | `functional_area_id` required (FK to area) |

## Proposed Changes

### Backend
1. **`import_schemas.py`**: Add `entity_type: Literal["member", "program", "area", "team"] = "member"` to `MappingConfig` (backward-compatible default)
2. **`import_mapper.py`**: Refactor to per-entity config dict for `TARGET_FIELDS`, `REQUIRED_FIELDS`, validation. `apply_mapping` accepts entity_type.
3. **`import_commit.py`**: Dispatch to `_commit_members` (existing), `_commit_programs`, `_commit_areas`, `_commit_teams`. Simple entities are trivial upsert-by-name.
4. **Router**: No structural change — entity_type rides in `MappingConfig` body.

### Frontend
1. `ImportWizard` accepts `entityType` prop (default "member")
2. `MapColumnsStep` accepts `targetFields` + `requiredFields` props
3. `PreviewStep` parameterizes query invalidation by entity type
4. Each section page gets an "Import" button opening `<ImportWizard entityType="program" />`

## Risks
- **Teams depend on areas**: team import must resolve `functional_area_name` → `functional_area_id`. Reuse `_get_or_create_functional_area` pattern.
- **Team name uniqueness**: match on `(name, area_id)` not name alone — `_get_or_create_team` already does this.
- **Deduplication**: programs/areas need name-based dedup (like employee_id dedup for members).
- **`lead_id` for teams**: omit from initial scope or accept `lead_employee_id` with warning if not found.
- **In-memory session store**: pre-existing single-worker constraint applies here too.

## Open Questions
1. Should team import accept `functional_area_name` (auto-resolve) or require `functional_area_id` (pre-existing area)?
   - Recommend: accept name, auto-resolve like member import does
2. Should per-section import be a dialog or a full page?
   - Recommend: dialog (reuse wizard in a modal) — keeps user in context
3. Should `lead_id` be in scope for team import v1?
   - Recommend: no — keep it simple, add later if needed
