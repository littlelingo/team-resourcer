---
name: research_entity_import
description: Research findings for adding per-section CSV/Google Sheets import for programs, functional areas, and teams
type: project
---

Research completed 2026-03-25. Findings support adding entity-type-aware import to programs, areas, and teams with moderate backend changes and low frontend changes.

**Key structural insight:** The parser, session, and Google Sheets layers are already 100% entity-agnostic. Member-specific logic is concentrated in import_mapper.py (TARGET_FIELDS + validation) and import_commit.py (entire commit body).

**Why:** The design goal is reuse of the wizard shell and file-sourcing infrastructure.

**How to apply:** Parameterise the mapper and commit by entity type; the router and frontend wizard just need an `entity_type` field threaded through.
