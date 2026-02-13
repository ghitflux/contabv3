"""Add finance.create, finance.edit and finance.delete permissions to CLIENTE role

Revision ID: 20260213_1400_add_cliente_finance_permissions
Revises: 20260301_1200_add_bank_accounts_table
Create Date: 2026-02-13 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260213_1400_add_cliente_finance_permissions'
down_revision = '20260301_1200_add_bank_accounts_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add finance.create, finance.edit and finance.delete permissions to CLIENTE role."""

    connection = op.get_bind()

    # Get permission IDs for finance operations
    finance_permissions = ['finance.create', 'finance.edit', 'finance.delete']

    for perm_code in finance_permissions:
        # Get permission ID
        result = connection.execute(
            sa.text("SELECT id FROM permissions WHERE code = :code"),
            {'code': perm_code}
        )
        perm_row = result.fetchone()

        if perm_row:
            permission_id = perm_row[0]

            # Check if already exists
            existing = connection.execute(
                sa.text(
                    """SELECT 1 FROM role_permissions
                       WHERE role = :role AND permission_id = :permission_id"""
                ),
                {'role': 'cliente', 'permission_id': permission_id}
            ).fetchone()

            # Insert only if doesn't exist
            if not existing:
                connection.execute(
                    sa.text(
                        """INSERT INTO role_permissions (role, permission_id, granted, created_at, updated_at)
                           VALUES (:role, :permission_id, :granted, NOW(), NOW())"""
                    ),
                    {
                        'role': 'cliente',
                        'permission_id': permission_id,
                        'granted': True,
                    }
                )


def downgrade() -> None:
    """Remove finance.create, finance.edit and finance.delete permissions from CLIENTE role."""

    connection = op.get_bind()

    # Get permission IDs for finance operations
    finance_permissions = ['finance.create', 'finance.edit', 'finance.delete']

    for perm_code in finance_permissions:
        # Get permission ID
        result = connection.execute(
            sa.text("SELECT id FROM permissions WHERE code = :code"),
            {'code': perm_code}
        )
        perm_row = result.fetchone()

        if perm_row:
            permission_id = perm_row[0]

            # Delete role permission
            connection.execute(
                sa.text(
                    """DELETE FROM role_permissions
                       WHERE role = :role AND permission_id = :permission_id"""
                ),
                {'role': 'cliente', 'permission_id': permission_id}
            )
