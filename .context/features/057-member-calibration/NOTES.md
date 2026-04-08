# Feature 057 — Member Calibration (9-Box Matrix)

## Goal
Add a `Calibration` entity capturing each member's placement on the 9-box matrix
(Performance × Potential), importable via CSV by first+last name, surfaced on
the member detail view, and explorable through a dedicated interactive 9-box
visualization page with filtering and member comparison.

## The 9-Box Model (from source image)
3×3 grid: **Potential** (y: Low/Medium/High) × **Performance** (x: Low/Med/High).
Each cell has a fixed box number (1–9) and label:

| Potential ↓ / Perf → | Low (Does not always meet) | Med (Consistently meets) | High (Consistently exceeds) |
|---|---|---|---|
| **High**   | 3 — Emerging Performer    | 2 — Future Star    | 1 — Consistent Star      |
| **Medium** | 6 — Inconsistent Performer | 5 — Key Performer  | 4 — High Professional Plus |
| **Low**    | 9 — Lower Performer       | 8 — Solid Performer | 7 — High Professional   |

Box number is fully derivable from `(performance, potential)`, but storing it
explicitly makes filtering, ordering, and indexing trivial.

## Current State

### Backend (FastAPI + SQLAlchemy + Postgres + Alembic)
- Member model: `backend/app/models/team_member.py` — UUID PK, `employee_id`
  unique, child relationships declared at lines 119–122 (`history`,
  `program_assignments`).
- Closest analog for a child entity: `backend/app/models/member_history.py`
  (EAV table with `member_uuid` FK + `effective_date`).
- Service template: `backend/app/services/history_service.py`
  (`create_history_entry`, `get_member_history`).
- Eager-loading chain: `backend/app/services/member_service.py::get_member`
  (line 90) — every relationship in `TeamMemberDetailResponse` must have a
  matching `selectinload`.
- Detail schema: `backend/app/schemas/team_member.py::TeamMemberDetailResponse`
  (line 113) is where `calibrations: list[CalibrationResponse]` would attach.
- Sub-resource router template: `backend/app/api/routes/history.py`, registered
  in `backend/app/main.py` (lines 61–72).
- Model registration: `backend/app/models/__init__.py` — must import the new
  model before `alembic autogenerate` will see it.
- Migrations: hand-edited Alembic files in `backend/alembic/versions/`.

### Backend Import Infrastructure
- Entity registry: `backend/app/schemas/import_schemas.py::EntityType` is a
  `Literal[...]` — extend with `"calibration"`.
- Per-entity config: `backend/app/services/import_mapper.py::ENTITY_CONFIGS`
  (line 94). Add a `"calibration"` entry with `target_fields`,
  `required_fields`, validators.
- Commit dispatcher: `backend/app/services/import_commit.py::commit_import`
  (line 282), if/elif at lines 309–326.
- Closest commit analog: `import_commit_members.py::_commit_financial_history`
  (line 176) — but it dedups by `employee_id`, which calibration CSVs may lack.
- Race-aware lookup helpers (`_get_or_create_*`) live at
  `import_commit.py:28–96` — calibration only *looks up* members, doesn't
  create entities, so race risk is lower.

### Frontend (React + Vite + TanStack Query v5 + Tailwind)
- Member detail UI: `frontend/src/components/members/MemberDetailSheet.tsx`
  (slide-out, sectioned by `<Separator.Root>` — calibration would slot in as
  a new section after History).
- Query keys: `frontend/src/hooks/useMembers.ts` (lines 5–9: `memberKeys.all`,
  `.list`, `.detail`). Each sub-resource has its own hook + key namespace.
- Import wizard: `frontend/src/components/import/ImportWizard.tsx` (line 27
  `ENTITY_CONFIGS` mirrors backend). Column definitions in
  `MapColumnsStep.tsx` lines 14–77 — add `CALIBRATION_TARGET_FIELDS`. The
  wizard's four steps (Source → MapColumns → Preview → Result) need no
  structural changes.
- `EntityType` Literal mirror lives in `frontend/src/api/importApi.ts`.
- Routing: `frontend/src/App.tsx` (React Router v6, single `<AppLayout>`
  wrapper, lines 15–28).
- Sidebar nav: `frontend/src/components/layout/AppLayout.tsx` `navItems`
  (lines 5–11) — add a "Calibration" entry.
- **Charting libraries installed: none.** No recharts, d3, visx, nivo,
  framer-motion. Available primitives: `@xyflow/react` (used by tree views,
  overkill for a grid), `@radix-ui/react-tooltip`, Tailwind, plain CSS Grid.

## Gaps
1. No `Calibration` model, schema, service, or router.
2. No `"calibration"` entry in either `EntityType` literal (backend or frontend).
3. No commit handler for name-keyed (`first_name + last_name`) member lookup —
   every existing import dedups by `employee_id`.
4. No top-level visualization route or page.
5. No charting/animation library; visualization must be CSS Grid + Tailwind
   (or a deliberate dependency add).
6. No member-comparison UI primitive — closest analog is
   `EntityMembersSheet`, which is a list, not a side-by-side compare.

## Dependencies
- Alembic must run a new migration before any backend test exercises the model.
- Frontend `EntityType` literal must be kept in sync with backend (this is the
  pattern that triggered errors in features 047/050 — see error index).
- The visualization page needs an endpoint that returns *all* calibrations
  with member identity attached (avoid N+1 from the existing `/api/members/`
  detail endpoint).

## Risks

### From the Error Index (`.context/errors/INDEX.md`)
- **Error #4 — `MissingGreenlet`**: any relationship surfaced in a response
  schema must be eager-loaded in *every* route using that schema. Mitigation:
  put `calibrations` on `TeamMemberDetailResponse` only, not the list schema.
- **Error #6/#7 — stale TanStack cache**: every calibration mutation must
  invalidate `memberKeys.detail(uuid)` *and* a new
  `calibrationKeys.byMember(uuid)`, plus a board-level
  `calibrationKeys.all` for the visualization page.
- **Error #15 — mapped-but-empty replace**: if calibration import supports
  "replace existing on this date" semantics, gate replacement on
  `bool(incoming_calibrations)`, not `"box" in row` — empty cells must mean
  "no-op", not "wipe".
- **Error #16 — semicolon splitter**: not applicable (one row per calibration).
- **Error #17 — `_get_or_create_*` race**: calibration import does not create
  shared entities, but the name-based member lookup has *no unique constraint*
  in the DB. `scalar_one_or_none()` will raise `MultipleResultsFound` for
  duplicate names — must use `scalars().all()` and emit an explicit ambiguity
  error per row.

### New risks specific to this feature
- **Name collisions are a `when`, not an `if`.** Two members named "Alex
  Chen" are realistic. CSV-side mitigation: allow an optional `employee_id`
  column that wins over name match; surface ambiguous rows in the import
  result instead of silently picking one.
- **Calibration is time-boxed.** Even if v1 captures only the latest
  placement, the schema should include `effective_date` (or `cycle_label`) so
  the eventual "history of calibrations" feature isn't a painful migration.
- **Box number derivability.** Storing both `(performance, potential)` *and*
  `box` introduces a consistency invariant. Either store only the two axes
  and compute box on read, or add a CHECK constraint / DB trigger /
  application-level validator. Recommended: store axes, compute box and
  label in the response schema.
- **Visualization scale.** With 200+ members, a single 9-box cell can
  contain 30+ chips. The interactive layer needs cell-level
  expand/scroll/cluster behavior — don't assume cells stay small.

## Open Questions
1. **Single calibration per member, or history?** v1 schema should support
   history (cheap) but the UI may show only the latest. Confirm with user.
2. **Does the CSV include `employee_id` as a tiebreaker?** Strongly
   recommended; need to confirm what the calibration export tool emits.
3. **Comparison UX:** select 2–4 members and see them side-by-side in a
   panel? Or a "compare mode" overlay on the 9-box itself? User said
   "comparisons across members" — needs a sketch or more detail.
4. **Filter dimensions:** by area, team, program, manager, tenure? Reuse
   the existing member filter set, or build a calibration-specific one?
5. **Interactivity scope for "immersive":** hover tooltips + click-to-detail
   is table stakes. Are we considering drag-to-recalibrate "what-if" mode
   (would justify `@xyflow/react`), animated transitions on filter change
   (would justify adding `framer-motion`), or just a polished static grid?
6. **Notes / commentary field on calibration?** Calibration discussions
   often produce qualitative notes — store them?
7. **Access control:** calibration data is sensitive. Should viewing the
   page be gated to certain roles? (No RBAC exists yet — this could be the
   first feature to need it.)

## Suggested Approach (deferred to /planner)
Sketch only — the planner phase will formalize.

- **Backend**: new `Calibration` model with `(member_uuid, performance int
  1–3, potential int 1–3, effective_date, notes)`. Compute `box` and `label`
  in the response schema, not in the column. Service mirrors
  `history_service.py`. Sub-resource router under
  `/api/members/{uuid}/calibrations` for member-scoped reads, plus a
  top-level `GET /api/calibrations` for the visualization page (returns flat
  rows with `member_uuid`, `first_name`, `last_name`, `area_id`, `team_id`
  for client-side filtering).
- **Import**: add `"calibration"` to `EntityType`, register an
  `EntityConfig`, write `_commit_calibrations` that does a name-keyed lookup
  with explicit ambiguity handling and an optional `employee_id` tiebreaker.
- **Frontend**:
  - New section in `MemberDetailSheet.tsx` showing latest calibration.
  - New `frontend/src/pages/CalibrationPage.tsx` with a 3×3 CSS Grid; each
    cell uses Tailwind for the colored gradient and contains member chips
    with Radix tooltips. Filter chips along the top reuse existing
    `useAreas`/`useTeams`/`usePrograms` hooks.
    Compare mode: select up to 4 members → highlights their cells and opens
    a side panel.
  - New hook file `frontend/src/hooks/useCalibrations.ts` with a dedicated
    `calibrationKeys` constant.
  - Extend wizard `ENTITY_CONFIGS` and `EntityType` literal.
- **Migration**: Alembic revision adding `calibrations` table with FK to
  `team_members.uuid` ON DELETE CASCADE, plus a composite index on
  `(member_uuid, effective_date DESC)`.

## Files to touch (preliminary)
Backend: `models/calibration.py` (new), `models/__init__.py`,
`schemas/calibration.py` (new), `schemas/team_member.py`,
`schemas/import_schemas.py`, `services/calibration_service.py` (new),
`services/member_service.py`, `services/import_mapper.py`,
`services/import_commit.py`, `services/import_commit_members.py` (or new
`import_commit_calibrations.py`), `api/routes/calibrations.py` (new),
`main.py`, `alembic/versions/<new>_add_calibrations.py`.

Frontend: `api/calibrationApi.ts` (new), `api/importApi.ts`,
`hooks/useCalibrations.ts` (new), `pages/CalibrationPage.tsx` (new),
`components/calibration/*` (new — `NineBoxGrid`, `CalibrationCell`,
`CompareDrawer`, `CalibrationFilters`), `components/members/MemberDetailSheet.tsx`,
`components/import/ImportWizard.tsx`, `components/import/MapColumnsStep.tsx`,
`components/layout/AppLayout.tsx`, `App.tsx`.

## Next
`/planner .context/features/057-member-calibration/NOTES.md`
