"""add_agencies_and_program_agency_fk

Revision ID: b514fc596e17
Revises: 452ccece7038
Create Date: 2026-03-26 02:30:52.274948

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b514fc596e17"
down_revision: Union[str, None] = "452ccece7038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agencies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.add_column("programs", sa.Column("agency_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_programs_agency_id", "programs", "agencies", ["agency_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_programs_agency_id", "programs", ["agency_id"])


def downgrade() -> None:
    op.drop_index("ix_programs_agency_id", table_name="programs")
    op.drop_constraint("fk_programs_agency_id", "programs", type_="foreignkey")
    op.drop_column("programs", "agency_id")
    op.drop_table("agencies")
