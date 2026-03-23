# Tech Stack

## Languages
- Python 3.12 (backend)
- TypeScript (frontend)

## Frameworks
- FastAPI 0.115.12 (backend API)
- SQLAlchemy 2.0.36 (ORM, async)
- Pydantic 2.10.3 (validation)
- React 19 + Vite 6 (frontend)
- Tailwind CSS 3.4.17 (styling)

## Package Managers
- pip (backend, via requirements.txt)
- npm (frontend)

## Database
- PostgreSQL 16 (Docker, alpine)
- Alembic 1.14.0 (migrations)

## Commands

| Action     | Command |
|------------|---------|
| Start all  | `make up` |
| Stop all   | `make down` |
| Logs       | `make logs` |
| Migrate    | `make migrate` |
| New migration | `make migration name="description"` |
| Seed data  | `make seed` |
| Test       | `make test` |
| Lint       | `make lint` |
| Format     | `make format` |
| Type-check | `make typecheck` |
| DB shell   | `make shell-db` |
