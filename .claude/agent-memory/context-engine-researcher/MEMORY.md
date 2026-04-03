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

## Research: Makefile Port Conflicts (feature 025)
- All rebuild/up targets lack prior `down`; `docker compose up` exits 0 even on port-bind failure; db:5432 conflicts with local Postgres; see `.context/features/025-makefile-port-cleanup/NOTES.md`

## Research: CORS Configuration
- [`cors-research.md`](cors-research.md) — FastAPI CORSMiddleware, default allows localhost:5173, env var mismatch in Compose (VITE_API_URL vs VITE_API_BASE_URL), narrow allow_headers is likely bug trigger

## Bug: All Endpoints 500 / CORS Headers Missing
- [`cors-500-investigation.md`](cors-500-investigation.md) — Root cause: DB schema empty (migrations never run); fix is `make migrate`; CORS headers absent on 500s is a Starlette ServerErrorMiddleware behavior

## Research: Import Amount Parsing (feature 027 candidate)
- [`import-amount-research.md`](import-amount-research.md) — 2026-03-28: "$75,000" / "1,500.00" fail Decimal() in mapper; fix is import_amount_utils.py + normalize-in-place in mapper; date utils (024) is the exact pattern to follow

## Research: History Currency Display (feature 028)
- History timeline in MemberDetailSheet.tsx renders entry.value raw ("120000.00"); Compensation section already has formatCurrency/formatNumber helpers (lines 17–29) — fix is extract to format-utils.ts + apply in history span; see `.context/features/028-history-currency-display/NOTES.md`

## Research: Import Salary History Gap (feature candidate)
- [`research_import_salary_history_gap.md`](research_import_salary_history_gap.md) — `_append_history_if_changed` in import_commit.py writes history for new members (is_new=True); salary column during member import should NOT create history; fix is in lines 87–112 / call site line 325; no existing tests cover salary history in import

## Research: Program-Member Relationship (deep audit)
- [`research_program_member.md`](research_program_member.md) — Many-to-many via program_assignments; backend assign/unassign endpoints exist; no frontend assign hooks; list response never includes program_assignments so card-view badges are always empty

## Research: Team Assignment Display in Member Detail/Edit (feature candidate)
- [`research_team_assignment_display.md`](research_team_assignment_display.md) — 2026-03-30: team assignment is a direct FK (team_id on team_members); backend detail response includes team object; detail sheet and edit form are wired; invalidation covers detail cache via prefix match; possible edge: team dropdown only loads teams for member's area

## Research: Functional Manager + Direct Report Rename (feature 029)
- Add functional_manager_id self-ref FK to team_members (mirrors supervisor_id pattern); requires explicit foreign_keys= on both new relationships; dedicated set endpoint in org.py follows existing supervisor route; MemberCard uses TeamMemberList (no FK fields) so showing manager name needs extra prop or type widening; supervisor currently displays as raw UUID in detail sheet (existing UX gap); see `.context/features/029-functional-manager/NOTES.md`

## Research: Member Views — Missing functional_area / programs / team
- [`research_member_views.md`](research_member_views.md) — 2026-03-31: card/table views always show "—" for area/team/programs because list schema strips nested objects; detail sheet works fine; fix is frontend join (area/team) + extend list schema (programs)

## Research: Programs Table — Total Members Column
- [`research_program_member_count.md`](research_program_member_count.md) — 2026-04-02: ProgramResponse has no member_count; list_programs loads assignments rel but doesn't count; fix is selectinload(Program.assignments) on all 4 ProgramResponse routes + @computed_field + frontend type + new column; MissingGreenlet risk if any of the 4 routes miss the eager-load

## Research: Entity Member Count — Agencies, Functional Areas, Teams
- [`research_entity_member_count.md`](research_entity_member_count.md) — 2026-04-02: FunctionalArea and Team have direct members relationships; Agency is indirect (via programs→assignments); service functions need selectinload additions; all three schemas and frontend types lack member_count; pattern mirrors feature 051 exactly

## Research: Searchable Select / Combobox (feature 049 candidate)
- [`research_searchable_select.md`](research_searchable_select.md) — 2026-03-30: SelectField uses Radix Select (no search); MultiSelectField uses Radix DropdownMenu (no search); cmdk@1.1.1 already installed; @radix-ui/react-popover NOT installed; 5 SelectField usages (2 files), 1 MultiSelectField usage; highest feature ID is 048

## Bug: Tree Lead Duplicate + Team Node Clickability
- [`research_tree_lead_duplicate.md`](research_tree_lead_duplicate.md) — 2026-04-02: build_area_tree emits all area members unconditionally; lead gets a member node AND appears on team node; fix is skip member nodes for lead_uuids in backend + add onSelect/lead_id to TeamNode + inject team onSelect in AreaTreePage
