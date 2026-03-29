# team-resourcer

Full-stack team resource management app (FastAPI + React/Vite + PostgreSQL).

## Project Knowledge

| Document | Path |
|----------|------|
| Architecture | `.context/architecture/OVERVIEW.md` |
| Tech Stack & Commands | `.context/architecture/TECH_STACK.md` |
| Directory Map | `.context/architecture/DIRECTORY_MAP.md` |
| Code Patterns | `.context/patterns/CODE_PATTERNS.md` |
| Anti-Patterns | `.context/patterns/ANTI_PATTERNS.md` |
| Error Index | `.context/errors/INDEX.md` |
| Learnings | `.context/knowledge/LEARNINGS.md` |
| Feature Index | `.context/features/FEATURES.md` |

## Testing Strategy

**Default**: implement-then-test — Write code first, then add tests.

## Key Commands

| Action | Command |
|--------|---------|
| Start all | `make up` |
| Test (backend) | `make test` |
| Test (frontend) | `cd frontend && npx vitest run` |
| Lint | `make lint` |
| Type-check | `make typecheck` |
| Reset DB | `make reset-db` |

## Code Standards

- **Backend**: ruff (lint + format), mypy (type-check), line-length 100, target py312
- **Frontend**: ESLint, TypeScript strict, Tailwind CSS
- **API**: RESTful, 201 for creates, 204 for deletes, service layer does all DB work
- **State**: TanStack Query v5 for server state, React Hook Form + Zod for forms
- **Imports**: PUT for updates (not PATCH), use exported query key constants

## Context Engine

This project uses the Context Engine plugin. See `.context/` for architecture docs, patterns, and learnings.
