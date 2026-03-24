---
name: planning_sqlite_test_db
description: Pattern for async SQLite in-memory test DB with FastAPI + SQLAlchemy 2.0 async
type: project
---

For backend integration tests in this project, use `aiosqlite` in-memory SQLite with `create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False})`. This avoids needing a test Postgres instance.

**Gotchas:**
- `UUID(as_uuid=True)` from `sqlalchemy.dialects.postgresql` renders as `VARCHAR(36)` on SQLite — no breakage.
- Enable FK enforcement via `@event.listens_for(engine.sync_engine, "connect")` → `conn.execute("PRAGMA foreign_keys=ON")`.
- `Team.lead_id` with `use_alter=True` silently no-ops on SQLite DDL — tables still create fine.
- Services that call `await db.commit()` internally (e.g., `commit_import`) break the conftest rollback pattern. Use unique test data prefixes (e.g., `"CI_TEST_001"`) rather than relying on rollback for those test modules.
- `asyncio_mode = "auto"` in `pyproject.toml` means NO `@pytest.mark.asyncio` decorator on any test — adding it causes a deprecation warning.
- Use `httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")` — NOT `fastapi.testclient.TestClient` (synchronous, deadlocks with asyncio_mode=auto).

**Why:** Established during PRP-002-backend (2026-03-23). This pattern was chosen over pytest-postgresql or docker-compose test DB for zero-infrastructure speed.

**How to apply:** Always use this pattern when planning backend test infrastructure for this project. Copy the conftest fixture structure from PRP-002-backend rather than reinventing it.
