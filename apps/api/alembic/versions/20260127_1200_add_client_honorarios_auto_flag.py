"""Add gerar_lancamentos_honorarios flag to clients

Revision ID: 20260127_1200_honorarios_auto
Revises: 20260122_0900_null_client
Create Date: 2026-01-27 12:00:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260127_1200_honorarios_auto"
down_revision = "20260122_0900_null_client"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column(
            "gerar_lancamentos_honorarios",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("clients", "gerar_lancamentos_honorarios")
