# PRP-057: Member Calibration (9-Box Matrix)

**Status**: APPROVED
**Research**: `.context/features/057-member-calibration/NOTES.md`
**Testing Strategy**: implement-then-test (project default)
**Complexity**: HIGH (single PRP, sequenced into 6 phases for incremental delivery)

---

## Context

team-resourcer currently tracks members, teams, programs, and financial
history, but has no representation of *performance/potential calibration*.
The user wants to introduce 9-box matrix data as a first-class entity, with
**history as the headline feature** so members and managers can track growth
across cycles.

The feature has three pillars:
1. **Data**: a `Calibration` entity tied to members through cycles, importable via CSV.
2. **Member-level surface**: a per-member growth timeline page plus a compact embed in `MemberDetailSheet.tsx`.
3. **Org-level visualization**: a dedicated page hosting **9 toggleable widgets** built around a **widget registry** so future widgets are one-file additions.

All architectural decisions (history first-class, Visx + framer-motion,
widget registry, two-table schema with cycles, store-box-not-axes) are
locked. This PRP turns those decisions into ordered, runnable work.

### Source CSV (locked, do not negotiate)
The calibration export tool produces these columns:
- `First Name`, `Last Name`
- `Calibration Reviewers` (multi-value text)
- `High Growth or Key Talent` (verbatim text)
- `9-Box Matrix` (the box value 1–9, possibly with label suffix like "5 - Key Performer")
- `Ready for promotion?` (verbatim text)
- `Can mentor juniors?` (verbatim text)
- `"Remain, Increase Current Responsibilities Ready, Move to New Complex Program"` (single column, categorical next-move recommendation — verbatim text)
- `Rationale` (free text — replaces a generic "notes" field)

**No `employee_id` is available.** Member matching is name-only. Ambiguous matches (two members with the same first+last name) are surfaced in a manual-resolve UI in the Result step, not silently picked.

---

## Phases

The work splits into 6 phases. Each phase ends in a working, testable state.

| Phase | Goal |
|---|---|
| 1 | Backend foundation: models, migration, schemas, services, routers. Manual API works. |
| 2 | Backend import: CSV preview/commit, ambiguous-match detection, manual-resolve API. |
| 3 | Frontend foundation: API client, hooks, member sheet embed, growth timeline skeleton. |
| 4 | Widget registry + headline widgets (#1, #2, #5, #8). Calibration page renders. |
| 5 | Remaining widgets (#3, #4, #6, #7, #9) + compare drawer. |
| 6 | Import wizard frontend wiring, ambiguity-resolve UI, polish, docs. |

---

## Phase 1 — Backend Foundation

### Step 1.1 — Models

**New file**: `backend/app/models/calibration_cycle.py`
```
id              int PK
label           varchar(50) UNIQUE NOT NULL    # "2026 Q1"
sequence_number int NOT NULL                    # for ordering
start_date      date nullable
end_date        date nullable
is_active       bool default True
notes           text nullable
created_at      timestamptz default now()
```

**New file**: `backend/app/models/calibration.py`
```
id                              int PK
member_uuid                     uuid FK -> team_members.uuid ON DELETE CASCADE NOT NULL
cycle_id                        int  FK -> calibration_cycles.id ON DELETE RESTRICT NOT NULL
box                             smallint NOT NULL  CHECK (box BETWEEN 1 AND 9)
reviewers                       text nullable                 # comma-sep verbatim
high_growth_or_key_talent       text nullable                 # verbatim CSV value
ready_for_promotion             text nullable                 # verbatim CSV value
can_mentor_juniors              text nullable                 # verbatim CSV value
next_move_recommendation        text nullable                 # verbatim CSV value
rationale                       text nullable                 # narrative
effective_date                  date NOT NULL
created_at                      timestamptz default now()
updated_at                      timestamptz default now()

UNIQUE (member_uuid, cycle_id)
INDEX  (member_uuid, effective_date DESC)
INDEX  (cycle_id)
INDEX  (box)
```

`box` is the **stored** value. `performance` (1–3) and `potential` (1–3) are
computed in the response schema from `box` via the inverse of:
```
box -> (perf, pot):
1: (3,3)  2: (2,3)  3: (1,3)
4: (3,2)  5: (2,2)  6: (1,2)
7: (3,1)  8: (2,1)  9: (1,1)
```

**Why store `box` instead of axes**: the CSV gives us `box` directly. Storing
it directly preserves source fidelity, eliminates a parsing round-trip, and
keeps the CHECK constraint trivial (one column, one range).

Add `calibrations` relationship to `TeamMember` in `backend/app/models/team_member.py`:
```python
calibrations: Mapped[list["Calibration"]] = relationship(
    "Calibration",
    back_populates="member",
    cascade="all, delete-orphan",
    order_by="Calibration.effective_date.desc()",
)
```

Register both new models in `backend/app/models/__init__.py`.

### Step 1.2 — Alembic migration

**New file**: `backend/alembic/versions/<rev>_add_calibrations_and_cycles.py`

Hand-edit (mirror `55b198d5e2a6_add_functional_manager_id.py` style):
- `op.create_table('calibration_cycles', ...)` with unique constraint on `label`.
- `op.create_table('calibrations', ...)` with FKs, CHECK, composite unique, and indexes.
- `downgrade()` drops in reverse order.

Validate with `make reset-db`.

### Step 1.3 — Pydantic schemas

**New file**: `backend/app/schemas/calibration_cycle.py`
- `CalibrationCycleResponse` (passthrough, `from_attributes=True`).
- `CalibrationCycleCreate`.

**New file**: `backend/app/schemas/calibration.py`
- Constants: `BOX_LABELS: dict[int, str]`, `BOX_TO_AXES: dict[int, tuple[int, int]]`. Single source of truth.
- `CalibrationResponse`: passthrough of all stored fields plus computed fields:
  ```python
  @computed_field
  @property
  def label(self) -> str:
      return BOX_LABELS[self.box]

  @computed_field
  @property
  def performance(self) -> int:
      return BOX_TO_AXES[self.box][0]

  @computed_field
  @property
  def potential(self) -> int:
      return BOX_TO_AXES[self.box][1]
  ```
  Includes nested `cycle: CalibrationCycleResponse`.
- `CalibrationCreate` / `CalibrationUpdate`: accept `box` directly + all verbatim text fields.

**Modify** `backend/app/schemas/team_member.py`:
- Add `calibrations: list[CalibrationResponse] = []` to `TeamMemberDetailResponse` after `history`.
- Add `latest_calibration: CalibrationResponse | None = None` as a computed field on `TeamMemberDetailResponse`.
- **Do NOT** add to `TeamMemberListResponse` (avoids error #4 MissingGreenlet).

### Step 1.4 — Service layer

**New file**: `backend/app/services/calibration_cycle_service.py`
- `list_cycles(session)` — ordered by `sequence_number`.
- `get_cycle(session, cycle_id)`.
- `get_or_create_cycle(session, label)` — race-safe (mirror error #17 mitigation from `import_commit.py:28-96`). Auto-assigns `sequence_number = max(existing) + 1`.
- `create_cycle(session, payload)`.

**New file**: `backend/app/services/calibration_service.py`
- `list_latest_calibrations(session, filters)` — one row per member (latest by `effective_date`), with denormalized `area_id`/`team_id`/`program_ids`.
- `list_movement(session, from_cycle_id, to_cycle_id)` — paired calibrations for sankey.
- `list_trends(session, last_n_cycles)` — aggregated counts per box per cycle.
- `get_member_calibrations(session, member_uuid)` — full history ordered by `effective_date DESC`.
- `create_calibration(session, member_uuid, payload)` — upserts on `(member_uuid, cycle_id)`.
- `update_calibration(session, calibration_id, payload)`.
- `delete_calibration(session, calibration_id)`.

**Modify** `backend/app/services/member_service.py::get_member` (~line 90):
```python
selectinload(TeamMember.calibrations).selectinload(Calibration.cycle)
```

### Step 1.5 — Routers

**New file**: `backend/app/api/routes/calibration_cycles.py`
- `GET /` — list all cycles.
- `POST /` — create cycle (201).

**New file**: `backend/app/api/routes/calibrations.py`
- `GET /latest?area_id=&team_id=&program_id=&cycle_id=` — visualization page.
- `GET /movement?from=<cycle_id>&to=<cycle_id>` — sankey.
- `GET /trends?cycles=N` — trend lines.

**New file**: `backend/app/api/routes/member_calibrations.py` (sub-resource):
- `GET /` — full history for one member.
- `POST /` — create (201).
- `PUT /{calibration_id}` — update.
- `DELETE /{calibration_id}` — 204.

**Modify** `backend/app/main.py`:
```python
app.include_router(calibration_cycles.router, prefix="/api/calibration-cycles", tags=["calibration-cycles"])
app.include_router(calibrations.router, prefix="/api/calibrations", tags=["calibrations"])
app.include_router(member_calibrations.router, prefix="/api/members/{member_uuid}/calibrations", tags=["member-calibrations"])
```

### Phase 1 Validation
```bash
make reset-db && make up
make test
curl -s -X POST localhost:8000/api/calibration-cycles \
  -H 'content-type: application/json' \
  -d '{"label":"2026 Q1","start_date":"2026-01-01","end_date":"2026-03-31"}'
curl -s -X POST localhost:8000/api/members/<uuid>/calibrations \
  -H 'content-type: application/json' \
  -d '{"cycle_id":1,"box":4,"effective_date":"2026-03-15","rationale":"Strong quarter","ready_for_promotion":"Yes","can_mentor_juniors":"Yes"}'
curl -s localhost:8000/api/members/<uuid> | jq '.calibrations, .latest_calibration'
```
Expect: 201s on creates, detail response includes `calibrations[0].box == 4`, `label == "High Professional Plus"`, `performance == 3`, `potential == 2`.

---

## Phase 2 — Backend Import

### Step 2.1 — Extend EntityType + ENTITY_CONFIGS

**Modify** `backend/app/schemas/import_schemas.py`:
- Add `"calibration"` to `EntityType` Literal.

**Modify** `backend/app/services/import_mapper.py::ENTITY_CONFIGS`:
```python
"calibration": EntityConfig(
    target_fields=[
        "first_name", "last_name",
        "cycle_label",                       # required, separate from CSV column set — see note
        "box",                               # parsed from "9-Box Matrix" column
        "reviewers",
        "high_growth_or_key_talent",
        "ready_for_promotion",
        "can_mentor_juniors",
        "next_move_recommendation",
        "rationale",
        "effective_date",                    # may need to default to cycle.end_date if absent
    ],
    required_fields=["first_name", "last_name", "cycle_label", "box"],
    numeric_fields=["box"],
    dedup_field=None,                        # upsert handles uniqueness
    validators={
        "box": validate_box_value,           # accepts "5", "5 - Key Performer", returns int 1-9
    },
),
```

Add `validate_box_value(raw)` helper that strips trailing label text
("5 - Key Performer" → 5) and validates 1 ≤ value ≤ 9.

**Note on `cycle_label`**: the source CSV does **not** include a cycle column.
The user supplies a cycle label in the wizard's MapColumns step as a *constant
value* (a new wizard affordance — see Step 6.1). Same for `effective_date` if
absent from the CSV.

### Step 2.2 — Commit handler with ambiguity detection

**New file**: `backend/app/services/import_commit_calibrations.py`

Function `_commit_calibrations(session, rows)`:
1. Resolve cycle once (from constant): `get_or_create_cycle(session, cycle_label)`.
2. For each row:
   - Member lookup: `select(TeamMember).where(first_name==..., last_name==...)`.
   - Use `scalars().all()`. **Never** `scalar_one_or_none()`.
     - 0 matches → bucket: `unmatched_rows`.
     - 1 match → proceed to upsert.
     - 2+ matches → bucket: `ambiguous_rows` with list of candidate member UUIDs + names. Do **not** insert.
   - Single-match path: upsert on `(member_uuid, cycle_id)`. Try insert; on `IntegrityError`, update.
3. Return summary:
   ```python
   {
     "created_calibrations": int,
     "updated_calibrations": int,
     "created_cycles": int,
     "unmatched_rows": [{"row_index": int, "first_name": str, "last_name": str}, ...],
     "ambiguous_rows": [{"row_index": int, "first_name": str, "last_name": str,
                         "candidates": [{"uuid": str, "label": str}, ...],
                         "row_data": dict}, ...],
   }
   ```

The `row_data` payload is critical — it lets the manual-resolve API (Step 2.3)
re-apply the same row data to whichever candidate the user picks, without
re-uploading the CSV.

**Modify** `backend/app/services/import_commit.py::commit_import` (lines 309–326): add `elif entity_type == "calibration"` branch.

### Step 2.3 — Manual-resolve endpoint

**New file**: `backend/app/api/routes/calibration_resolve.py`
- `POST /api/calibrations/resolve-ambiguous`
  - Body: `{ "cycle_id": int, "resolutions": [{ "member_uuid": str, "row_data": {...} }, ...] }`
  - For each resolution, performs the same upsert that `_commit_calibrations` would have done for an unambiguous match.
  - Returns the same summary shape.

**Modify** `backend/app/main.py`: register the new router under `/api/calibrations` (or merge into `calibrations.py`).

### Phase 2 Validation
```bash
# CSV with two members named "Alex Chen" plus 10 unique members
curl -s -X POST localhost:8000/api/import/preview -F file=@calibrations.csv -F entity_type=calibration | jq
curl -s -X POST localhost:8000/api/import/commit -H 'content-type: application/json' -d '{...}' | jq
```
Expect: 10 rows committed, 2 in `ambiguous_rows`. Then call `/resolve-ambiguous` with picks → both rows committed.

---

## Phase 3 — Frontend Foundation

### Step 3.1 — API client + types

**New file**: `frontend/src/api/calibrationApi.ts`
- Types: `Calibration`, `CalibrationCycle`, `CalibrationLatestRow`, `CalibrationMovement`, `CalibrationTrendPoint`, `AmbiguousRow`.
- Functions: `fetchCycles`, `fetchLatestCalibrations`, `fetchMovement`, `fetchTrends`, `fetchMemberCalibrations`, `createCalibration`, `updateCalibration`, `deleteCalibration`, `resolveAmbiguousCalibrations`.

**Modify** `frontend/src/api/importApi.ts`:
- Add `"calibration"` to `EntityType` Literal.
- Add `AmbiguousRow` to the import result type.

### Step 3.2 — Hooks + query keys

**New files** (one per concern):
- `frontend/src/hooks/useCalibrationCycles.ts`
- `frontend/src/hooks/useCalibrations.ts` — latest, filtered.
- `frontend/src/hooks/useCalibrationMovement.ts`
- `frontend/src/hooks/useCalibrationTrends.ts`
- `frontend/src/hooks/useCalibrationHistory.ts` — per member.

```ts
export const calibrationKeys = {
  all:        ['calibrations'] as const,
  cycles:     ['calibrations', 'cycles'] as const,
  latest:     (filters?: Filters) => ['calibrations', 'latest', filters ?? {}] as const,
  movement:   (from: number, to: number) => ['calibrations', 'movement', from, to] as const,
  trends:     (n: number) => ['calibrations', 'trends', n] as const,
  byMember:   (uuid: string) => ['calibrations', 'member', uuid] as const,
};
```

**Helper**: `invalidateAllCalibrationViews(qc)` — invalidates `calibrationKeys.all` plus `memberKeys.detail(uuid)`. Used in every mutation `onSuccess` (mirrors error #6/#7 mitigation).

### Step 3.3 — Member detail sheet integration

**Modify** `frontend/src/components/members/MemberDetailSheet.tsx`:
- New section after History: "Calibration".
- If `member.latest_calibration`:
  - Colored box badge (number + label)
  - Effective date, cycle label
  - Verbatim chips: Ready for promotion, Can mentor juniors, High growth / Key talent
  - Rationale excerpt (truncated)
  - Reviewers as small text
- Trajectory placeholder div (real widget arrives Phase 5).
- "View full timeline →" routes to `/members/{uuid}/calibration`.

### Step 3.4 — Growth timeline page (skeleton)

**New file**: `frontend/src/pages/MemberCalibrationTimelinePage.tsx`
- Reads `:uuid`, calls `useCalibrationHistory(uuid)`.
- Horizontal timeline of cycles with rationale narrative under each.
- Trend summary line: "N cycles, net ±X boxes, trending up/down/flat".
- Real `TrajectoryPath` widget arrives in Phase 5.

**Modify** `frontend/src/App.tsx`:
- Add `<Route path="/members/:uuid/calibration" element={<MemberCalibrationTimelinePage />} />`.

### Phase 3 Validation
```bash
cd frontend && npx vitest run
cd frontend && npm run dev
```
- Member detail sheet renders calibration section with latest data.
- Full timeline page renders, hits the API, shows skeleton.
- DevTools network: only `/api/members/{uuid}` and `/api/members/{uuid}/calibrations` fire.

---

## Phase 4 — Widget Registry + Headline Widgets

### Step 4.1 — Install dependencies
```bash
cd frontend && npm install \
  @visx/scale @visx/shape @visx/group @visx/axis \
  @visx/responsive @visx/text \
  framer-motion
```

### Step 4.2 — Filter context

**New file**: `frontend/src/components/calibration/CalibrationFilterContext.tsx`
- Provides `{ areaId, teamId, programId, cycleId, setFilter, clear }`.
- Wraps `CalibrationPage`. All widgets read from context, no prop drilling.

### Step 4.3 — Widget registry scaffolding

**New files**:
- `frontend/src/components/calibration/widgets/types.ts` — `WidgetId`, `WidgetDef`, `WidgetProps`.
- `frontend/src/components/calibration/widgets/registry.ts` — `WIDGET_REGISTRY` map. Each entry uses `React.lazy()`.
- `frontend/src/components/calibration/useWidgetVisibility.ts` — localStorage-backed `Set<WidgetId>`. Key: `team-resourcer:calibration:visibleWidgets:v1`.
- `frontend/src/components/calibration/WidgetToggleMenu.tsx` — Radix Popover with checkboxes grouped by `category`.

### Step 4.4 — Widget #1: NineBoxGrid

**New file**: `frontend/src/components/calibration/widgets/NineBoxGrid.tsx`
- Pure CSS Grid: `grid-cols-3 grid-rows-3`.
- Each cell: header (box number + label), member chip area.
- Heatmap overlay: cell background opacity ∝ member count vs max. Gradient `bg-emerald-500/10 → /40`.
- Member chips: avatar + last name initial. Click → opens `MemberDetailSheet`.
- Hover: Radix Tooltip with full name + verbatim flag chips.
- Cell expand-on-click when chip count exceeds visible cap (~12).

### Step 4.5 — Widget #2: MarginalBars

**New file**: `frontend/src/components/calibration/widgets/MarginalBars.tsx`
- Top edge: 3 bars showing column totals (performance distribution, derived from `box`).
- Right edge: 3 bars showing row totals (potential distribution).
- Visx `@visx/scale` + `@visx/shape` `Bar`.

### Step 4.6 — Widget #5 (behavior layer): FilterTransitions

**New file**: `frontend/src/components/calibration/FilterTransitions.tsx`
- `<motion.div layout layoutId={memberUuid}>` wrapper for chips.
- On filter change, framer-motion animates chips between cells.
- Always-on; not a registry entry. Wraps chips inside #1, #4, #6.

### Step 4.7 — Widget #8: KpiStrip

**New file**: `frontend/src/components/calibration/widgets/KpiStrip.tsx`
- 6 tiles (more than the original 4 — the new fields enable richer KPIs):
  1. % in top 3 boxes
  2. % in bottom row
  3. Calibration coverage (members with ≥1 calibration / total)
  4. **% Ready for promotion** (counts "Yes"/"Ready" verbatim values)
  5. **% flagged High Growth or Key Talent** (any non-empty / non-"No" value)
  6. **% with mentor capacity** (counts "Yes")
- Pure Tailwind cards. No charts.

### Step 4.8 — CalibrationPage

**New file**: `frontend/src/pages/CalibrationPage.tsx`
- Wraps everything in `CalibrationFilterContext.Provider`.
- Top bar: filter chips + cycle picker + `WidgetToggleMenu`.
- Layout (12 cols):
  ```
  [ KpiStrip                                                full width ]
  [ NineBoxGrid + MarginalBars (composed)        8 cols ] [ Filters 4 ]
  [ <Phase 5 widgets>                                       full width ]
  ```
- Data fetching: inspect visible widget set; only call queries whose `dataSource` is needed.
- Each widget rendered inside `<Suspense fallback={<WidgetSkeleton />}>`.

**Modify** `frontend/src/App.tsx`: `<Route path="/calibration" element={<CalibrationPage />} />`.
**Modify** `frontend/src/components/layout/AppLayout.tsx`: add `{ label: 'Calibration', icon: Grid3x3, path: '/calibration' }`.

### Phase 4 Validation
- `/calibration` renders with seeded data.
- KPI tiles show numbers including the new flag-based metrics.
- Filter changes animate chips.
- Toggling widgets off prevents their queries from firing (DevTools).

---

## Phase 5 — Remaining Widgets

### Step 5.1 — Install remaining Visx
```bash
cd frontend && npm install @visx/sankey @visx/hierarchy
```

### Step 5.2 — Widget #3: MovementSankey
**New file**: `frontend/src/components/calibration/widgets/MovementSankey.tsx`
- Cycle picker: from / to.
- `useCalibrationMovement(from, to)`.
- `@visx/sankey` 9 source → 9 target nodes.
- Hover-to-highlight, dim non-hovered ribbons.
- "Show only material moves (≥N)" slider.
- Empty state: "Need at least 2 calibration cycles to show movement."

### Step 5.3 — Widget #4: CohortSmallMultiples
**New file**: `frontend/src/components/calibration/widgets/CohortSmallMultiples.tsx`
- Cohort selector: by area / team / program.
- Up to **12** mini-9-boxes (hard cap, shown in widget header).
- Extracts shared `<MiniNineBox>` from `NineBoxGrid` during this step.

### Step 5.4 — Widget #6: TrajectoryPath
**New file**: `frontend/src/components/calibration/widgets/TrajectoryPath.tsx`
- Props: `memberUuid`. Calls `useCalibrationHistory(uuid)`.
- Mini 9-box with connected dots in chronological order.
- SVG `path` with `marker-end` arrow.
- Two render contexts: `'detail-sheet'` (compact) and `'page'` (full size in growth timeline).
- Empty state: "First calibration coming soon".

**Modify** `MemberDetailSheet.tsx`: replace placeholder with real widget.
**Modify** `MemberCalibrationTimelinePage.tsx`: render full-size widget plus list of cycles with rationale and movement deltas.

### Step 5.5 — Widget #7: ComparisonRadar + CompareDrawer

**New file**: `frontend/src/components/calibration/widgets/ComparisonRadar.tsx`
- Hand-rolled with `@visx/group` + polar math.
- Axes: box position, # cycles tracked, net movement, ready-for-promotion (binary), mentor capacity (binary).
- One semi-transparent polygon per member.

**New file**: `frontend/src/components/calibration/CompareDrawer.tsx`
- Slide-in side panel triggered from `CalibrationPage` "Compare" button.
- Member multi-select (max 4).
- Renders `ComparisonRadar` + side-by-side cards with each member's latest calibration including rationale snippet.

### Step 5.6 — Widget #9: CycleTrendLines
**New file**: `frontend/src/components/calibration/widgets/CycleTrendLines.tsx`
- `useCalibrationTrends(cycles=8)`.
- 9 lines (one per box) over time.
- Toggle: absolute counts ↔ % of population.
- Visx `LinePath` + axes.
- Empty state: "Need at least 2 cycles to show trends."

### Phase 5 Validation
- All 9 widgets toggleable.
- Sankey renders with 2+ seeded cycles.
- Compare drawer with 2+ members → polygons differ.
- Member sheet trajectory shows path through cycles.
- Bundle delta ≈ 75kb gz.

---

## Phase 6 — Import Wizard Frontend + Polish

### Step 6.1 — Wizard wiring with constant-value support

**Modify** `frontend/src/components/import/MapColumnsStep.tsx`:
```ts
export const CALIBRATION_TARGET_FIELDS = [
  { key: 'first_name',                  label: 'First Name',                required: true,  source: 'column' },
  { key: 'last_name',                   label: 'Last Name',                 required: true,  source: 'column' },
  { key: 'cycle_label',                 label: 'Cycle Label',               required: true,  source: 'constant' },
  { key: 'box',                         label: '9-Box Matrix Value',        required: true,  source: 'column' },
  { key: 'effective_date',              label: 'Effective Date',            required: true,  source: 'column-or-constant' },
  { key: 'reviewers',                   label: 'Calibration Reviewers',     required: false, source: 'column' },
  { key: 'high_growth_or_key_talent',   label: 'High Growth or Key Talent', required: false, source: 'column' },
  { key: 'ready_for_promotion',         label: 'Ready for Promotion?',      required: false, source: 'column' },
  { key: 'can_mentor_juniors',          label: 'Can Mentor Juniors?',       required: false, source: 'column' },
  { key: 'next_move_recommendation',    label: 'Next Move Recommendation',  required: false, source: 'column' },
  { key: 'rationale',                   label: 'Rationale',                 required: false, source: 'column' },
];
```

**New affordance**: `MapColumnsStep` must support a "constant value" mapping for fields where the source CSV doesn't have a column (Cycle Label, possibly Effective Date). This is a small but real wizard enhancement — render an inline text input next to the field instead of a column dropdown when `source: 'constant'`. The constant value is sent as `{ field: 'cycle_label', constant: 'Q1 2026' }` in the mapping payload.

**Modify** `backend/app/services/import_mapper.py` to honor constant mappings (apply the constant to every row before validation).

**Modify** `frontend/src/components/import/ImportWizard.tsx`: add `calibration` entry to `ENTITY_CONFIGS` referencing `CALIBRATION_TARGET_FIELDS`.

### Step 6.2 — Result step + ambiguity-resolve UI

**Modify** the import `ResultStep` to render new buckets:
- "Calibrations created: N"
- "Calibrations updated: N"
- "Cycles auto-created: N" (with labels)
- "Unmatched members: N" (with row numbers + names)
- "Ambiguous matches: N" → renders inline **resolve table**

**Resolve table**:
| Row | Name from CSV | Candidate members (radio) | Skip |
|---|---|---|---|
| 14 | Alex Chen | ◯ Alex Chen — Engineering / Platform / Hired 2022 ◯ Alex Chen — Sales / EMEA / Hired 2024 | ◯ |
| 27 | Jordan Lee | ◯ Jordan Lee — Design / Hired 2021 ◯ Jordan Lee — Marketing / Hired 2023 | ◯ |

- For each ambiguous row, the user picks a candidate or "skip".
- Candidate display includes area, team, hire date — enough context for a human to disambiguate.
- "Resolve ambiguous matches" button calls `POST /api/calibrations/resolve-ambiguous` with the user's selections (skipped rows excluded).
- On success, the table updates to "✓ Resolved" and the running tally increments.

This is the hardest UI in the feature — budget time accordingly.

### Step 6.3 — Empty states audit

| Widget | Empty trigger | Message |
|---|---|---|
| NineBoxGrid | 0 calibrations | "Import calibration data to populate the matrix" |
| MarginalBars | 0 calibrations | hidden |
| MovementSankey | <2 cycles | "Need at least 2 cycles to show movement" |
| CohortSmallMultiples | 0 cohorts in filter | "Select a cohort dimension" |
| TrajectoryPath | 0 history | "First calibration coming soon" |
| ComparisonRadar | <2 members selected | "Select 2–4 members to compare" |
| KpiStrip | 0 calibrations | shows zeros, not hidden |
| CycleTrendLines | <2 cycles | "Need at least 2 cycles to show trends" |

### Step 6.4 — Cache invalidation audit

Verify every mutation calls `invalidateAllCalibrationViews(qc)`:
- `createCalibration`, `updateCalibration`, `deleteCalibration`
- Import commit success
- Resolve-ambiguous success

### Step 6.5 — Documentation

**Update** `.context/features/FEATURES.md`: row 057 → `IMPLEMENTED`.

**Add** `.context/decisions/ADR-NNN-calibration-widget-registry.md`:
- Decisions: store-box-not-axes; widget registry pattern; Visx + framer-motion; localStorage visibility; verbatim text for flag fields; manual ambiguity resolve.
- Rationale for each.

**Append** `.context/knowledge/LEARNINGS.md` if non-obvious things surface (Visx Sankey quirks, CSV constant-value mapping, etc.).

### Phase 6 Validation
```bash
make test
cd frontend && npx vitest run
make lint && make typecheck
cd frontend && npm run build
```
End-to-end smoke:
1. Import a CSV with 3 cycles × 50 members, including 2 ambiguous names.
2. Wizard maps columns, enters cycle label as constant, previews, commits.
3. Result step shows ambiguous matches → user resolves both → tally updates.
4. Open `/calibration` → all widgets render, KPI tiles include flag-based metrics.
5. Toggle widgets, change filters, open compare drawer.
6. Open a member detail → calibration section → "View full timeline" → see history with rationale narrative.

---

## Critical Files (Reference)

### Backend (existing — to study before modifying)
- `backend/app/models/team_member.py` — relationship pattern
- `backend/app/models/member_history.py` — child entity analog
- `backend/app/services/history_service.py` — service template
- `backend/app/services/member_service.py:90` — eager-load chain
- `backend/app/services/import_commit.py:28-96` — race-safe `_get_or_create_*` pattern
- `backend/app/services/import_commit_members.py:176` — `_commit_financial_history` template
- `backend/app/services/import_mapper.py:94` — `ENTITY_CONFIGS`
- `backend/app/schemas/team_member.py:113` — `TeamMemberDetailResponse`
- `backend/app/api/routes/history.py` — sub-resource router template
- `backend/app/main.py:61-72` — router registration
- `backend/alembic/versions/55b198d5e2a6_add_functional_manager_id.py` — migration style

### Frontend (existing — to study before modifying)
- `frontend/src/components/members/MemberDetailSheet.tsx` — section composition
- `frontend/src/hooks/useMembers.ts:5-9` — query keys pattern
- `frontend/src/components/import/ImportWizard.tsx:27` — `ENTITY_CONFIGS`
- `frontend/src/components/import/MapColumnsStep.tsx:14-77` — target fields pattern
- `frontend/src/api/importApi.ts` — `EntityType` literal mirror
- `frontend/src/App.tsx:15-28` — route registration
- `frontend/src/components/layout/AppLayout.tsx:5-11` — sidebar nav

---

## Risks

| Risk | Mitigation | Phase |
|---|---|---|
| #4 MissingGreenlet | `selectinload(TeamMember.calibrations).selectinload(Calibration.cycle)` in `get_member`. Calibrations only on detail schema. | 1 |
| #6/#7 stale TanStack cache | `invalidateAllCalibrationViews()` helper used in every mutation `onSuccess`. | 3, 6 |
| #15 mapped-but-empty replace | Upsert semantics on `(member_uuid, cycle_id)` — empty fields = no-op, never wipe. | 2 |
| #17 get_or_create race | `get_or_create_cycle` mirrors `import_commit.py:28-96` pattern with `IntegrityError` retry. | 1 |
| **Name collisions (HIGH — no employee_id)** | Manual-resolve UI in Result step; `scalars().all()` + ambiguity bucket; never `scalar_one_or_none()`. | 2, 6 |
| Schema invariant drift | Store `box`, compute axes/label in Pydantic. CHECK constraint guards range. | 1 |
| Empty-state proliferation | Phase 6 explicit audit table. | 6 |
| Filter coupling | Single `CalibrationFilterContext`; no prop drilling. | 4 |
| Sankey legibility | Hover-highlight + material-moves slider. | 5 |
| Small-multiples scale | Hard cap at 12 cohorts, documented in widget header. | 5 |
| Cycle-label drift | `.strip()` on input, unique constraint. Do not lowercase. | 1, 2 |
| **CSV has no cycle column** | Wizard's MapColumnsStep gains a "constant value" affordance for `cycle_label`. Backend mapper applies constants per row before validation. | 6 |
| Visx Sankey API friction | Fallback: hand-roll ribbons with `@visx/shape` Curve paths if `@visx/sankey` resists. ~1 day cost. | 5 |
| RBAC gap | Out of scope for v1. Flag in ADR. | — |

---

## Verification (end-to-end)

```bash
make test                                        # backend full suite
cd frontend && npx vitest run                    # frontend full suite
make lint && make typecheck                      # zero errors
cd frontend && npm run build                     # bundle delta ~75kb gz
make reset-db && make up                         # clean migration apply
```

Manual smoke test in Phase 6 Validation above (steps 1–6).

---

## Open Questions (carry-forward, non-blocking)
1. Filter dimensions on visualization page. *Default*: area, team, program, manager, cycle.
2. RBAC. *Default*: visible to all authenticated users; ADR captures the decision to defer.
3. Should "Calibration Reviewers" eventually become a join to `team_members`? *Default for v1*: free text. Revisit when reviewer-centric reporting is requested.

---

## Next
After approval: `/implement .context/features/057-member-calibration/PRP.md`
(run `/clear` first if context > 50%)
