"""Populate default permissions for all roles

Revision ID: 20251113_0101_populate_permissions
Revises: 20251113_0100_create_settings
Create Date: 2025-11-13 01:01:00.000000

"""
from alembic import op
import sqlalchemy as sa
from uuid import uuid4

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6g7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create default permissions and assign them to roles."""

    connection = op.get_bind()

    # Define permissions
    permissions = [
        # Users
        ('users.view', 'users.view', 'View users', 'USERS'),
        ('users.create', 'users.create', 'Create users', 'USERS'),
        ('users.edit', 'users.edit', 'Edit users', 'USERS'),
        ('users.delete', 'users.delete', 'Delete users', 'USERS'),

        # Clients
        ('clients.view', 'clients.view', 'View clients', 'CLIENTS'),
        ('clients.create', 'clients.create', 'Create clients', 'CLIENTS'),
        ('clients.edit', 'clients.edit', 'Edit clients', 'CLIENTS'),
        ('clients.delete', 'clients.delete', 'Delete clients', 'CLIENTS'),

        # Finance
        ('finance.view', 'finance.view', 'View financial data', 'FINANCE'),
        ('finance.create', 'finance.create', 'Create financial records', 'FINANCE'),
        ('finance.edit', 'finance.edit', 'Edit financial records', 'FINANCE'),
        ('finance.delete', 'finance.delete', 'Delete financial records', 'FINANCE'),

        # Obligations
        ('obligations.view', 'obligations.view', 'View obligations', 'OBLIGATIONS'),
        ('obligations.create', 'obligations.create', 'Create obligations', 'OBLIGATIONS'),
        ('obligations.edit', 'obligations.edit', 'Edit obligations', 'OBLIGATIONS'),
        ('obligations.delete', 'obligations.delete', 'Delete obligations', 'OBLIGATIONS'),

        # Licenses
        ('licenses.view', 'licenses.view', 'View licenses', 'LICENSES'),
        ('licenses.create', 'licenses.create', 'Create licenses', 'LICENSES'),
        ('licenses.edit', 'licenses.edit', 'Edit licenses', 'LICENSES'),
        ('licenses.delete', 'licenses.delete', 'Delete licenses', 'LICENSES'),

        # Reports
        ('reports.view', 'reports.view', 'View reports', 'REPORTS'),
        ('reports.create', 'reports.create', 'Create reports', 'REPORTS'),
        ('reports.export', 'reports.export', 'Export reports', 'REPORTS'),

        # Settings
        ('settings.view', 'settings.view', 'View settings', 'SETTINGS'),
        ('settings.edit', 'settings.edit', 'Edit settings', 'SETTINGS'),
        ('settings.system', 'settings.system', 'System settings', 'SETTINGS'),

        # Audit
        ('audit.view', 'audit.view', 'View audit logs', 'AUDIT'),
        ('audit.export', 'audit.export', 'Export audit logs', 'AUDIT'),
    ]

    # Insert permissions
    permission_ids = {}
    for code, name, description, category in permissions:
        perm_id = str(uuid4())
        connection.execute(
            sa.text(
                """INSERT INTO permissions (id, code, name, description, category, created_at, updated_at)
                   VALUES (:id, :code, :name, :description, :category, NOW(), NOW())"""
            ),
            {
                'id': perm_id,
                'code': code,
                'name': name,
                'description': description,
                'category': category,
            }
        )
        permission_ids[code] = perm_id

    # Define role permissions
    # ADMIN: All permissions
    admin_permissions = [p[0] for p in permissions]

    # FUNC: Most permissions except system settings and audit
    func_permissions = [
        p[0] for p in permissions
        if not p[3] in ['AUDIT'] and not (p[3] == 'SETTINGS' and 'system' in p[0])
    ]

    # CLIENTE: Only view own data
    cliente_permissions = [
        'clients.view',
        'finance.view',
        'obligations.view',
        'licenses.view',
        'reports.view',
    ]

    # Insert role permissions
    for role_name, role_perms in [('admin', admin_permissions), ('func', func_permissions), ('cliente', cliente_permissions)]:
        for perm_code in role_perms:
            if perm_code in permission_ids:
                connection.execute(
                    sa.text(
                        """INSERT INTO role_permissions (role, permission_id, granted, created_at, updated_at)
                           VALUES (:role, :permission_id, :granted, NOW(), NOW())"""
                    ),
                    {
                        'role': role_name,
                        'permission_id': permission_ids[perm_code],
                        'granted': True,
                    }
                )


def downgrade() -> None:
    """Remove all permissions and role assignments."""
    connection = op.get_bind()

    # Delete role permissions
    connection.execute(sa.text("DELETE FROM role_permissions"))

    # Delete permissions
    connection.execute(sa.text("DELETE FROM permissions"))
