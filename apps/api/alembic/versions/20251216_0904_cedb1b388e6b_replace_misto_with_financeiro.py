"""replace_misto_with_financeiro

Revision ID: cedb1b388e6b
Revises: add_xls_to_report_format
Create Date: 2025-12-16 09:04:43.387683

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cedb1b388e6b'
down_revision = 'add_xls_to_report_format'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add FINANCEIRO value to tipo_empresa enum
    # Must be done outside of transaction to avoid asyncpg error
    connection = op.get_bind()
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text(
        "ALTER TYPE tipo_empresa ADD VALUE IF NOT EXISTS 'FINANCEIRO'"
    ))

    # Update existing records with MISTO to FINANCEIRO
    connection.execute(sa.text("""
        UPDATE clients
        SET tipo_empresa = 'FINANCEIRO'
        WHERE tipo_empresa = 'MISTO'
    """))


def downgrade() -> None:
    # Revert FINANCEIRO back to MISTO
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE clients
        SET tipo_empresa = 'MISTO'
        WHERE tipo_empresa = 'FINANCEIRO'
    """))
