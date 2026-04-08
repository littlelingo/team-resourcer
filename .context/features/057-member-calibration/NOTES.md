# Feature 057 — Member Calibration (9-Box Matrix)

## Goal
Add a `Calibration` entity capturing each member's placement on the 9-box
matrix (Performance × Potential) **across cycles, as a first-class
historical record** that members and managers actively track for growth.
Calibrations are importable via CSV (matched by first+last name), surfaced
on the member detail view, viewable as a per-member growth timeline, and
explorable through a dedicated, immersive 9-box visualization page with 9
toggleable widgets, filtering, member comparison, and animated transitions.

History is **not** a "nice future addition" — it is the headline feature.
The page exists primarily to answer: *"how is this person / team / org
moving over time?"*

## The 9-Box Model (from source image)
3×3 grid: **Potential** (y: Low/Medium/High) × **Performance** (x: Low/Med/High).

| Potential ↓ / Perf → | Low (Does not always meet) | Med (Consistently meets) | High (Consistently exceeds) |
|---|---|---|---|
| **High**   | 3 — Emerging Performer    | 2 — Future Star    | 1 — Consistent Star      |
| **Medium** | 6 — Inconsistent Performer | 5 — Key Performer  | 4 — High Professional Plus |
| **Low**    | 9 — Lower Performer       | 8 — Solid Performer | 7 — High Professional   |

Box number is fully derivable from `(performance, potential)`. Store axes as
typed columns; compute `box` and `label` in the response schema to avoid
consistency drift.

## Locked Decisions

| Decision | Resolution |
|---|---|
| History or latest? | **History, first-class.** Required for growth tracking. |
| Comparison UX | Side drawer with radar chart, 2–4 members. |
| Interactivity scope | Framer-motion filter transitions, hover/tooltips, **no** drag-to-recalibrate in v1. |
| Notes field | **Yes** — narrative is part of "tracking progress." |
| Charting library | **Visx** (modular imports, ~45kb gz). |
| Animation library | **framer-motion** (~30kb gz). |
| Widget visibility | User-toggleable via popover menu, persisted to localStorage. |
| Cycles | First-class `CalibrationCycle` entity with unique label, sequence number, dates. |

## Still Open (planner can default; revisit at /plan review)
1. **`employee_id` as CSV tiebreaker?** Strongly recommended for name-collision safety. Default: optional column, wins over name match when present.
2. **Filter dimensions on the visualization page?** Default: area, team, program, manager, cycle. Reuse existing `useAreas`/`useTeams`/`usePrograms` hooks.
3. **RBAC?** No RBAC exists in the app yet. Default: visible to all authenticated users in v1; flag as a follow-up.

## Current State

### Backend (FastAPI + SQLAlchemy + Postgres + Alembic)
- Member model: `backend/app/models/team_member.py` — UUID PK, `employee_id` unique, child relationships at lines 119–122.
- Closest child-entity analog: `backend/app/models/member_history.py`.
- Service template: `backend/app/services/history_service.py`.
- Eager-loading chain: `backend/app/services/member_service.py::get_member` (line 90).
- Detail schema: `backend/app/schemas/team_member.py::TeamMemberDetailResponse` (line 113).
- Sub-resource router template: `backend/app/api/routes/history.py`, registered in `backend/app/main.py` (lines 61–72).
- Model registration: `backend/app/models/__init__.py`.
- Migrations: hand-edited Alembic files in `backend/alembic/versions/`.

### Backend Import Infrastructure
- Entity registry: `backend/app/schemas/import_schemas.py::EntityType` Literal — extend with `"calibration"`.
- Per-entity config: `backend/app/services/import_mapper.py::ENTITY_CONFIGS` (line 94).
- Commit dispatcher: `backend/app/services/import_commit.py::commit_import` (line 282), if/elif at lines 309–326.
- Closest commit analog: `import_commit_members.py::_commit_financial_history` (line 176) — but it dedups by `employee_id`.
- Race-aware lookup helpers (`_get_or_create_*`) at `import_commit.py:28–96` — pattern to mirror for `_get_or_create_cycle`.

### Frontend (React + Vite + TanStack Query v5 + Tailwind)
- Member detail UI: `frontend/src/components/members/MemberDetailSheet.tsx` (slide-out sheet, sectioned by `<Separator.Root>`).
- Query keys: `frontend/src/hooks/useMembers.ts` (lines 5–9: `memberKeys.all`, `.list`, `.detail`).
- Import wizard: `frontend/src/components/import/ImportWizard.tsx` line 27 `ENTITY_CONFIGS`. Column defs in `MapColumnsStep.tsx` lines 14–77.
- `EntityType` mirror: `frontend/src/api/importApi.ts`.
- Routing: `frontend/src/App.tsx` (React Router v6, single `<AppLayout>` wrapper).
- Sidebar nav: `frontend/src/components/layout/AppLayout.tsx` `navItems` (lines 5–11).
- **No charting libraries installed** — clean slate for the Visx introduction.

## Schema Sketch

### `calibration_cycles`
| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `label` | varchar(50) **unique** | e.g., "2026 Q1", "2025 Annual" — uniqueness enables race-safe `_get_or_create` |
| `sequence_number` | int | for ordering; auto-assigned on insert |
| `start_date` | date nullable | |
| `end_date` | date nullable | |
| `is_active` | bool default true | |
| `notes` | text nullable | |
| `created_at` | timestamptz | |

### `calibrations`
| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `member_uuid` | uuid FK → team_members.uuid | ON DELETE CASCADE |
| `cycle_id` | int FK → calibration_cycles.id | ON DELETE RESTRICT |
| `performance` | smallint CHECK (1–3) | 1=Low, 2=Med, 3=High |
| `potential` | smallint CHECK (1–3) | 1=Low, 2=Med, 3=High |
| `effective_date` | date | finer-grained ordering within a cycle |
| `notes` | text nullable | calibration discussion narrative |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Constraints**:
- Composite UNIQUE `(member_uuid, cycle_id)` — one calibration per member per cycle.
- Composite INDEX `(member_uuid, effective_date DESC)` — fast latest-per-member lookup.
- INDEX `(cycle_id)` — Sankey + cohort queries.

`box` (1–9) and `label` are computed in the Pydantic response schema.

## Visualization Architecture: Widget Registry

The 9 widgets are not hardcoded in `CalibrationPage.tsx`. They live in a
registry so adding a 10th widget = one new file + one registry entry.

### Directory layout
```
frontend/src/
├── pages/
│   ├── CalibrationPage.tsx                  # main 9-box page
│   └── MemberCalibrationTimelinePage.tsx    # per-member growth timeline
├── components/calibration/
│   ├── widgets/
│   │   ├── registry.ts                      # WidgetDef map
│   │   ├── types.ts                         # WidgetDef, WidgetProps
│   │   ├── NineBoxGrid.tsx                  # #1
│   │   ├── MarginalBars.tsx                 # #2
│   │   ├── MovementSankey.tsx               # #3
│   │   ├── CohortSmallMultiples.tsx         # #4
│   │   ├── TrajectoryPath.tsx               # #6
│   │   ├── ComparisonRadar.tsx              # #7
│   │   ├── KpiStrip.tsx                     # #8
│   │   └── CycleTrendLines.tsx              # #9
│   ├── FilterTransitions.tsx                # #5 — wrapper, not a widget
│   ├── CalibrationFilterContext.tsx
│   ├── CompareDrawer.tsx
│   ├── WidgetToggleMenu.tsx
│   ├── GrowthTimeline.tsx                   # full per-member view
│   └── useWidgetVisibility.ts               # localStorage-backed
├── hooks/
│   ├── useCalibrations.ts                   # latest list
│   ├── useCalibrationCycles.ts
│   ├── useCalibrationMovement.ts            # cycles diff for Sankey
│   └── useCalibrationHistory.ts             # per-member history
└── api/
    └── calibrationApi.ts
```

### `WidgetDef` shape
```ts
interface WidgetDef {
  id: WidgetId;                                 // 'nine-box' | 'marginal-bars' | ...
  label: string;                                // shown in toggle menu
  description: string;                          // tooltip in toggle menu
  defaultVisible: boolean;
  category: 'page' | 'detail-sheet' | 'compare-drawer';
  dataSource: 'latest' | 'cycles' | 'history';  // drives query gating
  layout: { colSpan: number; rowSpan?: number };
  component: React.LazyExoticComponent<React.ComponentType<WidgetProps>>;
}
```

### Toggle persistence
`localStorage` key: `team-resourcer:calibration:visibleWidgets:v1`. Hook
`useWidgetVisibility` returns `{ visible: Set<WidgetId>, toggle, reset }`.
Future: server-side sync via a `user_preferences` table (out of v1 scope).

### Data dependency gating
Page-level fetcher inspects which widgets are currently visible and only
runs the queries those widgets need (`latest` / `cycles` / `history`).
Toggling Sankey off skips the `/cycles` call entirely. Implemented with
TanStack Query's `enabled` flag derived from the visibility set.

## API Endpoints (new)
| Method | Path | Powers | Notes |
|---|---|---|---|
| `GET` | `/api/calibration-cycles` | cycle pickers, dropdowns | Sorted by `sequence_number` |
| `POST` | `/api/calibration-cycles` | manage-cycles admin (low priority) | |
| `GET` | `/api/calibrations/latest` | widgets #1, #2, #4, #7, #8, #9 (current snapshot) | Flat list with denormalized `area_id`/`team_id`/`program_ids` |
| `GET` | `/api/calibrations/cycles?from=X&to=Y` | widget #3 Sankey | Returns paired calibrations between two cycles |
| `GET` | `/api/calibrations/trends?cycles=N` | widget #9 trend lines | Aggregated counts per box per cycle |
| `GET` | `/api/members/{uuid}/calibrations` | member sheet sparkline + growth timeline page | Full history for one member |
| `POST` | `/api/members/{uuid}/calibrations` | manual entry / edit | |

## The 9 Visualization Widgets

| # | Widget | Component | Data | Library | Default Visible |
|---|---|---|---|---|---|
| 1 | Heatmap-overlaid 9-box grid | `NineBoxGrid` | latest | Tailwind/CSS | ✅ |
| 2 | Marginal distribution bars | `MarginalBars` | latest | Visx (`@visx/shape`) | ✅ |
| 3 | Cycle-to-cycle movement Sankey | `MovementSankey` | cycles | Visx (`@visx/sankey`) | ✅ |
| 4 | Cohort small multiples (per area/team) | `CohortSmallMultiples` | latest | Tailwind/CSS | ❌ |
| 5 | Animated filter transitions | `FilterTransitions` (wrapper) | n/a | framer-motion | ✅ (always on) |
| 6 | Member trajectory sparkline | `TrajectoryPath` | history | Visx + SVG | ✅ (detail-sheet) |
| 7 | Member comparison radar | `ComparisonRadar` | latest + history | Visx (`@visx/radar`) | ✅ (compare drawer) |
| 8 | KPI strip | `KpiStrip` | latest | Tailwind/CSS | ✅ |
| 9 | Cycle-over-cycle trend lines | `CycleTrendLines` | trends | Visx (`@visx/shape`) | ❌ |

## Growth Timeline (per-member view)
New route: `/members/{uuid}/calibration` → `MemberCalibrationTimelinePage.tsx`.
Composition:
- Horizontal timeline of cycles with the member's box position at each
- Mini 9-box per cycle showing the placement
- Annotated movement deltas: "↑ Key Performer → Future Star (Q4 2025 → Q1 2026)"
- Notes per calibration rendered as a narrative
- Trend summary: "3 cycles, net +2 boxes, trending upward"

A compact `TrajectoryPath` widget (#6) embeds in `MemberDetailSheet.tsx` with
a "View full timeline" link that routes to this page. Both render from the
same `useCalibrationHistory(uuid)` hook.

## Page Layout (default)
```
[ KPI Strip (#8, full width) ]
[ NineBoxGrid + MarginalBars (#1+#2, 8 cols) ] [ Filter panel (4 cols) ]
[ Movement Sankey (#3, full width) ]
[ Cycle Trend Lines (#9, full width) ]
[ Cohort Small Multiples (#4, full width) ]
```
User reordering deferred to v2.

## Bundle Accounting
| Dep | Size (gz) |
|---|---|
| `@visx/scale` + `@visx/shape` + `@visx/group` + `@visx/sankey` + `@visx/radar` + `@visx/text` + `@visx/responsive` + `@visx/axis` | ~45kb |
| `framer-motion` | ~30kb |
| **Total new** | **~75kb gz** |

Acceptable for an internal app; lazy-loaded widgets keep first-paint clean.

## Import Flow
1. Wizard adds `"calibration"` entity type.
2. CSV columns: `first_name`, `last_name`, `cycle_label` (required); `employee_id`, `performance`, `potential`, `effective_date`, `notes` (optional except perf/potential which are also required).
3. Commit handler `_commit_calibrations`:
   - For each row, `_get_or_create_cycle(label)` using race-safe pattern.
   - Member lookup: `employee_id` first if present, else `(first_name, last_name)`. Use `scalars().all()` and emit explicit ambiguity error per row.
   - Upsert on `(member_uuid, cycle_id)` — re-importing the same cycle updates rather than duplicates.
4. Result step shows: created cycles, created/updated calibrations, ambiguous-name errors, unmatched members.

## Risks

### From the Error Index
- **Error #4 — `MissingGreenlet`**: Put `calibrations`/`latest_calibration` only on `TeamMemberDetailResponse`, not the list schema. If the list schema needs a "current box" badge later, denormalize it as a column on `team_members` rather than relationship-load.
- **Error #6/#7 — stale TanStack cache**: Every calibration mutation must invalidate `memberKeys.detail(uuid)`, `calibrationKeys.byMember(uuid)`, `calibrationKeys.latest`, `calibrationKeys.cycles`, and `calibrationKeys.trends`. This is a lot — define a `invalidateAllCalibrationViews()` helper.
- **Error #15 — mapped-but-empty replace**: gate any replace semantics on `bool(incoming_calibrations)`, not key presence.
- **Error #17 — `_get_or_create_*` race**: `_get_or_create_cycle` must mirror the pattern. Member name lookup has no DB uniqueness — use `scalars().all()` + ambiguity error, never `scalar_one_or_none()`.

### New risks
- **Name collisions** are a *when*, not an *if*. Default mitigation: `employee_id` optional column wins over name match; ambiguous rows surfaced in the import result rather than silently picked.
- **Schema invariant**: storing only `(performance, potential)` and computing `box`/`label` in the response schema avoids drift. Resist the urge to cache `box` as a column.
- **Empty-state proliferation**: 9 widgets → 9 empty states. Sankey breaks with one cycle. Trajectory breaks with one calibration. Cohort small multiples break with no cohort selected. Each widget needs a graceful placeholder — easy to forget, painful in prod.
- **Filter coupling**: 9 widgets must respond consistently to filter changes. Solve with a single `CalibrationFilterContext`, not prop drilling.
- **Sankey legibility**: 9×9 = 81 possible transitions. Mitigations: hover-to-highlight, dim non-hovered ribbons, "show only material moves (≥N members)" filter.
- **Small-multiples scale**: cap at top-12 cohorts by size; document the cap in the widget UI.
- **Cycle-label drift in CSVs**: enforced by FK to `calibration_cycles.label` uniqueness, but case sensitivity matters. Normalize on insert (trim, collapse whitespace) — do *not* lowercase, since labels are display strings.
- **History authorization**: per-member growth timelines are sensitive. v1 ships without RBAC (no RBAC exists yet); flag as follow-up.

## Files To Touch (preliminary)

### Backend (new)
- `models/calibration.py`
- `models/calibration_cycle.py`
- `schemas/calibration.py` (includes computed `box`/`label`)
- `schemas/calibration_cycle.py`
- `services/calibration_service.py`
- `services/calibration_cycle_service.py`
- `services/import_commit_calibrations.py` (or extend `import_commit_members.py`)
- `api/routes/calibrations.py`
- `api/routes/calibration_cycles.py`
- `alembic/versions/<new>_add_calibrations_and_cycles.py`

### Backend (modified)
- `models/__init__.py`
- `models/team_member.py` (add `calibrations` relationship)
- `schemas/team_member.py` (add `calibrations`/`latest_calibration` to detail response)
- `schemas/import_schemas.py` (extend `EntityType`)
- `services/member_service.py` (add `selectinload(TeamMember.calibrations)` in `get_member`)
- `services/import_mapper.py` (`ENTITY_CONFIGS["calibration"]`)
- `services/import_commit.py` (dispatcher branch + `_get_or_create_cycle`)
- `main.py` (register routers)

### Frontend (new)
- `pages/CalibrationPage.tsx`
- `pages/MemberCalibrationTimelinePage.tsx`
- `api/calibrationApi.ts`
- `hooks/useCalibrations.ts`
- `hooks/useCalibrationCycles.ts`
- `hooks/useCalibrationHistory.ts`
- `hooks/useCalibrationMovement.ts`
- `components/calibration/widgets/registry.ts`
- `components/calibration/widgets/types.ts`
- `components/calibration/widgets/NineBoxGrid.tsx`
- `components/calibration/widgets/MarginalBars.tsx`
- `components/calibration/widgets/MovementSankey.tsx`
- `components/calibration/widgets/CohortSmallMultiples.tsx`
- `components/calibration/widgets/TrajectoryPath.tsx`
- `components/calibration/widgets/ComparisonRadar.tsx`
- `components/calibration/widgets/KpiStrip.tsx`
- `components/calibration/widgets/CycleTrendLines.tsx`
- `components/calibration/FilterTransitions.tsx`
- `components/calibration/CalibrationFilterContext.tsx`
- `components/calibration/CompareDrawer.tsx`
- `components/calibration/WidgetToggleMenu.tsx`
- `components/calibration/GrowthTimeline.tsx`
- `components/calibration/useWidgetVisibility.ts`

### Frontend (modified)
- `App.tsx` (two new routes)
- `components/layout/AppLayout.tsx` (sidebar entry)
- `components/members/MemberDetailSheet.tsx` (latest calibration + trajectory embed + "View full timeline" link)
- `components/import/ImportWizard.tsx` (`ENTITY_CONFIGS`)
- `components/import/MapColumnsStep.tsx` (`CALIBRATION_TARGET_FIELDS`)
- `api/importApi.ts` (`EntityType` literal)
- `package.json` (add Visx modules + framer-motion)

## Next
`/planner .context/features/057-member-calibration/NOTES.md`
