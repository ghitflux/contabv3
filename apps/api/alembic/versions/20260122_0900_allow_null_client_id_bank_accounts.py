"""Allow null client_id in bank_accounts for office accounts.

Revision ID: 20260122_0900_null_client
Revises: add_bank_accounts_table
Create Date: 2026-01-22 09:00:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260122_0900_null_client"
down_revision = "add_bank_accounts_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make client_id nullable to allow office bank accounts
    op.alter_column(
        "bank_accounts",
        "client_id",
        existing_type=sa.UUID(),
        nullable=True,
    )


def downgrade() -> None:
    # Revert client_id to non-nullable
    # Note: This will fail if there are records with null client_id
    op.alter_column(
        "bank_accounts",
        "client_id",
        existing_type=sa.UUID(),
        nullable=False,
    )
