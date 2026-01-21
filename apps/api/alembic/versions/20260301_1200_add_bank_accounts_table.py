"""Add bank_accounts table

Revision ID: add_bank_accounts_table
Revises: c1b8ca1eb734
Create Date: 2026-03-01 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "add_bank_accounts_table"
down_revision = "c1b8ca1eb734"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bank_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("account_number", sa.String(length=100), nullable=False),
        sa.Column("balance", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("accounting_account", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_bank_accounts_client_id"), "bank_accounts", ["client_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_bank_accounts_client_id"), table_name="bank_accounts")
    op.drop_table("bank_accounts")
