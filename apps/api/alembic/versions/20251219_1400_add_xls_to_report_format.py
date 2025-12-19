"""Add xls option to report_format enum

Revision ID: add_xls_to_report_format
Revises: add_updated_at_default_licenses
Create Date: 2025-12-19 14:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_xls_to_report_format"
down_revision = "add_updated_at_default_licenses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE report_format ADD VALUE IF NOT EXISTS 'xls'")


def downgrade() -> None:
    # Cannot safely remove enum values in Postgres; no-op downgrade
    pass
