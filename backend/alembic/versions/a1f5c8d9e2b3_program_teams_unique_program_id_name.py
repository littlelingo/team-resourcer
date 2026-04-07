"""program_teams unique (program_id, name)

Revision ID: a1f5c8d9e2b3
Revises: 1ead305befa8
Create Date: 2026-04-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1f5c8d9e2b3'
down_revision: Union[str, None] = '1ead305befa8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_program_teams_program_id_name",
        "program_teams",
        ["program_id", "name"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_program_teams_program_id_name",
        "program_teams",
        type_="unique",
    )
