"""Add deleted_at to report_history for trash/recovery flow.

Revision ID: 20260305_rpt_hist_trash
Revises: f20260213_finance_perms
Create Date: 2026-03-05 09:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260305_rpt_hist_trash"
down_revision = "f20260213_finance_perms"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "report_history",
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Soft delete timestamp for trash/recovery flow",
        ),
    )
    op.create_index(
        op.f("ix_report_history_deleted_at"),
        "report_history",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_report_history_user_deleted_at",
        "report_history",
        ["user_id", "deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_report_history_user_deleted_at", table_name="report_history")
    op.drop_index(op.f("ix_report_history_deleted_at"), table_name="report_history")
    op.drop_column("report_history", "deleted_at")
