"""Fix clients auto honorarios default and legacy data

Revision ID: 20260303_honorarios_auto_default
Revises: 20260305_rpt_hist_trash
Create Date: 2026-03-03 11:00:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260303_honorarios_auto_default"
down_revision = "20260305_rpt_hist_trash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "clients",
        "gerar_lancamentos_honorarios",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.text("true"),
    )

    # Backfill legacy clients created before the flag existed.
    op.execute(
        """
        UPDATE clients
        SET gerar_lancamentos_honorarios = true
        WHERE gerar_lancamentos_honorarios = false
          AND COALESCE(honorarios_mensais, 0) > 0
          AND deleted_at IS NULL
          AND created_at < TIMESTAMP '2026-01-27 12:00:00'
        """
    )


def downgrade() -> None:
    op.alter_column(
        "clients",
        "gerar_lancamentos_honorarios",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.text("false"),
    )
