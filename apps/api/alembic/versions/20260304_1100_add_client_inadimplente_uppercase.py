"""Add INADIMPLENTE (uppercase) to client_status enum to match existing uppercase pattern.

Revision ID: 20260304_inadimplente_upper
Revises: 20260304_client_inadimplente
Create Date: 2026-03-04 11:00:00
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260304_inadimplente_upper"
down_revision = "20260304_client_inadimplente"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing client_status enum uses uppercase values (ATIVO, INATIVO, PENDENTE).
    # SQLAlchemy with Python 3.11 str-Enum uses the member name (uppercase) for DB ops.
    op.execute("ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'INADIMPLENTE'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type.
    pass
