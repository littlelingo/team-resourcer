"""add_calibrations_and_cycles

Revision ID: e3f7d2c1a9b5
Revises: a1f5c8d9e2b3
Create Date: 2026-04-08 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e3f7d2c1a9b5"
down_revision: Union[str, None] = "a1f5c8d9e2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "calibration_cycles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("label", sa.String(length=50), nullable=False),
        sa.Column("sequence_number", sa.SmallInteger(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("label", name="uq_calibration_cycles_label"),
    )

    op.create_table(
        "calibrations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("member_uuid", sa.UUID(), nullable=False),
        sa.Column("cycle_id", sa.Integer(), nullable=False),
        sa.Column("box", sa.SmallInteger(), nullable=False),
        sa.Column("reviewers", sa.Text(), nullable=True),
        sa.Column("high_growth_or_key_talent", sa.Text(), nullable=True),
        sa.Column("ready_for_promotion", sa.Text(), nullable=True),
        sa.Column("can_mentor_juniors", sa.Text(), nullable=True),
        sa.Column("next_move_recommendation", sa.Text(), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=False),
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
        sa.CheckConstraint("box BETWEEN 1 AND 9", name="ck_calibrations_box_range"),
        sa.ForeignKeyConstraint(
            ["cycle_id"],
            ["calibration_cycles.id"],
            name="fk_calibrations_cycle_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["member_uuid"],
            ["team_members.uuid"],
            name="fk_calibrations_member_uuid",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("member_uuid", "cycle_id", name="uq_calibrations_member_cycle"),
    )
    op.create_index(
        "ix_calibrations_member_effective",
        "calibrations",
        ["member_uuid", "effective_date"],
    )
    op.create_index("ix_calibrations_cycle_id", "calibrations", ["cycle_id"])
    op.create_index("ix_calibrations_box", "calibrations", ["box"])


def downgrade() -> None:
    op.drop_index("ix_calibrations_box", table_name="calibrations")
    op.drop_index("ix_calibrations_cycle_id", table_name="calibrations")
    op.drop_index("ix_calibrations_member_effective", table_name="calibrations")
    op.drop_table("calibrations")
    op.drop_table("calibration_cycles")
