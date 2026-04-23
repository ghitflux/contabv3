"""Add missing obligation type ids column to clients.

Revision ID: 20260423_client_obl_type_ids
Revises: 20260423_add_geral_report_type
Create Date: 2026-04-23 10:00:00
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260423_client_obl_type_ids"
down_revision = "20260423_add_geral_report_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE clients "
        "ADD COLUMN IF NOT EXISTS obligation_types_ids JSONB DEFAULT '[]'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS obligation_types_ids")
