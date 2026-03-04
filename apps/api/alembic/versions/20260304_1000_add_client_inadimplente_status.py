"""Add inadimplente value to client_status enum.

Revision ID: 20260304_client_inadimplente
Revises: 20260303_honorarios_auto_default
Create Date: 2026-03-04 10:00:00
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260304_client_inadimplente"
down_revision = "20260303_honorarios_auto_default"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'inadimplente'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type.
    pass

