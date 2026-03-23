---
name: Circular FK between Team and TeamMember
description: Team.lead_id references TeamMember and TeamMember.team_id references Team — requires careful FK declaration to avoid Alembic migration failures
type: feedback
---

The Team.lead_id (FK → team_members.uuid) and TeamMember.team_id (FK → teams.id) create a circular foreign key dependency. Alembic cannot create both tables with their FKs in a single CREATE TABLE pass.

**Why:** PostgreSQL requires the referenced table to exist before the FK constraint is applied. With mutual FKs, one must be deferred.

**How to apply:** In migration plans for this schema, use `use_alter=True` on either Team.lead_id or TeamMember.team_id FK column declaration. In the generated migration, Alembic will emit the FK as a separate ALTER TABLE after both tables are created. Always review the generated migration file to confirm this pattern was applied correctly.
