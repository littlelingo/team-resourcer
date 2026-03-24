---
name: phase4_progress
description: Phase 4 PRP implementation progress — Steps 1-15 complete as of 2026-03-23 (backend + frontend import wizard); Step 16 skipped per instructions
type: project
---

Phase 4 Steps 1-15 complete as of 2026-03-23. Step 16 (Docker Compose credentials) was handled as part of Steps 1-8 backend work.

**Why:** Phase 4 adds bulk data ingestion via CSV/Excel file upload and Google Sheets pull.

**How to apply:** All backend service/schema/route files and frontend import wizard components are in place. The import wizard is accessible at /import in the app.

## Steps 1-8 (2026-03-23) — Backend

### Files created
- `backend/app/schemas/import_schemas.py` — ParseResult, UploadResponse, SheetRequest, MappingConfig, MappedRow, MappedPreviewResult, CommitResult
- `backend/app/api/routes/import_router.py` — 4 endpoints: POST /upload, /google-sheets, /preview, /commit
- `backend/app/services/import_parser.py` — parse_upload(bytes, filename); CSV via csv.DictReader; XLSX via pandas+openpyxl; raises ImportParseError
- `backend/app/services/import_sheets.py` — fetch_sheet(url_or_id); auth from GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_JSON (base64); raises ImportSheetsError
- `backend/app/services/import_session.py` — in-memory session cache; create/get/delete; 30-min TTL; start_cleanup_task() for lifespan
- `backend/app/services/import_mapper.py` — apply_mapping(session_id, config); TARGET_FIELDS + REQUIRED_FIELDS; per-row validation
- `backend/app/services/import_commit.py` — commit_import(session_id, config, db); upsert TeamMember by employee_id; get_or_create FK entities; history records; two-pass supervisor resolution

### Files modified
- `backend/requirements.txt` — added pandas>=2.2, openpyxl>=3.1, google-api-python-client>=2.120, google-auth>=2.29, google-auth-httplib2>=0.2
- `backend/app/main.py` — registered import_router at /api/import; start_cleanup_task() in lifespan
- `backend/app/core/config.py` — added google_service_account_file and google_service_account_json Optional fields
- `docker-compose.yml` — added GOOGLE_SERVICE_ACCOUNT_FILE + GOOGLE_SERVICE_ACCOUNT_JSON env vars; volume mount for service account file

### Key decisions
- Router placed at `backend/app/api/routes/import_router.py` (not `app/routers/`) to match existing route pattern
- Schemas placed at `backend/app/schemas/import_schemas.py` (standalone file, not added to __init__.py — import directly)
- Session cleanup uses asyncio.Task started in FastAPI lifespan; task.cancel() on shutdown
- Commit service uses two-pass approach: first pass upserts all members, second pass resolves supervisor FKs
- Missing functional_area_name on new member defaults to "Unassigned" area (auto-created)
- pandas 3.0.1 resolved (>=2.2 pin picked it up)

### Validation
- `docker compose up backend --build -d` — succeeded
- `ruff check app/` — all checks passed (auto-fixed: timezone.utc → UTC alias, unused tempfile import)
- `GET /openapi.json` — confirmed all 4 /api/import/* paths registered

## Steps 9-15 (2026-03-23) — Frontend Import Wizard

### Files created
- `frontend/src/api/importApi.ts` — UploadResponse, MappingConfig, MappedRow, MappedPreviewResult, CommitResult + 4 async functions
- `frontend/src/pages/ImportPage.tsx` — page wrapper with PageHeader + ImportWizard
- `frontend/src/components/import/ImportWizard.tsx` — state machine; custom step indicator (Tailwind circles + connector lines)
- `frontend/src/components/import/SourceStep.tsx` — @radix-ui/react-tabs; drag-drop + file input; Google Sheets input
- `frontend/src/components/import/MapColumnsStep.tsx` — auto-suggest; HTML select elements; 15 target fields
- `frontend/src/components/import/PreviewStep.tsx` — @radix-ui/react-tooltip for cell errors; pagination 20/page; commitImport on submit
- `frontend/src/components/import/ResultStep.tsx` — stats grid; collapsible error rows; links to /members

### Files modified
- `frontend/src/App.tsx` — added `/import` route + ImportPage import
- `frontend/src/components/layout/AppLayout.tsx` — added Import nav item with Upload lucide icon

### Key decisions
- `uploadFile` uses FormData — apiFetch already handles Content-Type omission for FormData
- No shadcn — project uses radix primitives directly; tabs via @radix-ui/react-tabs
- Plain state toggle for skipped rows accordion (no Radix Accordion needed)
- PreviewStep cell coloring: applies to entire row (not individual cells) since MappedRow.errors is row-level

### Validation
- `npx tsc --noEmit` — exits 0, no TypeScript errors
