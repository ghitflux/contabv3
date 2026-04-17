"""Add statement imports staging and bank link to financial transactions.

Revision ID: 20260417_statement_imports
Revises: 20260330_fin_recurring
Create Date: 2026-04-17 09:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260417_statement_imports"
down_revision = "20260330_fin_recurring"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "financial_transactions",
        sa.Column("bank_account_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_financial_transactions_bank_account_id",
        "financial_transactions",
        "bank_accounts",
        ["bank_account_id"],
        ["id"],
    )
    op.create_index(
        "ix_financial_transactions_bank_account_id",
        "financial_transactions",
        ["bank_account_id"],
        unique=False,
    )

    op.create_table(
        "statement_imports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bank_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_format", sa.String(length=10), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="preview"),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("detected_bank_name", sa.String(length=255), nullable=True),
        sa.Column("detected_account_number", sa.String(length=100), nullable=True),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("opening_balance", sa.Numeric(12, 2), nullable=True),
        sa.Column("closing_balance", sa.Numeric(12, 2), nullable=True),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicate_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("imported_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("committed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["bank_account_id"], ["bank_accounts.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
    )
    op.create_index("ix_statement_imports_client_id", "statement_imports", ["client_id"], unique=False)
    op.create_index(
        "ix_statement_imports_bank_account_id",
        "statement_imports",
        ["bank_account_id"],
        unique=False,
    )
    op.create_index(
        "ix_statement_imports_created_by_id",
        "statement_imports",
        ["created_by_id"],
        unique=False,
    )
    op.create_index("ix_statement_imports_status", "statement_imports", ["status"], unique=False)
    op.create_index(
        "ix_statement_imports_created_at",
        "statement_imports",
        ["created_at"],
        unique=False,
    )

    op.create_table(
        "statement_import_rows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("statement_import_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("committed_transaction_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("raw_description", sa.Text(), nullable=True),
        sa.Column("amount_signed", sa.Numeric(12, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(12, 2), nullable=True),
        sa.Column("transaction_type", sa.String(length=10), nullable=False),
        sa.Column("confidence", sa.Numeric(4, 3), nullable=True),
        sa.Column("is_selected", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("duplicate_suspected", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("duplicate_reason", sa.String(length=500), nullable=True),
        sa.Column("category", sa.String(length=20), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("committed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["statement_import_id"],
            ["statement_imports.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["committed_transaction_id"], ["financial_transactions.id"]),
    )
    op.create_index(
        "ix_statement_import_rows_statement_import_id",
        "statement_import_rows",
        ["statement_import_id"],
        unique=False,
    )
    op.create_index(
        "ix_statement_import_rows_transaction_date",
        "statement_import_rows",
        ["transaction_date"],
        unique=False,
    )
    op.create_index(
        "ix_statement_import_rows_transaction_type",
        "statement_import_rows",
        ["transaction_type"],
        unique=False,
    )
    op.create_index(
        "ix_statement_import_rows_duplicate_suspected",
        "statement_import_rows",
        ["duplicate_suspected"],
        unique=False,
    )
    op.create_index(
        "ix_statement_import_rows_committed_transaction_id",
        "statement_import_rows",
        ["committed_transaction_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_statement_import_rows_committed_transaction_id",
        table_name="statement_import_rows",
    )
    op.drop_index(
        "ix_statement_import_rows_duplicate_suspected",
        table_name="statement_import_rows",
    )
    op.drop_index(
        "ix_statement_import_rows_transaction_type",
        table_name="statement_import_rows",
    )
    op.drop_index(
        "ix_statement_import_rows_transaction_date",
        table_name="statement_import_rows",
    )
    op.drop_index(
        "ix_statement_import_rows_statement_import_id",
        table_name="statement_import_rows",
    )
    op.drop_table("statement_import_rows")

    op.drop_index("ix_statement_imports_created_at", table_name="statement_imports")
    op.drop_index("ix_statement_imports_status", table_name="statement_imports")
    op.drop_index("ix_statement_imports_created_by_id", table_name="statement_imports")
    op.drop_index("ix_statement_imports_bank_account_id", table_name="statement_imports")
    op.drop_index("ix_statement_imports_client_id", table_name="statement_imports")
    op.drop_table("statement_imports")

    op.drop_index(
        "ix_financial_transactions_bank_account_id",
        table_name="financial_transactions",
    )
    op.drop_constraint(
        "fk_financial_transactions_bank_account_id",
        "financial_transactions",
        type_="foreignkey",
    )
    op.drop_column("financial_transactions", "bank_account_id")
