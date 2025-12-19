"""Add senha_sistema to clients

Revision ID: add_client_system_password
Revises: cedb1b388e6b
Create Date: 2025-12-20 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "add_client_system_password"
down_revision = "cedb1b388e6b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("senha_sistema", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("clients", "senha_sistema")
