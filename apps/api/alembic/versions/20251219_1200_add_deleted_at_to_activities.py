"""Add deleted_at column to activities

Revision ID: add_deleted_at_to_activities
Revises: 154f7bd78237
Create Date: 2025-12-19 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "add_deleted_at_to_activities"
down_revision = "154f7bd78237"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add deleted_at column to activities table."""
    op.add_column(
        "activities",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Remove deleted_at column from activities table."""
    op.drop_column("activities", "deleted_at")
