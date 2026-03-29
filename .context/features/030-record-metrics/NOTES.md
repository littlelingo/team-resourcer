# Research Notes: 030 — Record Metrics for Completed Features

## Summary

The project has a metrics framework in `.context/metrics/` but no per-feature METRICS.md files exist
anywhere in the codebase. The `.claude/instructions/CAPTURE-FORMAT.md` file referenced in the task
does not exist — the `.claude/instructions/` directory itself does not exist.

---

## 1. Metrics Format / Template

### No CAPTURE-FORMAT.md exists

`.claude/instructions/CAPTURE-FORMAT.md` was not found. The `.claude/instructions/` directory
does not exist in the project.

### What the metrics framework does define

`.context/metrics/HEALTH.md` defines the aggregate framework health table with these columns for
the **Feature Velocity** section:

| # | Name | Plan Date | Validate Date | Elapsed | Steps | Sessions | Clears |
|---|------|-----------|---------------|---------|-------|----------|--------|

The companion file `.context/metrics/RECOMMENDATIONS.md` maps signals to thresholds:

| Signal | Threshold | Recommendation |
|--------|-----------|----------------|
| Feature elapsed > 3 sessions | 3+ sessions | Break into smaller PRPs |
| Error hit rate < 30% | < 30% over 5 features | Review error index for stale entries |
| Knowledge growth = 0 for 3+ features | 0 entries | Check if learnings are being captured |
| Clears per feature > 3 | 3+ clears | Context budget too small or PRP too large |
| Rollbacks > 1 per feature | 2+ rollbacks | PRP planning needs improvement |

### Per-feature METRICS.md format — inferred from HEALTH.md columns

No template file exists. Based on the HEALTH.md columns, a per-feature METRICS.md would need to
capture:

- **Plan Date** — date PRP was approved
- **Validate Date** — date implementation was reviewed/closed
- **Elapsed** — derived (Validate - Plan)
- **Steps** — number of PRP steps executed
- **Sessions** — number of agent conversations to complete
- **Clears** — number of context window clears during implementation

Additional fields implied by the Knowledge Growth and Agent Effectiveness tables in HEALTH.md:
- **Learnings added** — count of entries added to `.context/knowledge/LEARNINGS.md`
- **Errors hit** — count of known errors consulted from `.context/errors/INDEX.md`
- **Novel errors** — count of new errors discovered and indexed

---

## 2. METRICS.md Files — Current State

**Zero METRICS.md files exist** in any feature directory. The glob
`.context/features/*/METRICS.md` returns no results.

---

## 3. Features Marked COMPLETE Without METRICS.md

All COMPLETE features are missing METRICS.md files. From `.context/features/FEATURES.md`:

| # | Feature Name | Directory |
|---|-------------|-----------|
| 001 | Phase 1 — Scaffold + Data Model + API | `.context/features/001-team-resourcer-app/` |
| 001 | Phase 2 — Card View + Table View | `.context/features/001-team-resourcer-app/` |
| 001 | Phase 3 — Interactive Tree Views | `.context/features/001-team-resourcer-app/` |
| 001 | Phase 4 — Data Import | `.context/features/001-team-resourcer-app/` |
| 002 | Test Coverage — Backend | `.context/features/002-test-coverage/` |
| 004 | Adapt — Security | `.context/features/004-adapt-security/` |
| 005 | Adapt — Code Quality | `.context/features/005-adapt-quality/` |
| 006 | Adapt — Structure | `.context/features/006-adapt-structure/` |
| 007 | Adapt — DevOps | `.context/features/007-adapt-devops/` |
| 008 | Adapt — Documentation | `.context/features/008-adapt-docs/` |
| 009 | Dev Workflow | `.context/features/009-dev-workflow/` |
| 010 | Adapt — Code Quality (Round 2) | `.context/features/010-adapt-quality-2/` |
| 011 | Adapt — DevOps (Round 2) | `.context/features/011-adapt-devops-2/` |
| 012 | Adapt — Security (Round 2) | `.context/features/012-adapt-security-2/` |
| 013 | Per-Section Entity Import | `.context/features/013-entity-import/` |
| 017 | Program Agency Entity | `.context/features/017-program-agency/` |
| 018 | Member Name Split + Hire Date | `.context/features/018-member-name-split/` |
| 019 | Member Form Layout Adjustment | `.context/features/019-member-form-layout/` |
| 020 | Member Location Split (city + state) | `.context/features/020-member-location-split/` |
| 021 | Financial History Import | `.context/features/021-financial-history-import/` |
| 022 | Remove Main Import Nav Item | `.context/features/022-remove-main-import-button/` |
| 023 | Program Import Agency Support | `.context/features/023-program-import-agency/` |
| 024 | Import Date Format Detection | `.context/features/024-import-date-format/` |
| 025 | Makefile Port Cleanup | `.context/features/025-makefile-port-cleanup/` |
| 026 | CORS Fix | `.context/features/026-cors-fix/` |
| 027 | Import Amount Parsing | `.context/features/027-import-amount-parsing/` |
| 028 | History Currency Display | `.context/features/028-history-currency-display/` |
| 029 | Functional Manager + Direct Report Rename | `.context/features/029-functional-manager/` |

**Total: 28 COMPLETE features, all missing METRICS.md.**

---

## 4. Non-COMPLETE Features (excluded from metrics backfill)

| # | Feature Name | Status |
|---|-------------|--------|
| 002 | Test Coverage — Frontend | DRAFT |
| 016 | Bug: Select.Item empty value | APPROVED |

---

## 5. Gaps and Open Questions

1. **No CAPTURE-FORMAT.md template exists.** The METRICS.md format must be defined before
   backfilling. The HEALTH.md columns provide the minimum required fields. A template should
   be created at `.claude/instructions/CAPTURE-FORMAT.md` before implementing this feature.

2. **HEALTH.md is currently empty.** All Feature Velocity, Knowledge Growth, Agent Effectiveness,
   and Context Efficiency rows are blank. The METRICS.md files, once created, should feed into
   aggregate updates to HEALTH.md.

3. **001 has four phases sharing one directory.** A single
   `.context/features/001-team-resourcer-app/METRICS.md` would need to track all four phases,
   or four separate files (e.g., `METRICS-phase1.md`) would be needed. The HEALTH.md table
   treats each phase as a separate row.

4. **Historical data availability.** Plan/Validate dates, session counts, and clear counts are
   not derivable from current file contents — they would require git log analysis or agent memory
   inspection. Sessions and clears in particular are not recorded anywhere in the current state.
   Git commit timestamps can approximate Plan Date (PRP committed) and Validate Date (review
   committed), but this is an estimate.
