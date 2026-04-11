"""widen_box_range_0_to_9

Revision ID: f4a8b2c3d5e6
Revises: e3f7d2c1a9b5
Create Date: 2026-04-10 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f4a8b2c3d5e6"
down_revision: Union[str, None] = "e3f7d2c1a9b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_calibrations_box_range", "calibrations", type_="check")
    op.create_check_constraint(
        "ck_calibrations_box_range", "calibrations", "box BETWEEN 0 AND 9"
    )


def downgrade() -> None:
    op.drop_constraint("ck_calibrations_box_range", "calibrations", type_="check")
    op.create_check_constraint(
        "ck_calibrations_box_range", "calibrations", "box BETWEEN 1 AND 9"
    )
