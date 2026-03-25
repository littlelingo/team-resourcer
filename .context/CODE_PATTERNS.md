# Code Patterns

## Backend Service Layer
- Each service receives `AsyncSession` as first arg, returns model instances or None
- Services do NOT import from `api/routes/` (one-way dependency: routes → services → models)
- Use `selectinload` for eager loading relationships in async context
- Use `exclude_unset=True` (not `exclude_none`) in `model_dump()` for update operations — allows explicit null clearing
- Financial fields (salary, bonus, pto_used) auto-capture history on change via `_FINANCIAL_FIELDS` constant

## Backend API Routes
- Routes delegate entirely to service layer — no DB queries in handlers
- Use `Depends(get_db)` for session injection
- 404 via `HTTPException(status_code=404)` when entity not found
- 204 for deletes, 201 for creates
- `ValueError` from services → `HTTPException(400)` or `HTTPException(404)` depending on context
- Sub-routers (teams under areas, history under members) validate parent entity ownership

## Pydantic Schemas
- Use `ConfigDict(from_attributes=True)` on response schemas
- Separate Create/Update/ListResponse/DetailResponse per entity
- `Update` schemas use all Optional fields, no immutable fields (e.g., no employee_id)
- Validators: `@field_validator` for email regex, employee_id strip/non-empty

## SQLAlchemy Models
- SQLAlchemy 2.0 mapped class syntax (`Mapped`, `mapped_column`)
- String FK references to avoid circular imports
- `use_alter=True` on circular FKs (Team.lead_id → TeamMember)
- Timestamps: `server_default=func.now()` + `onupdate=func.now()`

## Frontend Hooks (TanStack Query v5)
- Object syntax: `useQuery({ queryKey, queryFn })`, `useMutation({ mutationFn })`
- Mutations invalidate relevant query keys on success
- Backend uses PUT for updates, not PATCH — all update mutations must use `method: "PUT"`
- Hooks that require a parent ID (e.g., useTeams needs areaId) return empty when ID is absent
- Use `enabled: Boolean(id)` to prevent queries with empty/null IDs

## Frontend Components
- Extract shared utilities (getInitials → `lib/member-utils.ts`, RowActionsMenu → `shared/`)
- Single dialog instance pattern: one form dialog toggled between add/edit mode via `member` prop
- Edit from table must fetch full detail (TeamMemberList is incomplete) before opening form
- ImageUpload: validate MIME type + file size client-side, revoke object URLs on cleanup
- Use `getImageUrl()` for ALL image_path references — never use raw path as src
- URL search params: runtime guard values (e.g., `rawView === 'table' ? 'table' : 'card'`)
- Form watchers: clear dependent fields when parent changes (team_id when area changes)

## Multi-Entity Import
- `MappingConfig.entity_type` defaults to `"member"` for backward compatibility
- `ENTITY_CONFIGS` dict in `import_mapper.py` maps entity type → target fields, required fields, numeric fields, validators
- `commit_import` dispatches to entity-specific commit functions (`_commit_areas`, `_commit_programs`, `_commit_teams`, `_commit_members`)
- Simple entities (areas, programs) upsert by unique name; teams upsert by `(name, functional_area_id)`
- Frontend `ImportWizard` accepts `entityType` prop; `MapColumnsStep` accepts `targetFields` and `requiredFields` props
- Per-section import opens the wizard in a Radix Dialog modal from each page's header

## Image Upload
- Validate via Pillow magic bytes, not just Content-Type header
- UUID-based filenames: `{member_uuid}.{ext}` — no path traversal risk
- 5 MB size limit enforced during chunked read
