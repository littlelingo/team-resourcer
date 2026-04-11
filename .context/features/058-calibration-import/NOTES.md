# Feature 058 — Calibration Import Research Notes

Research date: 2026-04-10

---

## Section 1 — Existing Import Patterns

### End-to-End Flow (all entity types)

1. **Source step** — user uploads a CSV or provides a Google Sheets URL.
   - `POST /api/import/upload` (multipart) → `import_parser.py` → raw rows stored in `import_session.py`
   - Response: `{ session_id, headers, preview_rows[:10], total_row_count }`
2. **Map step** — user maps CSV headers to target fields.
   - Frontend: `MapColumnsStep.tsx` shows a header→field select table. Auto-suggests by label/value fuzzy match.
   - For calibration specifically: `cycle_label` is a `source: 'constant'` field (a text input above the table, not a CSV column). `effective_date` is `source: 'column-or-constant'` (can be either).
   - Clicking "Preview" calls `POST /api/import/preview` with a `MappingConfig` body.
3. **Preview step** — `PreviewStep.tsx` shows up to 50 rows color-coded green/red by validity.
   - On "Commit": `POST /api/import/commit` with the same `MappingConfig`.
   - On success, invalidates relevant query keys. For calibration: calls `invalidateAllCalibrationViews(queryClient)`.
4. **Result step** — `ResultStep.tsx` shows summary cards (created/updated/skipped).
   - For calibration: shows `created_calibrations`, `updated_calibrations`, `created_cycles`, plus dedicated **Ambiguous Matches** table and **Unmatched Rows** accordion.
   - Ambiguous resolution: user picks from radio buttons → `POST /api/calibrations/resolve-ambiguous`.

### Key Backend Services

| File | Role |
|---|---|
| `backend/app/services/import_parser.py` | CSV/XLSX → `ParseResult(raw_rows, headers, preview_rows, total_row_count)` |
| `backend/app/services/import_session.py` | In-memory session store, 30-min TTL, background cleanup every 5 min |
| `backend/app/services/import_mapper.py` | `apply_mapping()`: validates, deduplicates, runs entity-specific validators. All entity configs in `ENTITY_CONFIGS` dict (line 141). |
| `backend/app/services/import_commit.py` | `commit_import()`: dispatches to entity-specific `_commit_*` functions (lines 316–355). `calibration` branch at line 332. |
| `backend/app/services/import_commit_calibrations.py` | `_commit_calibrations()`, `_upsert_calibration_row()`, `apply_calibration_resolutions()` |
| `backend/app/services/import_commit_members.py` | `_commit_members()`, `_commit_financial_history()` — template for history import |

### Key Frontend Components

| File | Role |
|---|---|
| `frontend/src/components/import/ImportWizard.tsx` | 4-step state machine: `source → map → preview → result`. Accepts `entityType` prop. `ENTITY_CONFIGS` map at lines 28–50. |
| `frontend/src/components/import/SourceStep.tsx` | File drag-drop + Google Sheets URL input |
| `frontend/src/components/import/MapColumnsStep.tsx` | Column mapping table + constant-value inputs. All `*_TARGET_FIELDS` arrays defined here. `CALIBRATION_TARGET_FIELDS` at lines 85–97. |
| `frontend/src/components/import/PreviewStep.tsx` | Paginated preview table, Commit button. Calibration invalidation at line 103. |
| `frontend/src/components/import/ResultStep.tsx` | Import summary. Calibration-specific UI at lines 219–309: ambiguous-resolve table (`AmbiguousResolveTable` component, lines 23–184), unmatched-rows accordion. |
| `frontend/src/api/importApi.ts` | `EntityType` literal union (includes `'calibration'`). `CommitResult` includes calibration-specific optional fields (lines 52–68). |

### How Other Pages Trigger Import

- **MembersPage**: `importEntityType` state variable (line 47). An `Upload` dropdown opens a `Dialog` with `<ImportWizard entityType={importEntityType} />`. Dropdown items include `member`, `salary_history`, `bonus_history`, `pto_history`.
- **AgenciesPage / TeamsPage / FunctionalAreasPage / ProgramsPage**: Each renders `<ImportWizard entityType="<their type>" />` inside a sheet or dialog.
- **CalibrationPage**: Currently has **no import button or dialog** — the import entry point for calibrations does not exist yet on the CalibrationPage itself.

---

## Section 2 — Current Calibration Tab

### Frontend Entry Point

- Route: `/calibration` → `frontend/src/pages/CalibrationPage.tsx`
- Page structure:
  - `CalibrationFilterProvider` context wraps the page
  - Header row: `CyclePicker` select (all cycles or specific), `WidgetToggleMenu`, Compare button
  - `CompareDrawer` (compare up to 4 members side-by-side)
  - Widget layout (all lazy-loaded via `WIDGET_REGISTRY`):
    - `KpiStrip` — full width
    - `NineBoxGrid` (8 cols) + `MarginalBars` (4 cols)
    - `MovementSankey` — full width
    - `CohortSmallMultiples` — full width
    - `CycleTrendLines` — full width

### Calibration Data Model

**`calibrations` table** — `backend/app/models/calibration.py`
- `id` (int PK), `member_uuid` (UUID FK → team_members.uuid, CASCADE), `cycle_id` (int FK → calibration_cycles.id, RESTRICT)
- `box` (SmallInteger, CHECK 1–9) — the single stored axis value
- Text columns: `reviewers`, `high_growth_or_key_talent`, `ready_for_promotion`, `can_mentor_juniors`, `next_move_recommendation`, `rationale`
- `effective_date` (Date), `created_at`, `updated_at`
- Constraints: `UNIQUE(member_uuid, cycle_id)`, `INDEX(member_uuid, effective_date)`, `INDEX(cycle_id)`, `INDEX(box)`

**`calibration_cycles` table** — `backend/app/models/calibration_cycle.py`
- `id`, `label` (varchar 50, UNIQUE), `sequence_number`, `start_date`, `end_date`, `is_active`, `notes`, `created_at`
- Relationship: `calibrations` uses `cascade="save-update, merge"` + `passive_deletes=True` (ON DELETE RESTRICT enforced by DB)

### Schemas

`backend/app/schemas/calibration.py`:
- `BOX_LABELS` dict (lines 16–29): maps box 1–9 → label strings (e.g. `5 → "Key Performer"`). These **must** match the CSV vocabulary (CSV values like `"5 - Key Performer"` are valid and normalized by `validate_box_value()`).
- `BOX_TO_AXES` dict (lines 33–43): maps box → (performance, potential)
- `CalibrationResponse` (line 69): includes computed fields `label`, `performance`, `potential` via `@computed_field`. The `cycle` field is a nested `CalibrationCycleResponse` (eager-loaded).
- `CalibrationCreate`, `CalibrationUpdate` — used by manual entry routes

### API Endpoints

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/api/calibrations/latest` | `calibrations.py:get_latest_calibrations` | Latest per member, filterable by area/team/program/cycle |
| GET | `/api/calibrations/movement?from=X&to=Y` | `calibrations.py:get_movement` | Sankey data between two cycles |
| GET | `/api/calibrations/trends?cycles=N` | `calibrations.py:get_trends` | Box counts per cycle (last N cycles) |
| POST | `/api/calibrations/resolve-ambiguous` | `calibrations.py:resolve_ambiguous` | Post-import ambiguity resolution |
| GET | `/api/calibration-cycles/` | `calibration_cycles.py:list_cycles_route` | All cycles sorted by sequence_number |
| POST | `/api/calibration-cycles/` | `calibration_cycles.py:create_cycle_route` | Create a new cycle |
| GET | `/api/members/{uuid}/calibrations` | (members routes) | Full history for one member |
| POST | `/api/members/{uuid}/calibrations` | (members routes) | Manual calibration entry |
| PUT/DELETE | `/api/members/{uuid}/calibrations/{id}` | (members routes) | Update/delete one calibration |

---

## Section 3 — Backend Calibration Import (Already Implemented)

**The backend calibration import is fully implemented.** All components exist:

### `import_commit_calibrations.py` — Full Calibration Import Service

`_commit_calibrations(db, rows)` — Lines 19–120:
- Iterates valid mapped rows
- Extracts `first_name`, `last_name`, `cycle_label` from row data
- Resolves/creates cycle via `get_or_create_cycle(db, label)` — race-safe savepoint pattern
- Member lookup: `select(TeamMember).where(first_name == X, last_name == Y)` → `scalars().all()`
  - 0 results → appended to `unmatched_rows`
  - 2+ results → appended to `ambiguous_rows` (with candidate list including area/team/hire_date for display)
  - 1 result → calls `_upsert_calibration_row(db, member_uuid, cycle_id, data)`
- Returns summary dict with `created_calibrations`, `updated_calibrations`, `created_cycles`, `unmatched_rows`, `ambiguous_rows`

`_upsert_calibration_row(db, member_uuid, cycle_id, data)` — Lines 123–200:
- Parses `box` as int (accepts "5 - Key Performer" format via earlier validator)
- Parses `effective_date` (ISO format, defaults to today if missing/invalid)
- Checks for existing row on `(member_uuid, cycle_id)` — updates if found
- New row: uses `async with db.begin_nested()` savepoint pattern to handle race on UNIQUE constraint

`apply_calibration_resolutions(db, cycle_id, resolutions)` — Lines 203–230:
- Called by `POST /api/calibrations/resolve-ambiguous`
- Each resolution has `{ member_uuid, row_data }`
- Calls `_upsert_calibration_row()` for each resolved row

### `import_mapper.py` — Calibration Entity Config (Lines 210–228)

```python
"calibration": EntityConfig(
    target_fields={
        "first_name", "last_name", "cycle_label", "box",
        "reviewers", "high_growth_or_key_talent", "ready_for_promotion",
        "can_mentor_juniors", "next_move_recommendation", "rationale",
        "effective_date",
    },
    required_fields={"first_name", "last_name", "cycle_label", "box"},
    numeric_fields=set(),
    dedup_field=None,  # No dedup — same name/cycle can appear legitimately
    validators=[_validate_box, _validate_calibration_effective_date],
)
```

Box validator `_validate_box` (lines 117–127): accepts `"5"`, `"5 - Key Performer"`, `"5-Key Performer"` and normalizes to int string. `validate_box_value()` (lines 94–114) is the pure parsing function (also importable for testing).

### `import_schemas.py` — Extended CommitResult (Lines 68–87)

`CommitResult` has calibration-specific optional fields:
- `created_calibrations: int = 0`
- `updated_calibrations: int = 0`
- `created_cycles: int = 0`
- `unmatched_rows: list[dict] = []`
- `ambiguous_rows: list[dict] = []`

Also defines `ResolveAmbiguousRequest` and `ResolveAmbiguousResult` schemas (lines 81–87).

### `import_commit.py` — Dispatch Branch (Lines 332–355)

The `calibration` branch at line 332 calls `_commit_calibrations`, then handles commit/rollback and session deletion itself (rather than falling through to the generic path), and returns a custom `CommitResult` with all calibration-specific fields populated.

### `calibration_cycle_service.py`

`get_or_create_cycle(db, label)` — race-safe: select → if None, savepoint insert → on IntegrityError re-fetch. Auto-assigns `sequence_number` as `max(existing) + 1`. Returns `(cycle, was_created: bool)`.

---

## Section 4 — Import Flow Architecture (Two-Phase Pattern)

### Phase 1: Preview/Validate

```
SourceStep → POST /api/import/upload → session created (raw_rows stored in memory)
MapColumnsStep → POST /api/import/preview → apply_mapping() reads session, validates, returns MappedPreviewResult
PreviewStep shows results — no DB writes yet
```

### Phase 2: Commit

```
PreviewStep "Commit" → POST /api/import/commit
  → apply_mapping() again (re-validates from session)
  → splits valid / error rows
  → dedup (dedup_field=None for calibration → no dedup)
  → _commit_calibrations() → DB writes
  → db.commit() → delete_session()
  → CommitResult returned to frontend
ResultStep:
  - Shows created/updated/created_cycles/unmatched/ambiguous counts
  - Ambiguous rows: AmbiguousResolveTable → POST /api/calibrations/resolve-ambiguous
  - "View Calibration" link → /calibration
```

### Session Management

- Sessions stored in `_sessions: dict[str, ParseResult]` (in-memory, not persisted across restarts)
- TTL 30 min, background cleanup task every 5 min
- Session deleted after `/commit` regardless of outcome (success or error path)

### Shared Utilities

- `import_date_utils.py` — `parse_date(str)` → `date | None` — handles ISO, MM/DD/YYYY, etc.
- `import_amount_utils.py` — `parse_amount(str)` → `Decimal | None` — strips `$`, commas
- Both are called from `apply_mapping()` via entity validators

---

## What Is Missing: The Import Entry Point on CalibrationPage

**The only gap for feature 058 is the frontend import UI on CalibrationPage.**

The backend is complete. The wizard already supports `entityType="calibration"`. The result step already handles calibration-specific output. What does not exist:

1. **No import button on `CalibrationPage.tsx`** — the page has no `Upload` icon or import dialog.
2. **No dialog/sheet wrapping `<ImportWizard entityType="calibration" />`**.

### Pattern to Follow

`MembersPage.tsx` is the exact template:
- State variable: `const [importEntityType, setImportEntityType] = useState<EntityType | null>(null)` (line 47)
- An `Upload` button in the page header (line 174)
- A `Dialog.Root` controlled by `importEntityType !== null`
- Inside: `<ImportWizard entityType="calibration" />`
- On close: `setImportEntityType(null)` and call `invalidateAllCalibrationViews(queryClient)`

For CalibrationPage, since there is only one import type (`calibration`), no dropdown is needed — a single "Import" button suffices.

### Cache Invalidation

Already wired in `PreviewStep.tsx` (line 103–104):
```ts
} else if (entityType === 'calibration') {
  invalidateAllCalibrationViews(queryClient)
}
```

`invalidateAllCalibrationViews` is defined in `frontend/src/hooks/useCalibrationCycles.ts` and invalidates `calibrationCycleKeys.all`, `calibrationKeys.latest`, `calibrationKeys.movement`, and `calibrationKeys.trends`.

---

## Tests

### Backend

- `backend/tests/integration/test_calibration_import.py` — Integration tests for the import pipeline (commit, ambiguity detection, cycle creation, upsert semantics)
- `backend/tests/integration/test_calibration_routes.py` — Route-level tests for calibration CRUD and analytics

### Frontend

- `frontend/src/components/import/__tests__/MapColumnsStep.test.tsx` — Tests for calibration constant-value support (lines 180–220+), including "Constant Values" section render, cycle label input, effective_date constant.

No dedicated frontend tests exist for `ResultStep` calibration-specific UI (ambiguous resolve table).

---

## Key File Summary

| File | What it does |
|---|---|
| `backend/app/services/import_commit_calibrations.py` | Full commit logic: cycle get-or-create, name-based member lookup, ambiguity detection, savepoint upsert |
| `backend/app/services/import_mapper.py:210` | Calibration `EntityConfig`: target_fields, required_fields, box+date validators |
| `backend/app/services/import_commit.py:332` | Dispatch branch for calibration; custom CommitResult construction |
| `backend/app/schemas/import_schemas.py:9` | `EntityType` Literal including `"calibration"`; extended `CommitResult` with calibration fields |
| `backend/app/api/routes/calibrations.py:56` | `POST /api/calibrations/resolve-ambiguous` — post-import manual resolution |
| `backend/app/api/routes/calibration_cycles.py` | GET/POST for calibration cycles |
| `backend/app/schemas/calibration.py:16` | `BOX_LABELS`, `BOX_TO_AXES`, `CalibrationResponse` with computed `label`/`performance`/`potential` |
| `backend/app/services/calibration_cycle_service.py` | `get_or_create_cycle()` — race-safe savepoint pattern |
| `frontend/src/components/import/ImportWizard.tsx:46` | Calibration config in `ENTITY_CONFIGS` map |
| `frontend/src/components/import/MapColumnsStep.tsx:85` | `CALIBRATION_TARGET_FIELDS` — 11 fields, cycle_label as constant, effective_date as column-or-constant |
| `frontend/src/components/import/ResultStep.tsx:23` | `AmbiguousResolveTable` component; calibration summary cards |
| `frontend/src/components/import/PreviewStep.tsx:103` | Calibration cache invalidation on commit |
| `frontend/src/api/importApi.ts:22` | `EntityType` union including `'calibration'`; extended `CommitResult` type |
| `frontend/src/pages/CalibrationPage.tsx` | **Missing: import button/dialog** — only gap for feature 058 |
| `frontend/src/pages/MembersPage.tsx:47` | Template for import dialog pattern (state + Upload dropdown + Dialog + ImportWizard) |
