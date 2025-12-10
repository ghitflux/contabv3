"""add client.user_id link to users

Revision ID: c7c2c13b6a9e
Revises: ff2122bfb7ca
Create Date: 2025-12-18 10:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7c2c13b6a9e'
down_revision = 'ff2122bfb7ca'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add nullable user link to clients table."""
    op.add_column('clients', sa.Column('user_id', sa.UUID(), nullable=True))
    op.create_index('ix_clients_user_id', 'clients', ['user_id'], unique=True)
    op.create_foreign_key(
        'fk_clients_user_id_users',
        'clients',
        'users',
        ['user_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    """Remove user link from clients table."""
    op.drop_constraint('fk_clients_user_id_users', 'clients', type_='foreignkey')
    op.drop_index('ix_clients_user_id', table_name='clients')
    op.drop_column('clients', 'user_id')
