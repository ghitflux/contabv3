"""Add recurring finance templates and monthly fee blocks.

Revision ID: 20260330_fin_recurring
Revises: 20260304_inadimplente_upper
Create Date: 2026-03-30 16:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260330_fin_recurring"
down_revision = "20260304_inadimplente_upper"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "financial_recurring_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("transaction_type", sa.String(length=10), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("due_day", sa.Integer(), nullable=False),
        sa.Column("start_reference_month", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
    )
    op.create_index(
        "ix_financial_recurring_templates_client_id",
        "financial_recurring_templates",
        ["client_id"],
        unique=False,
    )
    op.create_index(
        "ix_financial_recurring_templates_created_by_id",
        "financial_recurring_templates",
        ["created_by_id"],
        unique=False,
    )
    op.create_index(
        "ix_financial_recurring_templates_start_reference_month",
        "financial_recurring_templates",
        ["start_reference_month"],
        unique=False,
    )
    op.create_index(
        "ix_financial_recurring_templates_deleted_at",
        "financial_recurring_templates",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_financial_recurring_templates_client_active",
        "financial_recurring_templates",
        ["client_id", "is_active"],
        unique=False,
    )

    op.create_table(
        "monthly_fee_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reference_month", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.UniqueConstraint("client_id", "reference_month", name="uq_monthly_fee_blocks_client_month"),
    )
    op.create_index(
        "ix_monthly_fee_blocks_client_id",
        "monthly_fee_blocks",
        ["client_id"],
        unique=False,
    )
    op.create_index(
        "ix_monthly_fee_blocks_reference_month",
        "monthly_fee_blocks",
        ["reference_month"],
        unique=False,
    )

    op.add_column(
        "financial_transactions",
        sa.Column("recurring_template_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "financial_transactions",
        sa.Column("restore_blocked_reason", sa.String(length=500), nullable=True),
    )
    op.create_foreign_key(
        "fk_financial_transactions_recurring_template_id",
        "financial_transactions",
        "financial_recurring_templates",
        ["recurring_template_id"],
        ["id"],
    )
    op.create_index(
        "ix_financial_transactions_recurring_template_id",
        "financial_transactions",
        ["recurring_template_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_financial_transactions_recurring_template_id",
        table_name="financial_transactions",
    )
    op.drop_constraint(
        "fk_financial_transactions_recurring_template_id",
        "financial_transactions",
        type_="foreignkey",
    )
    op.drop_column("financial_transactions", "restore_blocked_reason")
    op.drop_column("financial_transactions", "recurring_template_id")

    op.drop_index("ix_monthly_fee_blocks_reference_month", table_name="monthly_fee_blocks")
    op.drop_index("ix_monthly_fee_blocks_client_id", table_name="monthly_fee_blocks")
    op.drop_table("monthly_fee_blocks")

    op.drop_index(
        "ix_financial_recurring_templates_client_active",
        table_name="financial_recurring_templates",
    )
    op.drop_index(
        "ix_financial_recurring_templates_deleted_at",
        table_name="financial_recurring_templates",
    )
    op.drop_index(
        "ix_financial_recurring_templates_start_reference_month",
        table_name="financial_recurring_templates",
    )
    op.drop_index(
        "ix_financial_recurring_templates_created_by_id",
        table_name="financial_recurring_templates",
    )
    op.drop_index(
        "ix_financial_recurring_templates_client_id",
        table_name="financial_recurring_templates",
    )
    op.drop_table("financial_recurring_templates")
