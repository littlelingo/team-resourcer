---
name: project_057_calibration_review
description: 057-member-calibration (9-box matrix, cycles, import, widgets): key findings from review on 2026-04-08
type: project
---

Feature 057 (Member Calibration) reviewed 2026-04-08 against commit range dc75412..HEAD.

**Why:** ~5900 lines added; high-risk feature with sensitive performance data and complex import pipeline.

**Verdict:** APPROVE with documented warnings — no critical showstoppers, but two structural bugs need follow-up.

Key findings:
- ORM/DB semantic mismatch: CalibrationCycle.calibrations has `cascade="all, delete-orphan"` but cycle FK is `ondelete=RESTRICT`. No delete route exists so not currently exploitable, but should be corrected before a delete endpoint is added.
- `_upsert_calibration_row` IntegrityError branch calls `db.rollback()` which rolls back the entire transaction, potentially wiping previously committed rows in the same batch. The shared-session import pattern is fragile here.
- `filter-transitions` widget is registered and toggleable but its exported default renders `null` — the actual `FilterTransition` wrapper is never used by any other widget. Dead registry entry.
- BOX_LABELS and BOX_TO_AXES duplicated as local constants in NineBoxGrid.tsx, MovementSankey.tsx, and MarginalBars.tsx instead of imported from a shared module.
- MarginalBars empty state returns `null` (invisible) instead of a bordered placeholder like other widgets.
- CohortSmallMultiples always shows a single "All Members" group — cohort grouping by area/team is stubbed out (labeled in a comment). Misleading widget name at this state.
- ComparisonRadar and TrajectoryPath not rendered from CalibrationPage (only in CompareDrawer and timeline page). The registry entry for 'trajectory-path' exists but CalibrationPage does not mount it. Intentional per design but worth documenting.

**How to apply:** Flag cascade/rollback issues when cycle-delete endpoint is added. Track CohortSmallMultiples stub for follow-up.
