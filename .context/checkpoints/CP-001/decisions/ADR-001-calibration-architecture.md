# ADR-001: Member Calibration Architecture

**Status**: Accepted
**Date**: 2026-04-08
**Feature**: 057-member-calibration

## Context

team-resourcer needed a calibration entity (9-box matrix) tied to members, with CSV import, member-level history tracking, and a rich org-level visualization. The feature touches data modeling, an existing import pipeline, and introduces the project's first charting/animation libraries. Several non-obvious choices were made during planning that warrant capturing.

## Decisions

### 1. Store `box` (1–9), compute axes from it
The `Calibration` table stores `box smallint CHECK (box BETWEEN 1 AND 9)` directly. `performance` and `potential` (each 1–3) are **computed fields** in the Pydantic response schema, derived from `box` via a fixed lookup table.

**Why:** The source CSV provides `9-Box Matrix` directly. Storing the box value preserves source fidelity, eliminates a parsing round-trip, and reduces the CHECK constraint to one column. Storing axes and re-deriving box would require lossy parsing of values like `"5 - Key Performer"`.

**Trade-off:** Filtering "all members in the High Performance column" requires either a computed/indexed expression or filtering on a precomputed `box IN (1, 4, 7)` set. Acceptable.

### 2. Widget registry pattern, not hardcoded sections
The 9 visualizations on `/calibration` are each self-contained components registered in `WIDGET_REGISTRY: Record<WidgetId, WidgetDef>`. The page composes them via the registry, not by importing each one directly.

**Why:** Adding a 10th widget = one new file + one registry entry. No page-component edits. Each widget declares its `dataSource`, which lets the page-level fetcher gate queries based on which widgets are visible — toggling Sankey off skips the `/movement` API call entirely.

**Trade-off:** Slight indirection cost when reading the page; one extra file to grok. Worth it given 9 widgets at v1.

### 3. localStorage for widget visibility (not server-side preferences)
User toggle state persists to `localStorage` under `team-resourcer:calibration:visibleWidgets:v1`. No `user_preferences` table.

**Why:** The app has no user prefs infrastructure today. localStorage gets us 95% of the value at 0% of the migration cost. Versioned key (`:v1`) lets us blow away stored state if the widget set changes incompatibly.

**Trade-off:** Multi-device users (laptop + iPad) will see different widget sets. Acceptable for v1; revisit when prefs become a real ask.

### 4. Verbatim text storage for flag-like CSV fields
`high_growth_or_key_talent`, `ready_for_promotion`, `can_mentor_juniors`, and `next_move_recommendation` are stored as `text nullable` — exact CSV cell value, no normalization to bool/enum.

**Why:** Zero data loss. The source CSV's exact value vocabulary is uncertain and may evolve. Strict enums would reject unexpected values at import time and brittle the pipeline. Frontend renders these as colored chips with the verbatim string. Normalization can happen on read later without a migration; the reverse path would require re-importing source data.

**Trade-off:** Aggregating "% ready for promotion" requires a heuristic (counts "Yes" / non-"No" / etc.) rather than a clean boolean COUNT. Worth it.

### 5. Manual ambiguity resolution UI for name collisions
The calibration CSV has no `employee_id`. Member matching uses `(first_name, last_name)` only. Rows that match 2+ members go into an `ambiguous_rows` bucket and surface in the import Result step as a resolve table where the user picks the correct candidate per row, then calls `POST /api/calibrations/resolve-ambiguous` to commit the resolutions.

**Why:** Two paths were considered: (a) hard-error and force CSV editing, (b) silent recency-based resolution. Both fail for different reasons — (a) is friction-heavy, (b) is dangerous (calibration data on the wrong person). The manual-resolve UI is the only path that builds trust in the import pipeline for an org with name collisions.

**Trade-off:** This is the most complex UI in the feature. Significant frontend work in Phase 6.

### 6. New "constant value" mapping affordance in the import wizard
`MapColumnsStep` gains the ability to map a target field to a **constant value** (text input) instead of a CSV column. Used for `cycle_label` (the calibration CSV has no cycle column — the cycle is global to the file).

**Why:** Without this, every calibration import would require pre-processing the CSV to add a cycle column. Adding this as a wizard primitive solves the immediate need cleanly.

**Generality:** This is **not** a calibration-specific feature. Any future import where a metadata value applies to the entire file rather than per-row will benefit. Future devs should not refactor this out as "calibration-only."

### 7. Visx + framer-motion as the chart/animation stack
Visx (modular imports: `@visx/scale`, `@visx/shape`, `@visx/sankey`, etc.) for charting; framer-motion for filter-driven layout transitions. ~75kb gz total.

**Why:** Visx composes like primitives rather than wrapping you in opinionated chart components — important when building 9 distinct visualizations. framer-motion's `layoutId` gives us animated chip transitions across 9-box cells with ~10 lines of code; nothing in vanilla CSS or Tailwind matches this.

**Rejected alternatives:** Recharts (too opinionated for the unusual chart shapes here), Nivo (~120kb, too heavy), ECharts (imperative API doesn't fit React patterns), pure D3 (re-implementing primitives Visx already wraps).

**Sankey fallback:** If `@visx/sankey` resists during Phase 5, hand-roll ribbons with `@visx/shape` Curve paths. ~1 day cost. Documented in PRP risk table.

### 8. Cycles as a first-class entity (`calibration_cycles`)
Calibration cycles ("2026 Q1", "2025 Annual") are not free-text labels on `Calibration` rows — they're a separate `calibration_cycles` table with `label UNIQUE`, auto-assigned `sequence_number`, and optional date range.

**Why:** Free-text labels would drift instantly ("Q1 2026" vs "2026Q1" vs "Q1-26"). The unique constraint prevents this and enables a race-safe `_get_or_create_cycle` helper at import time. The `sequence_number` lets the Sankey and trend-line widgets order cycles deterministically without parsing labels as dates.

## Out of Scope (v1 deferred decisions)

- **RBAC**: calibration data is sensitive but the app has no role-based access today. v1 ships visible to all authenticated users. Revisit when RBAC arrives as its own feature.
- **Reviewer entity**: `Calibration Reviewers` is a free-text field in v1. Promoting it to a join with `team_members` would enable reviewer-centric reporting ("all calibrations Sarah reviewed") but adds matching complexity at import time. Defer until requested.
- **Drag-to-recalibrate "what-if" mode**: would justify pulling in the existing `@xyflow/react` for interactive node manipulation. v1 is read-only.
- **Server-side widget visibility sync**: see decision #3.

## Consequences

- Adding new widgets to the calibration page is a one-file operation.
- The import pipeline gains a generic constant-value mapping primitive that benefits future imports beyond calibration.
- Name collisions become a workflow concern, not a hidden bug — managers explicitly resolve them.
- Bundle weight grows by ~75kb gz (acceptable for an internal app; lazy-loaded widgets keep first-paint clean).
- Member calibration history is queryable and visualizable from day one — no future "we should have stored history" migration.
