import os

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateIndex


@compiles(CreateIndex, "sqlite")
def _create_index_if_not_exists(element, compiler, **kw):
    """SQLite: emit CREATE INDEX IF NOT EXISTS to tolerate duplicate index defs."""
    txt = compiler.visit_create_index(element)
    return txt.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS", 1)


# Ensure upload dir exists before importing app (which mounts StaticFiles)
os.makedirs("/tmp/test_uploads", exist_ok=True)
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_uploads")

from app.core.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.functional_area import FunctionalArea  # noqa: E402
from app.models.program import Program  # noqa: E402
from app.models.team import Team  # noqa: E402
from app.models.team_member import TeamMember  # noqa: E402


@pytest.fixture(scope="session")
async def engine():
    eng = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(eng.sync_engine, "connect")
    def set_sqlite_pragma(conn, _):
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest.fixture(autouse=True)
async def _clean_tables(engine):
    """Truncate all tables after each test for isolation.

    Isolation strategy: DELETE-after (not transaction rollback).
    Service layer functions call db.commit() which are real commits to
    the shared in-memory SQLite engine. This fixture DELETEs all rows
    after each test to restore a clean state. This differs from the PRP's
    rollback spec because SQLite+aiosqlite savepoints don't reliably
    undo commits made through the FastAPI dependency-injected session.
    """
    yield
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA foreign_keys=OFF"))
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
        await conn.execute(text("PRAGMA foreign_keys=ON"))


@pytest.fixture()
async def db_session(engine):
    AsyncTestSession = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncTestSession() as session:
        yield session


@pytest.fixture()
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture()
async def area(db_session):
    a = FunctionalArea(name="Engineering")
    db_session.add(a)
    await db_session.flush()
    return a


@pytest.fixture()
async def team(db_session, area):
    t = Team(name="Backend", functional_area_id=area.id)
    db_session.add(t)
    await db_session.flush()
    return t


@pytest.fixture()
async def member(db_session, area):
    m = TeamMember(
        employee_id="EMP001",
        first_name="Alice",
        last_name="Smith",
        functional_area_id=area.id,
    )
    db_session.add(m)
    await db_session.flush()
    return m


@pytest.fixture()
async def program(db_session):
    p = Program(name="Alpha")
    db_session.add(p)
    await db_session.flush()
    return p
