"""add_client_credentials_and_dates_fields

Revision ID: 42786cd90859
Revises: b2c3d4e5f6g7
Create Date: 2025-11-13 12:53:34.451506

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '42786cd90859'
down_revision = 'b2c3d4e5f6g7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add credentials and dates fields to clients table."""
    # Add date field
    op.add_column('clients', sa.Column('inicio_escritorio', sa.Date(), nullable=True))

    # Add credentials fields
    op.add_column('clients', sa.Column('senha_prefeitura', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('login_seg_desemp', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('senha_seg_desemp', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('senha_gcw_resp', sa.String(255), nullable=True))


def downgrade() -> None:
    """Remove credentials and dates fields from clients table."""
    op.drop_column('clients', 'senha_gcw_resp')
    op.drop_column('clients', 'senha_seg_desemp')
    op.drop_column('clients', 'login_seg_desemp')
    op.drop_column('clients', 'senha_prefeitura')
    op.drop_column('clients', 'inicio_escritorio')
