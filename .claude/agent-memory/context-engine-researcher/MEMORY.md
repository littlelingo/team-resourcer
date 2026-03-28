# Agent Memory Index

## Project State
- [`project_state.md`](project_state.md) — Fully implemented app as of 2026-03-24; 4 feature phases + test suite complete (108 backend, 111 frontend tests)

## DevOps / Docker
- [`project_devops.md`](project_devops.md) — Docker Compose services, hot-reload status (backend works, frontend broken), Makefile gaps, env var mismatch

## Audit
- [`audit_findings_march2025.md`](audit_findings_march2025.md) — 2026-03-25 re-audit findings: image upload never wired, --reload in Dockerfile, unpinned node image, multi-worker session bug

## Bug: Team creation 422
- [`bug_team_422.md`](bug_team_422.md) — functional_area_id required in TeamCreate schema but frontend never sends it; Pydantic rejects before route handler runs

## Research: Entity Import Feature
- [`research_entity_import.md`](research_entity_import.md) — 2026-03-25 findings on adding CSV/Sheets import for programs, areas, teams

## Research: Import Architecture + Financial History (deep)
- [`research_import_and_history.md`](research_import_and_history.md) — 2026-03-27 full audit: wizard steps, API routes, ENTITY_CONFIGS, commit flow, member_history EAV model, employee_id uniqueness, frontend components, known gap: agency_name missing from PROGRAM_TARGET_FIELDS

## Bug: Select.Item Empty String Value
- [`bug_select_item_value.md`](bug_select_item_value.md) — SelectField "None" item uses value="" which Radix Select v2 rejects; fix is sentinel "__none__" like TeamFormDialog already does

## Research: Remove Main Import Nav / ImportPage (feature 022)
- [`research_remove_import_page.md`](research_remove_import_page.md) — ImportPage is a thin member-only wrapper at /import; every section page now has its own inline import dialog; 3 touch points: App.tsx route, AppLayout.tsx nav entry + Upload icon, delete ImportPage.tsx

## Research: Program Import Agency Column (feature 023)
- Backend already handles agency_name in program import (lookup-only, no auto-create); fix is one frontend line in MapColumnsStep.tsx PROGRAM_TARGET_FIELDS; see `.context/features/023-program-import-agency/NOTES.md`
