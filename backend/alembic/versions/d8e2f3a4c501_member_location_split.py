"""member location split

Revision ID: d8e2f3a4c501
Revises: c7f3a1e9b2d4
Create Date: 2026-03-27 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d8e2f3a4c501"
down_revision: str | None = "c7f3a1e9b2d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add new columns (nullable)
    op.add_column("team_members", sa.Column("city", sa.String(255), nullable=True))
    op.add_column("team_members", sa.Column("state", sa.String(100), nullable=True))

    # 2. Migrate data — split existing location on last comma
    # Values with comma: city = everything before last comma (trimmed), state = after last comma (trimmed)
    op.execute("""
        UPDATE team_members
        SET
            city  = TRIM(REVERSE(SPLIT_PART(REVERSE(location), ',', 2))),
            state = TRIM(REVERSE(SPLIT_PART(REVERSE(location), ',', 1)))
        WHERE location IS NOT NULL AND location LIKE '%,%'
    """)
    # Values without comma: city = trimmed location, state = NULL
    op.execute("""
        UPDATE team_members
        SET city = TRIM(location)
        WHERE location IS NOT NULL AND location NOT LIKE '%,%'
    """)

    # 3. Drop old location column
    op.drop_column("team_members", "location")


def downgrade() -> None:
    # 1. Add location column back
    op.add_column("team_members", sa.Column("location", sa.String(255), nullable=True))

    # 2. Reconstitute location from city and state
    op.execute("""
        UPDATE team_members
        SET location = TRIM(city || ', ' || state)
        WHERE city IS NOT NULL AND state IS NOT NULL
    """)
    op.execute("""
        UPDATE team_members
        SET location = city
        WHERE city IS NOT NULL AND state IS NULL
    """)

    # 3. Drop city and state columns
    op.drop_column("team_members", "state")
    op.drop_column("team_members", "city")
