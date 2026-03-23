---
feature: 001-team-resourcer-app
phase: 1 - Project Scaffold + Data Model + API
status: COMPLETE
testing: implement-then-test
complexity: HIGH
---

# PRP: Phase 1 — Project Scaffold + Data Model + API

## Overview

Bootstrap the team-resourcer application from an empty repository. Phase 1 delivers a fully runnable local development environment via Docker Compose, a complete PostgreSQL data model with Alembic migrations, and a FastAPI backend exposing full CRUD for all entities plus auto-captured salary/bonus/PTO history.

No frontend application code is created in this phase — only the React/Vite container shell is scaffolded so Docker Compose can start without errors. Functional UI work begins in Phase 2.

---

## Steps

### Step 1: Repository Root Scaffold [x]

Create top-level configuration files that govern the entire project.

**1.1 — `.env`** (`/Users/clint/Workspace/team-resourcer/.env`)

```
POSTGRES_USER=resourcer
POSTGRES_PASSWORD=resourcer
POSTGRES_DB=team_resourcer
POSTGRES_HOST=db
POSTGRES_PORT=5432
DATABASE_URL=postgresql+asyncpg://resourcer:resourcer@db:5432/team_resourcer

UPLOAD_DIR=/app/uploads
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

VITE_API_URL=http://localhost:8000
```

**1.2 — `.env.example`** (`/Users/clint/Workspace/team-resourcer/.env.example`)

Identical to `.env` but with placeholder values (no real secrets). Committed to git. `.env` added to `.gitignore`.

**1.3 — `.gitignore`** (`/Users/clint/Workspace/team-resourcer/.gitignore`)

Must include: `.env`, `__pycache__/`, `*.pyc`, `.venv/`, `node_modules/`, `dist/`, `uploads/`, `*.egg-info/`, `.pytest_cache/`, `.mypy_cache/`.

**1.4 — `docker-compose.yml`** (`/Users/clint/Workspace/team-resourcer/docker-compose.yml`)

Three services:

- **`db`**: `postgres:16-alpine`. Volume `pgdata:/var/lib/postgresql/data`. Env vars from `.env`. Healthcheck: `pg_isready -U ${POSTGRES_USER}`. Port `5432:5432`.
- **`backend`**: Build from `./backend`. Depends on `db` (condition: `service_healthy`). Volumes: `./backend:/app`, `uploads:/app/uploads`. Port `8000:8000`. Env from `.env`. Command: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`.
- **`frontend`**: Build from `./frontend`. Port `5173:5173`. Env: `VITE_API_URL=http://localhost:8000`. Command: `npm run dev -- --host`.

Named volumes: `pgdata`, `uploads`.

**1.5 — `Makefile`** (`/Users/clint/Workspace/team-resourcer/Makefile`)

Targets:
- `up`: `docker compose up -d`
- `down`: `docker compose down`
- `logs`: `docker compose logs -f`
- `migrate`: `docker compose exec backend alembic upgrade head`
- `migration name=?`: `docker compose exec backend alembic revision --autogenerate -m "$(name)"`
- `seed`: `docker compose exec backend python -m app.seed`
- `test`: `docker compose exec backend pytest`
- `lint`: `docker compose exec backend ruff check app/`
- `format`: `docker compose exec backend ruff format app/`
- `typecheck`: `docker compose exec backend mypy app/`
- `shell-db`: `docker compose exec db psql -U resourcer -d team_resourcer`

**Validation**: `make up` starts all three containers without error. `docker compose ps` shows all services healthy/running.

---

### Step 2: Backend Scaffold [x]

**2.1 — Directory structure**

Create the following directory tree under `/Users/clint/Workspace/team-resourcer/backend/`:

```
backend/
  Dockerfile
  requirements.txt
  pyproject.toml
  alembic.ini
  alembic/
    env.py
    script.py.mako
    versions/          (empty, migrations go here)
  app/
    __init__.py
    main.py
    seed.py
    core/
      __init__.py
      config.py
      database.py
    models/
      __init__.py
      base.py
      team_member.py
      member_history.py
      program.py
      program_assignment.py
      functional_area.py
      team.py
    schemas/
      __init__.py
      team_member.py
      member_history.py
      program.py
      program_assignment.py
      functional_area.py
      team.py
      org.py
    api/
      __init__.py
      routes/
        __init__.py
        members.py
        programs.py
        areas.py
        teams.py
        org.py
        history.py
    services/
      __init__.py
      member_service.py
      program_service.py
      area_service.py
      team_service.py
      org_service.py
      history_service.py
      image_service.py
    uploads/           (empty, created at runtime via volume)
```

**2.2 — `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**2.3 — `backend/requirements.txt`**

Pin exact versions:

```
fastapi==0.115.6
uvicorn[standard]==0.32.1
sqlalchemy[asyncio]==2.0.36
alembic==1.14.0
asyncpg==0.30.0
pydantic==2.10.3
pydantic-settings==2.6.1
python-multipart==0.0.19
aiofiles==24.1.0
pillow==11.1.0
ruff==0.8.6
mypy==1.13.0
pytest==8.3.4
pytest-asyncio==0.24.0
httpx==0.28.1
```

**2.4 — `backend/pyproject.toml`**

```toml
[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]

[tool.mypy]
python_version = "3.12"
strict = false
ignore_missing_imports = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**2.5 — `backend/app/core/config.py`**

Use `pydantic-settings` `BaseSettings`. Fields:
- `postgres_user: str`
- `postgres_password: str`
- `postgres_db: str`
- `postgres_host: str`
- `postgres_port: int = 5432`
- `database_url: str`
- `upload_dir: str = "/app/uploads"`
- `backend_host: str = "0.0.0.0"`
- `backend_port: int = 8000`

Instantiate as `settings = Settings()` at module level.

**2.6 — `backend/app/core/database.py`**

- Create async engine with `create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)`.
- Create `AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)`.
- Define `Base = declarative_base()`.
- Define `async def get_db()` dependency that yields an `AsyncSession` and closes on exit.

**2.7 — `backend/app/main.py`**

- Create `FastAPI(title="Team Resourcer API", version="1.0.0")`.
- Add `CORSMiddleware` allowing `["http://localhost:5173", "http://localhost:3000"]`, all methods, all headers.
- Mount static files at `/uploads` serving from `settings.upload_dir` using `StaticFiles`.
- Create `uploads` directory on startup via `lifespan` context manager using `os.makedirs(settings.upload_dir, exist_ok=True)`.
- Include routers: `members` at `/api/members`, `programs` at `/api/programs`, `areas` at `/api/areas`, `org` at `/api/org`. Teams router included within areas router (not top-level).
- `GET /health` returns `{"status": "ok"}`.

**Validation**: `docker compose exec backend python -c "from app.main import app; print('ok')"` exits 0.

---

### Step 3: Database Models [x]

All models live in `backend/app/models/`. All use SQLAlchemy 2.0 mapped class syntax (`DeclarativeBase`, `Mapped`, `mapped_column`).

**3.1 — `backend/app/models/base.py`**

Import `Base` from `app.core.database`. Re-export it so all models import from `app.models.base`.

**3.2 — `backend/app/models/functional_area.py`**

Table `functional_areas`:
- `id: Mapped[int]` — PK, autoincrement
- `name: Mapped[str]` — `String(255)`, not null, unique
- `description: Mapped[str | None]` — `Text`, nullable
- `created_at: Mapped[datetime]` — `DateTime(timezone=True)`, server_default `func.now()`
- `updated_at: Mapped[datetime]` — `DateTime(timezone=True)`, server_default `func.now()`, `onupdate=func.now()`

Relationships (back_populates):
- `teams` → `Team` (one-to-many)
- `members` → `TeamMember` (one-to-many)

**3.3 — `backend/app/models/team.py`**

Table `teams`:
- `id: Mapped[int]` — PK, autoincrement
- `functional_area_id: Mapped[int]` — FK `functional_areas.id`, not null, index
- `name: Mapped[str]` — `String(255)`, not null
- `description: Mapped[str | None]` — `Text`, nullable
- `lead_id: Mapped[uuid.UUID | None]` — FK `team_members.uuid`, nullable (set after members exist)
- `created_at: Mapped[datetime]` — server_default `func.now()`
- `updated_at: Mapped[datetime]` — server_default `func.now()`, onupdate

Relationships:
- `functional_area` → `FunctionalArea` (many-to-one)
- `lead` → `TeamMember` (many-to-one, foreign_keys=[lead_id])
- `members` → `TeamMember` (one-to-many, back_populates="team", foreign_keys on TeamMember side)

**3.4 — `backend/app/models/team_member.py`**

Table `team_members`:
- `uuid: Mapped[uuid.UUID]` — PK, default `uuid.uuid4`, `UUID(as_uuid=True)`
- `employee_id: Mapped[str]` — `String(50)`, not null, unique, index
- `name: Mapped[str]` — `String(255)`, not null
- `title: Mapped[str | None]` — `String(255)`, nullable
- `location: Mapped[str | None]` — `String(255)`, nullable
- `image_path: Mapped[str | None]` — `String(500)`, nullable
- `email: Mapped[str | None]` — `String(255)`, nullable, index
- `phone: Mapped[str | None]` — `String(50)`, nullable
- `slack_handle: Mapped[str | None]` — `String(100)`, nullable
- `salary: Mapped[Decimal | None]` — `Numeric(12, 2)`, nullable
- `bonus: Mapped[Decimal | None]` — `Numeric(12, 2)`, nullable
- `pto_used: Mapped[Decimal | None]` — `Numeric(6, 2)`, nullable (hours or days, not constrained here)
- `functional_area_id: Mapped[int]` — FK `functional_areas.id`, not null, index
- `team_id: Mapped[int | None]` — FK `teams.id`, nullable, index
- `supervisor_id: Mapped[uuid.UUID | None]` — FK `team_members.uuid`, nullable
- `created_at: Mapped[datetime]` — server_default `func.now()`
- `updated_at: Mapped[datetime]` — server_default `func.now()`, onupdate

Relationships:
- `functional_area` → `FunctionalArea` (many-to-one)
- `team` → `Team` (many-to-one, foreign_keys=[team_id])
- `supervisor` → `TeamMember` (self-referential many-to-one, foreign_keys=[supervisor_id], remote_side=[uuid])
- `direct_reports` → `TeamMember` (self-referential one-to-many, back_populates="supervisor")
- `history` → `MemberHistory` (one-to-many)
- `program_assignments` → `ProgramAssignment` (one-to-many)

**3.5 — `backend/app/models/member_history.py`**

Table `member_history`:
- `id: Mapped[int]` — PK, autoincrement
- `member_uuid: Mapped[uuid.UUID]` — FK `team_members.uuid`, not null, index
- `field: Mapped[str]` — `String(20)`, not null — values constrained to `"salary"`, `"bonus"`, `"pto_used"` at the application/schema layer (not DB-level enum to simplify migrations)
- `value: Mapped[Decimal]` — `Numeric(12, 2)`, not null
- `effective_date: Mapped[date]` — `Date`, not null
- `notes: Mapped[str | None]` — `Text`, nullable
- `created_at: Mapped[datetime]` — server_default `func.now()`

Relationships:
- `member` → `TeamMember` (many-to-one)

**3.6 — `backend/app/models/program.py`**

Table `programs`:
- `id: Mapped[int]` — PK, autoincrement
- `name: Mapped[str]` — `String(255)`, not null, unique
- `description: Mapped[str | None]` — `Text`, nullable
- `created_at: Mapped[datetime]` — server_default `func.now()`
- `updated_at: Mapped[datetime]` — server_default `func.now()`, onupdate

Relationships:
- `assignments` → `ProgramAssignment` (one-to-many)

**3.7 — `backend/app/models/program_assignment.py`**

Table `program_assignments`:
- `member_uuid: Mapped[uuid.UUID]` — FK `team_members.uuid`, not null
- `program_id: Mapped[int]` — FK `programs.id`, not null
- `role: Mapped[str | None]` — `String(100)`, nullable

Composite PK on `(member_uuid, program_id)` via `__table_args__ = (PrimaryKeyConstraint("member_uuid", "program_id"),)`.

Relationships:
- `member` → `TeamMember` (many-to-one)
- `program` → `Program` (many-to-one)

**3.8 — `backend/app/models/__init__.py`**

Import all model classes so Alembic autodiscovery works:
```python
from app.models.functional_area import FunctionalArea
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.member_history import MemberHistory
from app.models.program import Program
from app.models.program_assignment import ProgramAssignment
```

**Validation**: `docker compose exec backend python -c "from app.models import *; print('models ok')"` exits 0.

---

### Step 4: Alembic Configuration & Initial Migration [x]

**4.1 — `backend/alembic.ini`**

Standard Alembic ini. Set `script_location = alembic`. Set `sqlalchemy.url` to a placeholder — the actual URL is injected in `env.py`.

**4.2 — `backend/alembic/env.py`**

- Import `settings` from `app.core.config`.
- Import `Base` from `app.core.database`.
- Import all models via `from app.models import *` to ensure they are registered with `Base.metadata`.
- Set `config.set_main_option("sqlalchemy.url", settings.database_url.replace("asyncpg", "psycopg2"))` — Alembic's synchronous runner needs the psycopg2 URL. Add `psycopg2-binary==2.9.10` to `requirements.txt`.
- Set `target_metadata = Base.metadata`.
- `run_migrations_online()` uses a synchronous engine created from the psycopg2 URL.

**4.3 — Initial migration**

After models are in place, generate the initial migration:

```bash
make migration name="initial_schema"
```

This creates `backend/alembic/versions/<hash>_initial_schema.py`. Review generated file to confirm all six tables are present with correct columns and foreign keys. Commit this file.

**4.4 — Apply migration**

```bash
make migrate
```

**Validation**:

```bash
make shell-db
# Inside psql:
\dt
```

Output must list: `alembic_version`, `functional_areas`, `member_history`, `program_assignments`, `programs`, `team_members`, `teams`.

---

### Step 5: Pydantic Schemas

All schemas live in `backend/app/schemas/`. Use Pydantic v2 throughout (`model_config = ConfigDict(from_attributes=True)`).

**5.1 — `backend/app/schemas/functional_area.py`**

- `FunctionalAreaCreate`: `name: str`, `description: str | None = None`
- `FunctionalAreaUpdate`: all fields `Optional`
- `FunctionalAreaResponse`: all DB fields including `id`, `created_at`, `updated_at`
- `FunctionalAreaListResponse`: `id`, `name`, `description` only (no timestamps)

**5.2 — `backend/app/schemas/team.py`**

- `TeamCreate`: `name: str`, `description: str | None`, `functional_area_id: int`, `lead_id: UUID | None`
- `TeamUpdate`: all fields Optional
- `TeamResponse`: all fields + nested `FunctionalAreaListResponse` for `functional_area`
- `TeamListResponse`: `id`, `name`, `functional_area_id`

**5.3 — `backend/app/schemas/member_history.py`**

- `HistoryFieldEnum(str, Enum)`: `salary = "salary"`, `bonus = "bonus"`, `pto_used = "pto_used"`
- `MemberHistoryCreate`: `field: HistoryFieldEnum`, `value: Decimal`, `effective_date: date`, `notes: str | None`
- `MemberHistoryResponse`: all fields including `id`, `member_uuid`, `created_at`

**5.4 — `backend/app/schemas/program.py`**

- `ProgramCreate`: `name: str`, `description: str | None`
- `ProgramUpdate`: all Optional
- `ProgramResponse`: all fields
- `ProgramListResponse`: `id`, `name`

**5.5 — `backend/app/schemas/program_assignment.py`**

- `ProgramAssignmentCreate`: `member_uuid: UUID`, `program_id: int`, `role: str | None`
- `ProgramAssignmentResponse`: includes nested `ProgramListResponse`

**5.6 — `backend/app/schemas/team_member.py`**

- `TeamMemberCreate`:
  - `employee_id: str` — validator: strip whitespace, raise if empty
  - `name: str`
  - `title: str | None`
  - `location: str | None`
  - `email: str | None` — `@field_validator`: validate email format using basic regex `^[^@]+@[^@]+\.[^@]+$`
  - `phone: str | None`
  - `slack_handle: str | None`
  - `salary: Decimal | None`
  - `bonus: Decimal | None`
  - `pto_used: Decimal | None`
  - `functional_area_id: int`
  - `team_id: int | None`
  - `supervisor_id: UUID | None`

- `TeamMemberUpdate`: all fields Optional (no `employee_id` — not updatable after creation)

- `TeamMemberListResponse`: `uuid`, `employee_id`, `name`, `title`, `location`, `image_path`, `email`, `slack_handle`, `functional_area_id`, `team_id`

- `TeamMemberDetailResponse`: all fields from list response plus:
  - `phone`
  - `salary`, `bonus`, `pto_used`
  - `supervisor_id`
  - `functional_area: FunctionalAreaListResponse | None`
  - `team: TeamListResponse | None`
  - `program_assignments: list[ProgramAssignmentResponse]`
  - `history: list[MemberHistoryResponse]`
  - `created_at`, `updated_at`

**5.7 — `backend/app/schemas/org.py`**

- `OrgTreeNode`:
  - `uuid: UUID`
  - `name: str`
  - `title: str | None`
  - `image_path: str | None`
  - `direct_reports: list["OrgTreeNode"]` — recursive, `model_rebuild()` called after class definition

- `SupervisorUpdate`: `supervisor_id: UUID | None`

**Validation**: `docker compose exec backend python -c "from app.schemas import *; print('schemas ok')"` — add re-exports to `backend/app/schemas/__init__.py`.

---

### Step 6: Service Layer [x]

All services live in `backend/app/services/`. Each service receives an `AsyncSession` as its first argument. No service imports from `api/routes/` (one-way dependency).

**6.1 — `backend/app/services/history_service.py`**

- `async def create_history_entry(db, member_uuid, field, value, effective_date, notes=None) -> MemberHistory`: creates and flushes a `MemberHistory` row.
- `async def get_member_history(db, member_uuid, field=None) -> list[MemberHistory]`: query with optional field filter, ordered by `effective_date DESC, created_at DESC`.

**6.2 — `backend/app/services/member_service.py`**

- `async def list_members(db, program_id=None, area_id=None, team_id=None) -> list[TeamMember]`: selectinload `functional_area`, `team`. Apply filters with `AND` logic. Order by `name`.
- `async def get_member(db, member_uuid) -> TeamMember | None`: selectinload all relationships including `program_assignments` → `program`, `history`, `supervisor`, `team`, `functional_area`.
- `async def create_member(db, data: TeamMemberCreate) -> TeamMember`:
  1. Create `TeamMember` from data.
  2. `db.add(member)` + `await db.flush()` to get UUID.
  3. For each of `salary`, `bonus`, `pto_used`: if value is not None, call `create_history_entry` with `effective_date=date.today()`.
  4. `await db.commit()` + `await db.refresh(member)`.
  5. Return member.
- `async def update_member(db, member_uuid, data: TeamMemberUpdate) -> TeamMember | None`:
  1. Fetch existing member (raise 404 if not found).
  2. For each of `salary`, `bonus`, `pto_used`: if the incoming value is not None and differs from current, call `create_history_entry`.
  3. Apply all non-None fields from `data` to member using `setattr`.
  4. `await db.commit()` + `await db.refresh(member)`.
- `async def delete_member(db, member_uuid) -> bool`: delete and commit, return True if found.

**6.3 — `backend/app/services/image_service.py`**

- `async def save_profile_image(member_uuid: UUID, file: UploadFile) -> str`:
  1. Validate content type is `image/jpeg`, `image/png`, or `image/webp`. Raise `ValueError` otherwise.
  2. Validate file size ≤ 5 MB by reading in chunks.
  3. Generate filename: `{member_uuid}.{extension}` (derived from content type).
  4. Write to `os.path.join(settings.upload_dir, filename)` using `aiofiles.open`.
  5. Return relative path `/uploads/{filename}`.

**6.4 — `backend/app/services/area_service.py`**

- `async def list_areas(db) -> list[FunctionalArea]`
- `async def get_area(db, area_id) -> FunctionalArea | None`
- `async def create_area(db, data) -> FunctionalArea`
- `async def update_area(db, area_id, data) -> FunctionalArea | None`
- `async def delete_area(db, area_id) -> bool`

**6.5 — `backend/app/services/team_service.py`**

- `async def list_teams(db, area_id) -> list[Team]`
- `async def get_team(db, team_id) -> Team | None`
- `async def create_team(db, data) -> Team`
- `async def update_team(db, team_id, data) -> Team | None`
- `async def delete_team(db, team_id) -> bool`
- `async def add_member_to_team(db, team_id, member_uuid) -> bool`: sets `member.team_id = team_id`, commits.
- `async def remove_member_from_team(db, team_id, member_uuid) -> bool`: sets `member.team_id = None` if they belong to that team.

**6.6 — `backend/app/services/program_service.py`**

- `async def list_programs(db) -> list[Program]`
- `async def get_program(db, program_id) -> Program | None`
- `async def create_program(db, data) -> Program`
- `async def update_program(db, program_id, data) -> Program | None`
- `async def delete_program(db, program_id) -> bool`
- `async def get_program_members(db, program_id) -> list[TeamMember]`: join through `ProgramAssignment`.
- `async def assign_member(db, program_id, data: ProgramAssignmentCreate) -> ProgramAssignment`: upsert — if assignment already exists, update role.
- `async def unassign_member(db, program_id, member_uuid) -> bool`

**6.7 — `backend/app/services/org_service.py`**

- `async def get_org_tree(db) -> list[OrgTreeNode]`:
  1. Load all `TeamMember` rows with `selectinload(TeamMember.direct_reports)` recursively (use joined/subquery load strategy appropriate for tree depth — use recursive CTE or Python-side tree building).
  2. Build tree: find root members (those whose `supervisor_id` is None), recursively attach `direct_reports`.
  3. Return list of root `OrgTreeNode` objects.
- `async def set_supervisor(db, member_uuid, supervisor_id: UUID | None) -> TeamMember | None`: guard against circular reference (member cannot be their own supervisor; check that supervisor_id is not a descendant of member_uuid using a traversal before committing).

**Validation**: `docker compose exec backend python -c "from app.services import *; print('services ok')"` — add re-exports to `backend/app/services/__init__.py`.

---

### Step 7: API Routes [x]

All routers live in `backend/app/api/routes/`. Use `APIRouter`. Each route delegates entirely to the service layer — no DB queries in route handlers.

**7.1 — `backend/app/api/routes/members.py`**

Router prefix: (none — mounted at `/api/members` in main.py)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/` | `list_members` | Query params: `program_id: int \| None`, `area_id: int \| None`, `team_id: int \| None`. Returns `list[TeamMemberListResponse]`. |
| GET | `/{member_uuid}` | `get_member` | Returns `TeamMemberDetailResponse`. 404 if not found. |
| POST | `/` | `create_member` | Body: `TeamMemberCreate`. Returns `TeamMemberDetailResponse`. Status 201. |
| PUT | `/{member_uuid}` | `update_member` | Body: `TeamMemberUpdate`. Returns `TeamMemberDetailResponse`. 404 if not found. |
| DELETE | `/{member_uuid}` | `delete_member` | Returns 204. 404 if not found. |
| POST | `/{member_uuid}/image` | `upload_image` | `file: UploadFile = File(...)`. Calls `image_service.save_profile_image`, updates `member.image_path`. Returns `{"image_path": str}`. |

**7.2 — `backend/app/api/routes/programs.py`**

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/` | `list_programs` | Returns `list[ProgramListResponse]`. |
| GET | `/{program_id}` | `get_program` | Returns `ProgramResponse`. |
| POST | `/` | `create_program` | Returns `ProgramResponse`. Status 201. |
| PUT | `/{program_id}` | `update_program` | Returns `ProgramResponse`. |
| DELETE | `/{program_id}` | `delete_program` | Returns 204. |
| GET | `/{program_id}/members` | `get_program_members` | Returns `list[TeamMemberListResponse]`. |
| POST | `/{program_id}/assignments` | `assign_member` | Body: `ProgramAssignmentCreate`. Returns `ProgramAssignmentResponse`. Status 201. |
| DELETE | `/{program_id}/assignments/{member_uuid}` | `unassign_member` | Returns 204. |

**7.3 — `backend/app/api/routes/areas.py`**

Include `teams` sub-router inside this file using `areas_router.include_router(teams_router, prefix="/{area_id}/teams")`.

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/` | `list_areas` | Returns `list[FunctionalAreaListResponse]`. |
| GET | `/{area_id}` | `get_area` | Returns `FunctionalAreaResponse`. |
| POST | `/` | `create_area` | Returns `FunctionalAreaResponse`. Status 201. |
| PUT | `/{area_id}` | `update_area` | Returns `FunctionalAreaResponse`. |
| DELETE | `/{area_id}` | `delete_area` | Returns 204. |

**7.4 — `backend/app/api/routes/teams.py`**

Router is mounted as sub-router inside `areas.py` (prefix `/{area_id}/teams`). The `area_id` path param is available in all handlers.

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/` | `list_teams` | Returns `list[TeamListResponse]`. |
| GET | `/{team_id}` | `get_team` | Returns `TeamResponse`. |
| POST | `/` | `create_team` | Returns `TeamResponse`. Status 201. Automatically sets `functional_area_id` from path. |
| PUT | `/{team_id}` | `update_team` | Returns `TeamResponse`. |
| DELETE | `/{team_id}` | `delete_team` | Returns 204. |
| POST | `/{team_id}/members` | `add_member` | Body: `{"member_uuid": UUID}`. Returns 200. |
| DELETE | `/{team_id}/members/{member_uuid}` | `remove_member` | Returns 204. |

**7.5 — `backend/app/api/routes/org.py`**

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/tree` | `get_org_tree` | Returns `list[OrgTreeNode]`. |
| PUT | `/members/{member_uuid}/supervisor` | `set_supervisor` | Body: `SupervisorUpdate`. Returns `TeamMemberDetailResponse`. |

**7.6 — `backend/app/api/routes/history.py`**

Mounted at `/api/members/{member_uuid}/history` in `main.py`.

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/` | `get_history` | Query param: `field: HistoryFieldEnum \| None`. Returns `list[MemberHistoryResponse]`. |

**Validation**:

```bash
make up
curl http://localhost:8000/health
# → {"status":"ok"}
curl http://localhost:8000/api/members/
# → []  (empty list)
curl http://localhost:8000/api/programs/
# → []
curl http://localhost:8000/api/areas/
# → []
```

Also open `http://localhost:8000/docs` — all endpoints must appear in Swagger UI with correct schemas.

---

### Step 8: Frontend Shell Scaffold

The frontend is not functionally implemented in Phase 1, but the container must build and start cleanly so `docker compose up` does not error.

**8.1 — Scaffold Vite + React + TypeScript project**

Run from host (not Docker) in the repo root:

```bash
npm create vite@5.4.11 frontend -- --template react-ts
```

This creates `frontend/` with `package.json`, `vite.config.ts`, `src/`, etc.

**8.2 — Install shadcn/ui dependencies**

```bash
cd frontend
npm install
npm install -D tailwindcss@3.4.17 postcss@8.4.49 autoprefixer@10.4.20
npx tailwindcss init -p
npm install @radix-ui/react-slot@1.1.1 class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@2.6.0 lucide-react@0.469.0
```

**8.3 — Configure Tailwind**

Edit `frontend/tailwind.config.js` to add:
```js
content: ["./index.html", "./src/**/*.{ts,tsx}"]
```

Add to `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**8.4 — Configure path alias for shadcn/ui**

In `frontend/vite.config.ts`, add resolve alias: `"@"` → `path.resolve(__dirname, "./src")`.

Add to `frontend/tsconfig.json` under `compilerOptions`: `"baseUrl": "."`, `"paths": { "@/*": ["./src/*"] }`.

**8.5 — `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
```

**8.6 — `frontend/.gitignore`**

Include: `node_modules/`, `dist/`, `.env.local`.

**Validation**: `docker compose up frontend --build` — container starts and stays running. `curl http://localhost:5173` returns HTML.

---

### Step 9: Seed Data Script

**`backend/app/seed.py`**

A standalone async script (run via `make seed`) that inserts enough sample data to exercise all endpoints manually:

1. Create 2 `FunctionalArea` records: `"Engineering"`, `"Product"`
2. Create 2 `Team` records: `"Platform Team"` (Engineering), `"Growth Team"` (Product)
3. Create 3 `TeamMember` records with all fields populated including salary/bonus/pto_used (triggers history auto-capture via `member_service.create_member`)
4. Create 2 `Program` records: `"Alpha Program"`, `"Beta Program"`
5. Assign members to programs
6. Set one member as supervisor of another

Script must be idempotent: check if `FunctionalArea` named `"Engineering"` already exists before inserting.

---

## File Manifest

Every file to be created (greenfield project — no files are modified):

### Root
| File | Purpose |
|------|---------|
| `.env` | Local environment variables (not committed) |
| `.env.example` | Template committed to git |
| `.gitignore` | Excludes `.env`, build artifacts, uploads |
| `docker-compose.yml` | Orchestrates db, backend, frontend containers |
| `Makefile` | Developer convenience commands |

### Backend
| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Python 3.12 image with dependencies |
| `backend/requirements.txt` | Pinned Python dependencies |
| `backend/pyproject.toml` | Ruff, mypy, pytest configuration |
| `backend/alembic.ini` | Alembic configuration |
| `backend/alembic/env.py` | Alembic runtime with async model loading |
| `backend/alembic/script.py.mako` | Migration file template (default Alembic template) |
| `backend/alembic/versions/<hash>_initial_schema.py` | Generated: initial migration |
| `backend/app/__init__.py` | Empty |
| `backend/app/main.py` | FastAPI app, CORS, lifespan, router mounting |
| `backend/app/seed.py` | Sample data seeder |
| `backend/app/core/__init__.py` | Empty |
| `backend/app/core/config.py` | Pydantic Settings |
| `backend/app/core/database.py` | Async engine, session factory, Base, get_db |
| `backend/app/models/__init__.py` | Re-exports all model classes |
| `backend/app/models/base.py` | Re-exports Base |
| `backend/app/models/functional_area.py` | FunctionalArea ORM model |
| `backend/app/models/team.py` | Team ORM model |
| `backend/app/models/team_member.py` | TeamMember ORM model |
| `backend/app/models/member_history.py` | MemberHistory ORM model |
| `backend/app/models/program.py` | Program ORM model |
| `backend/app/models/program_assignment.py` | ProgramAssignment ORM model |
| `backend/app/schemas/__init__.py` | Re-exports key schema classes |
| `backend/app/schemas/functional_area.py` | FunctionalArea request/response schemas |
| `backend/app/schemas/team.py` | Team request/response schemas |
| `backend/app/schemas/team_member.py` | TeamMember request/response schemas |
| `backend/app/schemas/member_history.py` | MemberHistory schemas + HistoryFieldEnum |
| `backend/app/schemas/program.py` | Program schemas |
| `backend/app/schemas/program_assignment.py` | ProgramAssignment schemas |
| `backend/app/schemas/org.py` | OrgTreeNode, SupervisorUpdate |
| `backend/app/api/__init__.py` | Empty |
| `backend/app/api/routes/__init__.py` | Empty |
| `backend/app/api/routes/members.py` | /api/members endpoints |
| `backend/app/api/routes/programs.py` | /api/programs endpoints |
| `backend/app/api/routes/areas.py` | /api/areas endpoints (includes teams sub-router) |
| `backend/app/api/routes/teams.py` | Teams sub-router |
| `backend/app/api/routes/org.py` | /api/org endpoints |
| `backend/app/api/routes/history.py` | /api/members/{uuid}/history endpoint |
| `backend/app/services/__init__.py` | Re-exports service functions |
| `backend/app/services/member_service.py` | Member CRUD + history auto-capture |
| `backend/app/services/image_service.py` | Profile image upload handling |
| `backend/app/services/area_service.py` | FunctionalArea CRUD |
| `backend/app/services/team_service.py` | Team CRUD + member assignment |
| `backend/app/services/program_service.py` | Program CRUD + member assignment |
| `backend/app/services/org_service.py` | Org tree + supervisor management |
| `backend/app/services/history_service.py` | History entry creation + retrieval |

### Frontend (shell only)
| File | Purpose |
|------|---------|
| `frontend/Dockerfile` | Node 20 dev server image |
| `frontend/package.json` | NPM dependencies |
| `frontend/vite.config.ts` | Vite config with `@` alias |
| `frontend/tsconfig.json` | TypeScript config with path mapping |
| `frontend/tailwind.config.js` | Tailwind content paths |
| `frontend/postcss.config.js` | PostCSS with Tailwind + Autoprefixer |
| `frontend/src/index.css` | Tailwind directives |
| `frontend/src/main.tsx` | React entry point |
| `frontend/src/App.tsx` | Placeholder component |
| `frontend/.gitignore` | node_modules, dist, .env.local |

---

## Validation Criteria

Each step has a pass/fail acceptance test. Implementation is complete when ALL pass.

### Step 1 (Scaffold)
- [ ] `docker compose up -d` completes without error
- [ ] `docker compose ps` shows `db`, `backend`, `frontend` all running
- [ ] `curl http://localhost:8000/health` returns `{"status":"ok"}`
- [ ] `curl http://localhost:5173` returns HTML

### Step 2 (Backend Structure)
- [ ] `docker compose exec backend python -c "from app.main import app; print('ok')"` exits 0
- [ ] `docker compose exec backend python -c "from app.core.config import settings; print(settings.database_url)"` prints the URL

### Step 3 (Models)
- [ ] `docker compose exec backend python -c "from app.models import FunctionalArea, Team, TeamMember, MemberHistory, Program, ProgramAssignment; print('ok')"` exits 0

### Step 4 (Migration)
- [ ] `make migrate` exits 0
- [ ] `make shell-db` + `\dt` shows all 7 tables (`alembic_version` + 6 domain tables)
- [ ] `make shell-db` + `\d team_members` shows all columns with correct types

### Step 5 (Schemas)
- [ ] `docker compose exec backend python -c "from app.schemas.team_member import TeamMemberCreate; TeamMemberCreate(employee_id='E001', name='Alice', functional_area_id=1); print('ok')"` exits 0
- [ ] `docker compose exec backend python -c "from app.schemas.org import OrgTreeNode; OrgTreeNode.model_rebuild(); print('ok')"` exits 0

### Step 6 (Services)
- [ ] `docker compose exec backend python -c "from app.services import *; print('ok')"` exits 0

### Step 7 (API)
- [ ] `curl http://localhost:8000/docs` returns 200 with Swagger HTML
- [ ] `curl http://localhost:8000/api/members/` returns `[]`
- [ ] `curl http://localhost:8000/api/programs/` returns `[]`
- [ ] `curl http://localhost:8000/api/areas/` returns `[]`
- [ ] `curl http://localhost:8000/api/org/tree` returns `[]`
- [ ] POST a FunctionalArea, then POST a TeamMember with salary set, then `GET /api/members/{uuid}` returns member with `history` containing one entry

### Step 8 (Frontend)
- [x] `docker compose logs frontend` shows Vite dev server started on port 5173
- [x] No TypeScript errors: `docker compose exec frontend npx tsc --noEmit`

### Step 9 (Seed)
- [x] `make seed` exits 0 without errors
- [x] Re-running `make seed` a second time exits 0 (idempotent)
- [x] After seed: `curl http://localhost:8000/api/members/ | python3 -m json.tool` shows 3 members
- [x] After seed: `curl http://localhost:8000/api/org/tree | python3 -m json.tool` shows non-empty tree

---

## Testing Plan

Tests are written AFTER implementation. Use `pytest` + `pytest-asyncio` + `httpx.AsyncClient`.

### Test location

```
backend/
  tests/
    __init__.py
    conftest.py
    test_members.py
    test_programs.py
    test_areas.py
    test_teams.py
    test_org.py
    test_history.py
    test_image_upload.py
```

### `conftest.py`

- Create an in-memory SQLite async engine for isolation (or use a test PostgreSQL DB via env var override).
- `@pytest.fixture` for `async_session`: creates all tables via `Base.metadata.create_all`, yields session, drops tables after.
- `@pytest.fixture` for `client`: wraps `httpx.AsyncClient(app=app, base_url="http://test")` with overridden `get_db` dependency.

### Test coverage requirements

**`test_members.py`**:
- Create a member with salary/bonus/pto → assert 201 response
- Get member by UUID → assert history contains 3 entries (one per field)
- Update member salary to new value → assert history now has 4 entries
- Update member with same salary value → assert history still has 4 entries (no duplicate)
- Delete member → assert 404 on subsequent GET
- Filter members by `area_id` → returns only members in that area
- Create member with invalid email → assert 422

**`test_programs.py`**:
- CRUD happy path for Program
- Assign member to program → GET `/programs/{id}/members` includes member
- Unassign → member no longer in list
- Assign same member twice (same program) → updates role, does not create duplicate

**`test_areas.py`**:
- CRUD happy path for FunctionalArea

**`test_teams.py`**:
- CRUD happy path for Team under an area
- Add member to team → member's `team_id` updated
- Remove member from team → member's `team_id` is null

**`test_org.py`**:
- Set supervisor → GET `/org/tree` shows correct parent/child
- Attempt circular supervisor assignment → returns 400
- Member with no supervisor appears as root node in tree

**`test_history.py`**:
- GET history for member → returns entries ordered by `effective_date DESC`
- Filter by `field=salary` → returns only salary entries

**`test_image_upload.py`**:
- Upload valid PNG → 200, `image_path` updated on member
- Upload non-image file → 422 or 400
- Uploaded file accessible at `/uploads/{filename}`

### Run tests

```bash
make test
# or directly:
docker compose exec backend pytest -v
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| SQLAlchemy async + Alembic sync mismatch | `env.py` replaces `asyncpg` with `psycopg2` in URL; `psycopg2-binary` in requirements |
| Circular import between models (Team.lead_id → TeamMember, TeamMember.team_id → Team) | Use `__tablename__` string references in FK args, not class references. Define both models before setting up relationships using `relationship("ClassName")` string syntax. |
| Org tree infinite recursion on circular supervisor data | `org_service.set_supervisor` validates no circular reference before committing |
| Self-referential `supervisor_id` in Alembic migration | Add `use_alter=True` on the FK and emit `create_constraint` separately — or use `ALTER TABLE` post-create in migration |
| File upload path collisions | Filename is `{member_uuid}.{ext}` — UUID guarantees uniqueness per member |
| `updated_at` not updating on SQLAlchemy async sessions | Use `onupdate=func.now()` on column + ensure the session sees the update (call `await db.refresh(obj)` after commit) |
| shadcn/ui CLI requires interactive prompts | Install Radix primitives manually (Step 8.2) instead of running `npx shadcn@latest init` — avoids prompt issues in CI/Docker |
