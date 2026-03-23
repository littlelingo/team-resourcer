---
name: Phase 1 Architecture
description: Phase 1 tech stack and design decisions — FastAPI async, SQLAlchemy ORM, single-user no-auth
type: project
---

Phase 1 is a single-user internal tool. No auth is intentional by design.

Stack:
- Backend: FastAPI + SQLAlchemy 2.0 async + asyncpg + PostgreSQL 16
- Frontend: Vite/React (port 5173)
- Infra: Docker Compose, uploads volume for profile images

Key design decisions:
- All DB queries use SQLAlchemy ORM (no raw SQL) — injection risk is low
- Image filenames are derived from member UUID + validated extension — path traversal is eliminated
- Content-type validation is header-only (no magic byte check) — spoofing is possible

**Why:** Reviewed during Phase 1 security audit.
**How to apply:** When reviewing new features, assume no auth layer exists and no rate limiting. Focus on data integrity and input validation.
