# 001 - Team Resourcer Web Application

## Overview

Full-stack team resource management application for tracking team members, their program assignments, functional areas, and organizational hierarchy. Single-user, no auth.

## Tech Stack

- **Frontend**: React + shadcn/ui
- **Backend**: Python / FastAPI
- **Database**: PostgreSQL (Docker)
- **Deployment**: Docker Compose (cloud-ready later)

## Data Model

### Team Members
- `uuid` (PK, auto-generated)
- `employee_id` (HR number, unique, user-facing)
- `name`
- `title`
- `location`
- `image` (URL or uploaded file)
- `email`
- `phone`
- `slack_handle`
- `salary` (current)
- `bonus` (current)
- `pto_used` (current)
- `functional_area_id` (FK → FunctionalArea) — one area per person
- `team_id` (FK → Team, nullable) — optional subgroup within area
- `supervisor_id` (FK → self, nullable) — org hierarchy direct report

### Salary/Bonus/PTO History
- `id` (PK)
- `member_uuid` (FK → TeamMember)
- `field` (enum: salary, bonus, pto_used)
- `value` (numeric)
- `effective_date`
- `notes` (optional)

Historical tracking via append-only history table. Current values stored on member for fast reads; history table for audit/timeline view.

### Programs
- `id` (PK)
- `name`
- `description`

### Program Assignments (many-to-many, typically 1:1)
- `member_uuid` (FK → TeamMember)
- `program_id` (FK → Program)
- `role` (optional — e.g., "Program Manager", "Developer")

### Functional Areas
- `id` (PK)
- `name` (e.g., Frontend, Backend, QA)
- `description`

### Teams (subgroups within a functional area, 1 level deep)
- `id` (PK)
- `functional_area_id` (FK → FunctionalArea)
- `name`
- `description`
- `lead_id` (FK → TeamMember, nullable)

### Organization Hierarchy
- Modeled via `supervisor_id` on TeamMember (self-referential FK)
- A member can have both a **program manager** (via program assignment role) and a **functional area manager** (via team lead or area-level supervisor)
- Tree views will render these as separate hierarchies

## Views

### Card View
- Visual cards for team members showing key info
- CRUD: add, edit, remove members
- Click to expand full detail

### Table View
- Tabular data for: members, programs, functional areas, teams
- Sortable, filterable columns
- Inline or modal editing

### Tree Views (3 separate views)
1. **Program Tree** — Programs → assigned members
2. **Functional Area Tree** — Areas → Teams → Members
3. **Organization Tree** — Supervisor → direct reports (org chart)

Interactive features:
- Drag-and-drop to reassign people
- Expand/collapse nodes
- Zoom and pan
- Search/filter within tree
- Visually rich and immersive

## Data Import

### Google Sheets
- Manual "Import Now" action (not real-time sync)
- Connect to a specific Google Sheet by URL/ID
- Map columns to member fields

### File Upload
- CSV / Excel upload
- Column mapping UI
- Preview before import, validation errors shown

### Existing Spreadsheet
- User has an existing spreadsheet structure to import from
- Need to understand its schema to build mapping

## Architecture Decisions

- **No auth** for now — single user. Design API to be auth-ready (middleware slot).
- **Docker Compose** for local dev — PostgreSQL + FastAPI + React dev server.
- **Cloud-ready** — keep config externalized, use env vars, no hardcoded paths.
- **History tracking** — append-only history table for salary/bonus/PTO, current values denormalized on member record for performance.
- **Many-to-many programs** — modeled with join table even though typically 1:1, to support edge cases.

## Implementation Order

1. **Phase 1**: Data model + API (FastAPI + PostgreSQL + migrations)
2. **Phase 2**: Card view + Table view (React + shadcn/ui)
3. **Phase 3**: Tree views (interactive org charts)
4. **Phase 4**: Google Sheets / file import

## Resolved Items

- **Image handling**: File upload with local storage (serve from backend, store on disk/volume)
- **History capture**: Auto-save — every edit to salary/bonus/PTO automatically appends to history table
- **Google Sheet import**: Multiple formats exist; import should be header-based column mapping (user maps headers → fields)

## Open Items

- Tree view library selection (react-flow, d3-org-chart, custom with d3, etc.)

## Risks

- Tree view interactivity (drag-drop reassignment + zoom/pan + search) is the most complex UI piece — will need careful library selection
- History tracking adds complexity to edits — need to decide if history is auto-captured on every save or manually triggered
