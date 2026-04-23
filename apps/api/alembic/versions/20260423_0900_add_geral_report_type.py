"""Add geral report type.

Revision ID: 20260423_add_geral_report_type
Revises: 20260417_statement_imports
Create Date: 2026-04-23 09:00:00
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260423_add_geral_report_type"
down_revision = "20260417_statement_imports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'geral'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without rebuilding the enum.
    pass
