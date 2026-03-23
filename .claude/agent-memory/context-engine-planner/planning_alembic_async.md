---
name: Alembic requires psycopg2 URL when app uses asyncpg
description: SQLAlchemy async apps use asyncpg driver but Alembic's synchronous migration runner needs psycopg2; env.py must swap the URL scheme
type: feedback
---

When planning FastAPI + SQLAlchemy async apps with Alembic, always include psycopg2-binary in requirements.txt and configure alembic/env.py to replace "asyncpg" with "psycopg2" in the DATABASE_URL before passing it to Alembic's engine.

**Why:** Alembic runs migrations synchronously. Using the asyncpg URL directly in env.py causes a driver mismatch error at migration time.

**How to apply:** In any backend plan using asyncpg + Alembic: (1) add psycopg2-binary to requirements.txt, (2) in alembic/env.py use `url.replace("asyncpg", "psycopg2")` when setting the sqlalchemy.url for Alembic's engine.
