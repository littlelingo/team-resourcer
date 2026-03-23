---
name: user_profile
description: User role and preferences observed during Phase 4 PRP planning session
type: user
---

User is driving a full-stack greenfield project (React + FastAPI + PostgreSQL) and is comfortable specifying detailed scope in natural language. They provide explicit API contracts, package choices, and UX flow descriptions when requesting a PRP, indicating senior technical fluency.

They use a design-first workflow: PRPs are written before any code is scaffolded. The `.context/` directory is the source of truth for architecture decisions.

Testing strategy is `implement-then-test` across the whole project (declared in CLAUDE.md). Do not propose TDD or test-first ordering unless the user overrides this per-PRP.
