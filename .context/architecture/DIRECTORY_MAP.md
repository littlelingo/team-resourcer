# Directory Map

Annotated two-to-three level tree. Each entry describes what lives there and its
responsibility. Directories verified to exist as of 2026-04-09.

```
team-resourcer/
│
├── backend/                        Python package root; Docker build context
│   ├── Dockerfile                  Multi-stage build: builder (pip install) → runtime (non-root user)
│   ├── pyproject.toml              ruff / mypy / pytest config (no setuptools — deps in requirements.txt)
│   ├── requirements.txt            Pinned Python dependencies
│   ├── alembic/                    Alembic migration environment
│   │   ├── env.py                  Async migration runner; imports all models via app.models
│   │   └── versions/               Auto-generated migration scripts
│   ├── app/
│   │   ├── main.py                 App factory: registers all routers, CORS, StaticFiles, lifespan
│   │   ├── core/
│   │   │   ├── config.py           Pydantic Settings (DB_URL, CORS_ORIGINS, UPLOAD_DIR, Google creds)
│   │   │   └── database.py         Async engine, session factory, get_db() FastAPI dependency
│   │   ├── models/                 SQLAlchemy ORM models — one file per table
│   │   │   ├── base.py             DeclarativeBase
│   │   │   ├── team_member.py      TeamMember — core entity; UUIDs, FKs, self-ref supervisor/manager
│   │   │   ├── calibration.py      Calibration — box (1-9), CHECK/UNIQUE constraints, FK to cycle
│   │   │   ├── calibration_cycle.py CalibrationCycle — append-only reference table (RESTRICT deletes)
│   │   │   ├── member_history.py   MemberHistory — EAV-style financial history entries
│   │   │   ├── program_assignment.py M2M join: TeamMember ↔ Program (+ optional program_team)
│   │   │   ├── program_team.py     Teams scoped to a program (distinct from org Teams)
│   │   │   ├── team.py             Org Team — belongs to a FunctionalArea, has optional lead_id
│   │   │   ├── functional_area.py  Functional Area — grouping of teams and members
│   │   │   ├── program.py          Program entity with optional agency link
│   │   │   └── agency.py           Agency — top-level grouping for programs
│   │   ├── schemas/                Pydantic request/response shapes — never imported from models/
│   │   │   ├── team_member.py      Create/Update/ListResponse/DetailResponse/MemberRef schemas
│   │   │   ├── calibration.py      CalibrationCreate/Update/Response + BOX_LABELS SSoT
│   │   │   ├── import_schemas.py   UploadResponse, MappingConfig, CommitResult, MappedRow, etc.
│   │   │   └── …                   One file per entity (team, area, agency, program, history, …)
│   │   ├── services/               All database work; routes call into here and do nothing else
│   │   │   ├── member_service.py   CRUD for TeamMember; financial history tracking on update
│   │   │   ├── calibration_service.py   Analytics queries: latest-per-member, movement, trends
│   │   │   ├── calibration_cycle_service.py  get_or_create_cycle with savepoint race guard
│   │   │   ├── history_service.py  Append-only financial history entries
│   │   │   ├── import_commit.py    Batch upsert pipeline for member/entity import; _get_or_create_* helpers
│   │   │   ├── import_commit_calibrations.py  Calibration-specific upsert with ambiguous-row handling
│   │   │   ├── import_commit_members.py       Member-focused upsert helpers
│   │   │   ├── import_mapper.py    Column-mapping engine; ENTITY_CONFIGS with target/required fields
│   │   │   ├── import_parser.py    CSV/XLSX → raw rows; 10 MB enforcement
│   │   │   ├── import_preview.py   Compute unassignment previews before commit
│   │   │   ├── import_session.py   In-process session store for multi-step wizard; cleanup task
│   │   │   ├── import_sheets.py    Google Sheets fetch via service account credentials
│   │   │   ├── import_date_utils.py  Flexible date string normalisation (feature 024)
│   │   │   ├── import_amount_utils.py  Currency/comma-separated amount normalisation (feature 027)
│   │   │   ├── import_supervisor.py   Supervisor UUID resolution during import
│   │   │   ├── org_service.py      Supervisor/functional-manager cycle detection
│   │   │   ├── team_service.py     Team CRUD + member add/remove
│   │   │   ├── area_service.py     Functional area CRUD
│   │   │   ├── agency_service.py   Agency CRUD
│   │   │   ├── program_service.py  Program CRUD + member assignment
│   │   │   ├── program_team_service.py  Program-scoped team CRUD
│   │   │   ├── tree_service.py     Build nested area/org/program tree structures for xyflow
│   │   │   └── image_service.py    Profile image save to upload volume
│   │   └── api/
│   │       └── routes/             Thin FastAPI routers — one file per resource group
│   │           ├── members.py      CRUD + image upload for /api/members/
│   │           ├── teams.py        Team CRUD and member add/remove; two routers (top-level + nested)
│   │           ├── areas.py        Functional area CRUD; includes teams router under /{area_id}/teams/
│   │           ├── programs.py     Program CRUD + assignment
│   │           ├── agencies.py     Agency CRUD
│   │           ├── history.py      Read-only history for /api/members/{uuid}/history
│   │           ├── org.py          Supervisor + functional-manager set routes
│   │           ├── calibrations.py Org-level analytics: /latest, /movement, /trends, /resolve-ambiguous
│   │           ├── calibration_cycles.py  Cycle CRUD
│   │           ├── member_calibrations.py Per-member calibration CRUD at /api/members/{uuid}/calibrations
│   │           ├── import_router.py  Import wizard: /upload, /sheets, /preview, /commit
│   │           └── program_teams.py  Program-scoped team CRUD
│   └── tests/
│       ├── conftest.py             Shared fixtures: async SQLite engine, HTTPX client, area/team/member
│       ├── integration/            HTTP-level tests against the real FastAPI app + SQLite DB
│       │   ├── test_members_routes.py
│       │   ├── test_teams_routes.py
│       │   ├── test_areas_routes.py
│       │   ├── test_programs_routes.py
│       │   ├── test_history_routes.py
│       │   ├── test_org_routes.py
│       │   ├── test_import_routes.py
│       │   ├── test_import_commit.py
│       │   ├── test_calibration_routes.py
│       │   ├── test_calibration_import.py
│       │   └── test_tree_service.py
│       └── unit/                   Pure-logic tests (no HTTP, no DB)
│           ├── test_import_parser.py
│           ├── test_import_mapper.py
│           └── test_import_session.py
│
├── frontend/                       React/Vite SPA; Docker build context
│   ├── Dockerfile                  Multi-stage: builder (npm ci --legacy-peer-deps + vite build) → serve dist
│   ├── package.json                All dependencies + scripts (dev, build, test, lint)
│   ├── vite.config.ts              Vite + @vitejs/plugin-react; path alias @ → src/
│   └── src/
│       ├── api/                    Low-level fetch wrappers returning typed promises
│       │   ├── calibrationApi.ts   Fetch helpers for cycles, calibrations, analytics endpoints
│       │   └── importApi.ts        Fetch helpers for upload/sheets/preview/commit endpoints
│       ├── hooks/                  TanStack Query hooks; each exports query key constants
│       │   ├── useMembers.ts       memberKeys + CRUD mutations
│       │   ├── useCalibrations.ts  Calibration mutations; imports calibrationKeys from useCalibrationCycles
│       │   ├── useCalibrationCycles.ts  calibrationKeys SSoT + invalidateAllCalibrationViews helper
│       │   ├── useCalibrationHistory.ts, useCalibrationMovement.ts, useCalibrationTrends.ts
│       │   ├── useTeams.ts, useFunctionalAreas.ts, usePrograms.ts, useAgencies.ts, useTrees.ts
│       │   └── __tests__/          Hook unit tests (vitest + MSW)
│       ├── components/             Feature-grouped React components
│       │   ├── members/            MemberFormDialog, MemberDetailSheet, MemberCard, memberColumns, useMemberForm
│       │   ├── calibration/        CalibrationFilterContext, CompareDrawer, WidgetToggleMenu, useWidgetVisibility
│       │   │   └── widgets/        Nine lazy-loaded chart widgets + registry.ts + constants.ts + types.ts
│       │   ├── import/             ImportWizard (4-step), SourceStep, MapColumnsStep, PreviewStep, ResultStep
│       │   ├── trees/              TreeCanvas (xyflow), node components (AreaNode, TeamNode, MemberNode, …), tree hooks
│       │   ├── layout/             AppLayout (nav sidebar), PageHeader
│       │   ├── shared/             Reusable primitives: DataTable, ConfirmDialog, SelectField, ComboboxField,
│       │   │                       MultiSelectField, EntityMembersSheet, Field, ImageUpload, SearchFilterBar
│       │   ├── programs/, teams/, agencies/, functional-areas/  — entity form dialogs and column defs
│       │   └── __tests__/          Component tests colocated under each subdirectory
│       ├── pages/                  Route-level page components (one per nav item)
│       │   ├── MembersPage.tsx     Member list with card/table toggle, filters, inline import
│       │   ├── TeamsPage.tsx, ProgramsPage.tsx, AgenciesPage.tsx, FunctionalAreasPage.tsx
│       │   ├── CalibrationPage.tsx 9-box dashboard with widget registry + cycle filter
│       │   ├── MemberCalibrationTimelinePage.tsx  Per-member calibration history
│       │   └── trees/              OrgTreePage, AreaTreePage, ProgramTreePage
│       ├── lib/                    Shared utilities (no React)
│       │   ├── api-client.ts       apiFetch + getImageUrl; reads VITE_API_BASE_URL
│       │   ├── format-utils.ts     formatCurrency, formatNumber (defensive null-safe)
│       │   ├── member-utils.ts     getInitials and other member display helpers
│       │   ├── query-client.ts     TanStack QueryClient instance
│       │   └── utils.ts            cn() tailwind class merge helper
│       ├── types/
│       │   └── index.ts            All shared TypeScript interfaces (TeamMember, Program, Calibration, …)
│       └── test/
│           ├── setup.ts            vitest globalSetup: MSW server start/reset/stop
│           └── msw/
│               ├── server.ts       MSW node server
│               └── handlers.ts     HTTP handler mocks for all API routes
│
├── .context/                       Context Engine project knowledge base
│   ├── architecture/               OVERVIEW.md, TECH_STACK.md, DIRECTORY_MAP.md (this file)
│   ├── patterns/                   CODE_PATTERNS.md, ANTI_PATTERNS.md
│   ├── knowledge/                  LEARNINGS.md + dependencies/PINS.md
│   ├── decisions/                  ADR-000-template.md, ADR-001-calibration-architecture.md
│   ├── errors/                     INDEX.md — 14 indexed errors with causes and fixes
│   ├── features/                   FEATURES.md index + per-feature directories (NOTES, PRP, METRICS)
│   └── metrics/                    HEALTH.md (velocity, error tracking), RECOMMENDATIONS.md
│
├── docker-compose.yml              Three-service dev topology (db, backend, frontend)
├── Makefile                        All workflow targets (up/down/test/lint/migrate/reset-db/rebuild-*)
└── CLAUDE.md                       Project conventions, command reference, context engine workflow
```
