"""member_name_split_and_hire_date

Revision ID: c7f3a1e9b2d4
Revises: b514fc596e17
Create Date: 2026-03-26 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7f3a1e9b2d4"
down_revision: Union[str, None] = "b514fc596e17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns as nullable first (required before populating data)
    op.add_column("team_members", sa.Column("first_name", sa.String(255), nullable=True))
    op.add_column("team_members", sa.Column("last_name", sa.String(255), nullable=True))
    op.add_column("team_members", sa.Column("hire_date", sa.Date(), nullable=True))

    # Migrate data: split existing name on the first space
    op.execute("""
        UPDATE team_members
        SET
            first_name = SPLIT_PART(name, ' ', 1),
            last_name  = NULLIF(TRIM(SUBSTRING(name FROM POSITION(' ' IN name) + 1)), '')
    """)

    # Patch any NULL last_name (single-word names) to empty string for NOT NULL constraint
    op.execute("""
        UPDATE team_members SET last_name = '' WHERE last_name IS NULL
    """)

    # Now enforce NOT NULL on the new columns
    op.alter_column("team_members", "first_name", nullable=False)
    op.alter_column("team_members", "last_name", nullable=False)

    # Drop the old name column
    op.drop_column("team_members", "name")


def downgrade() -> None:
    # Add name back as nullable so we can populate it
    op.add_column("team_members", sa.Column("name", sa.String(255), nullable=True))

    # Reconstitute name from parts
    op.execute("UPDATE team_members SET name = TRIM(first_name || ' ' || last_name)")

    # Enforce NOT NULL on the restored column
    op.alter_column("team_members", "name", nullable=False)

    # Remove the new columns
    op.drop_column("team_members", "hire_date")
    op.drop_column("team_members", "last_name")
    op.drop_column("team_members", "first_name")
