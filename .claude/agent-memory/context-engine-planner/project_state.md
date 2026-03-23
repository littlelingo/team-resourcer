---
name: project_state
description: Current scaffolding and phase completion status of team-resourcer
type: project
---

The team-resourcer repo contains no application code as of 2026-03-22. Only planning/context files exist under `.context/` and a CLAUDE.md. Phases 1–3 are planned but not yet implemented (no backend/ or frontend/ directories exist).

**Why:** The project is in design-first mode — PRPs are being written before scaffolding begins.

**How to apply:** When writing PRPs for phases that "depend on" earlier phases, treat those earlier phases as planned-but-not-built. Reference the patterns described in NOTES.md rather than reading live code. Do not assume any files exist under `backend/` or `frontend/` until a future conversation confirms scaffolding happened.
