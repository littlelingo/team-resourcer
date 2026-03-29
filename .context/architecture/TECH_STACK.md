# Tech Stack

## Languages
- Python 3.12 (backend)
- TypeScript ~5.9.3 (frontend)

## Backend
- FastAPI 0.115.12
- SQLAlchemy 2.0.36 (async, asyncpg 0.30.0)
- Pydantic 2.10.3 + pydantic-settings 2.6.1
- Alembic 1.14.0
- Pillow 11.2.1 (image validation)
- pandas >=2.2 + openpyxl >=3.1 (import parsing)
- google-api-python-client >=2.120 (Sheets import)

## Frontend
- React ^19.2.4 + React Router DOM ^6.30.3
- Vite ^8.0.1
- TanStack Query ^5.95.0 (server state)
- TanStack Table ^8.21.3 (data tables)
- React Hook Form ^7.72.0 + Zod ^3.25.76 (forms)
- Radix UI (~12 packages: dialog, select, avatar, separator, etc.)
- Tailwind CSS ^3.4.17 + shadcn/ui
- @xyflow/react ^12.10.1 + @dagrejs/dagre ^3.0.0 (org trees)
- sonner ^1.7.4 (toasts)

## Testing
- pytest 8.3.4 + pytest-asyncio 0.24.0 + httpx 0.28.1 (backend)
- aiosqlite >=0.20 (in-memory test DB)
- Vitest ^2.1.0 + @testing-library/react + MSW ^2.7.0 (frontend)

## Linting / Formatting
- ruff 0.8.6 (backend lint + format, target py312, line-length 100)
- mypy 1.13.0 (backend type-check, non-strict)
- ESLint (frontend)

## Infrastructure
- Docker Compose (dev + prod configs)
- PostgreSQL 16.6-alpine
- Make-based task runner

## Commands

| Action | Command |
|--------|---------|
| Start all | `make up` |
| Stop all | `make down` |
| Logs | `make logs` |
| Migrate | `make migrate` |
| New migration | `make migration name="description"` |
| Seed data | `make seed` |
| Test (backend) | `make test` |
| Test (frontend) | `cd frontend && npx vitest run` |
| Lint | `make lint` |
| Format | `make format` |
| Type-check | `make typecheck` |
| DB shell | `make shell-db` |
| Reset DB | `make reset-db` |
| Rebuild backend | `make rebuild-backend` |
| Rebuild frontend | `make rebuild-frontend` |
