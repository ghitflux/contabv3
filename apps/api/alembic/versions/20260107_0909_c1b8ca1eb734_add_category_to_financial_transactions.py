"""add_category_to_financial_transactions

Revision ID: c1b8ca1eb734
Revises: 6c719890c8c3
Create Date: 2026-01-07 09:09:31.673206

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c1b8ca1eb734'
down_revision = '6c719890c8c3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add category field to financial_transactions table.

    This field stores the chart of accounts code (plano de contas)
    for better categorization of financial transactions.
    Example values: "1.1.01", "2.1.05", "3.1.02", etc.
    """
    # Add category column
    op.add_column(
        'financial_transactions',
        sa.Column(
            'category',
            sa.String(length=20),
            nullable=True,
            comment='Chart of accounts code (Plano de Contas) - ex: 1.1.01, 2.1.05'
        )
    )

    # Add index for better performance on category filtering
    op.create_index(
        'ix_financial_transactions_category',
        'financial_transactions',
        ['category']
    )


def downgrade() -> None:
    """Remove category field from financial_transactions table."""
    # Remove index
    op.drop_index('ix_financial_transactions_category', table_name='financial_transactions')

    # Remove column
    op.drop_column('financial_transactions', 'category')
