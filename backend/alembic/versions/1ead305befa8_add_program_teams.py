"""add_program_teams

Revision ID: 1ead305befa8
Revises: 55b198d5e2a6
Create Date: 2026-04-03 22:06:00.523384

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ead305befa8'
down_revision: Union[str, None] = '55b198d5e2a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('program_teams',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('program_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('lead_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['lead_id'], ['team_members.uuid'], name='fk_program_teams_lead_id', use_alter=True),
    sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_program_teams_program_id'), 'program_teams', ['program_id'], unique=False)
    op.add_column('program_assignments', sa.Column('program_team_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_program_assignments_program_team_id', 'program_assignments', 'program_teams', ['program_team_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_program_assignments_program_team_id', 'program_assignments', type_='foreignkey')
    op.drop_column('program_assignments', 'program_team_id')
    op.drop_index(op.f('ix_program_teams_program_id'), table_name='program_teams')
    op.drop_table('program_teams')
