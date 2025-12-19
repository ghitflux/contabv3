"""Add default to licenses.updated_at and backfill existing rows

Revision ID: add_updated_at_default_licenses
Revises: add_deleted_at_to_activities
Create Date: 2025-12-19 12:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "add_updated_at_default_licenses"
down_revision = "add_deleted_at_to_activities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add server default and not-null constraint to licenses.updated_at."""
    op.execute("UPDATE licenses SET updated_at = COALESCE(updated_at, created_at, now())")
    op.alter_column(
        "licenses",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        nullable=False,
    )


def downgrade() -> None:
    """Revert updated_at default/constraint on licenses."""
    op.alter_column(
        "licenses",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=None,
        nullable=True,
    )
