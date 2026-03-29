"""add_functional_manager_id

Revision ID: 55b198d5e2a6
Revises: d8e2f3a4c501
Create Date: 2026-03-29 16:19:18.786085

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '55b198d5e2a6'
down_revision: Union[str, None] = 'd8e2f3a4c501'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('team_members', sa.Column('functional_manager_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_team_members_functional_manager_id',
        'team_members', 'team_members',
        ['functional_manager_id'], ['uuid'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_team_members_functional_manager_id', 'team_members', type_='foreignkey')
    op.drop_column('team_members', 'functional_manager_id')
