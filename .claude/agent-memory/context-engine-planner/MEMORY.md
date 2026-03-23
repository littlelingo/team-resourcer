# Agent Memory Index

## Project
- [`project_greenfield.md`](project_greenfield.md) — team-resourcer is greenfield as of 2026-03-22; no source files exist yet
- [`project_phase_plan.md`](project_phase_plan.md) — Four-phase plan; Phase 3 PRP written 2026-03-22; tree library decided: @xyflow/react v12 + @dagrejs/dagre

## Feedback
- [`feedback_shadcn_cli.md`](feedback_shadcn_cli.md) — Install shadcn/ui dependencies manually, not via CLI, to avoid interactive prompt issues
- [`feedback_prp_style.md`](feedback_prp_style.md) — PRP format: frontmatter + sections, exact file paths + commands + prop interfaces required, include version-specific API gotchas in Risks

## Planning Patterns
- [`planning_alembic_async.md`](planning_alembic_async.md) — Alembic needs psycopg2 URL even when app uses asyncpg; always add psycopg2-binary to requirements
- [`planning_circular_fk.md`](planning_circular_fk.md) — Team.lead_id ↔ TeamMember circular FK risk; use string-based relationship() refs and use_alter=True on the FK

## Planner — User & Project Context
- [`project_state.md`](project_state.md) — No application code exists yet (2026-03-22); design-first workflow; PRPs written before scaffolding
- [`user_profile.md`](user_profile.md) — Senior technical fluency; implement-then-test is project default (CLAUDE.md); do not propose TDD
