"""Create settings and permissions tables

Revision ID: 20251113_0100_create_settings
Revises: 20251107_1033_7aff3ebd7a1f
Create Date: 2025-11-13 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '7aff3ebd7a1f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create system_settings table
    op.create_table('system_settings',
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('company_cnpj', sa.String(length=18), nullable=True),
        sa.Column('company_email', sa.String(length=255), nullable=True),
        sa.Column('company_phone', sa.String(length=20), nullable=True),
        sa.Column('company_address', sa.Text(), nullable=True),
        sa.Column('smtp_host', sa.String(length=255), nullable=True),
        sa.Column('smtp_port', sa.Integer(), nullable=True),
        sa.Column('smtp_username', sa.String(length=255), nullable=True),
        sa.Column('smtp_password_encrypted', sa.Text(), nullable=True),
        sa.Column('smtp_from_email', sa.String(length=255), nullable=True),
        sa.Column('smtp_use_tls', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('backup_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('backup_frequency', sa.String(length=50), nullable=True),
        sa.Column('backup_retention_days', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('api_rate_limit_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('api_rate_limit_requests', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('api_rate_limit_window_seconds', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('enable_two_factor_auth', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('enable_audit_logging', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('enable_client_drafts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create user_settings table
    op.create_table('user_settings',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('theme_mode', sa.String(50), nullable=False, server_default='system'),
        sa.Column('language', sa.String(50), nullable=False, server_default='pt-br'),
        sa.Column('notify_email_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notify_obligations', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notify_financial', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notify_licenses', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notify_reports', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('notify_system', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_digest_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('email_digest_frequency', sa.String(length=50), nullable=False, server_default='weekly'),
        sa.Column('show_email_publicly', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('two_factor_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_user_settings_user_id')
    )
    op.create_index(op.f('ix_user_settings_user_id'), 'user_settings', ['user_id'], unique=False)

    # Create security_settings table
    op.create_table('security_settings',
        sa.Column('password_min_length', sa.Integer(), nullable=False, server_default='8'),
        sa.Column('password_require_uppercase', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('password_require_lowercase', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('password_require_numbers', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('password_require_special_chars', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('password_expiration_days', sa.Integer(), nullable=True),
        sa.Column('password_history_count', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('session_timeout_minutes', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('max_concurrent_sessions', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('require_password_change_on_first_login', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('lockout_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('lockout_threshold_attempts', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('lockout_duration_minutes', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('ip_whitelist_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('two_factor_required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('two_factor_grace_period_days', sa.Integer(), nullable=False, server_default='7'),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create client_default_settings table
    op.create_table('client_default_settings',
        sa.Column('default_payment_day', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('default_honorario_amount', sa.Float(), nullable=True),
        sa.Column('default_obligation_template_ids', sa.Text(), nullable=True),
        sa.Column('default_cnae_ids', sa.Text(), nullable=True),
        sa.Column('default_client_status', sa.String(length=50), nullable=False, server_default='ativo'),
        sa.Column('default_notification_template', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create permissions table
    op.create_table('permissions',
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_permissions_name'),
        sa.UniqueConstraint('code', name='uq_permissions_code')
    )
    op.create_index(op.f('ix_permissions_name'), 'permissions', ['name'], unique=False)
    op.create_index(op.f('ix_permissions_category'), 'permissions', ['category'], unique=False)
    op.create_index(op.f('ix_permissions_code'), 'permissions', ['code'], unique=False)

    # Create role_permissions table
    op.create_table('role_permissions',
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('permission_id', sa.UUID(), nullable=False),
        sa.Column('granted', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ),
        sa.PrimaryKeyConstraint('role', 'permission_id'),
        sa.UniqueConstraint('role', 'permission_id', name='uq_role_permission')
    )
    op.create_index(op.f('ix_role_permissions_permission_id'), 'role_permissions', ['permission_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_role_permissions_permission_id'), table_name='role_permissions')
    op.drop_table('role_permissions')
    op.drop_index(op.f('ix_permissions_code'), table_name='permissions')
    op.drop_index(op.f('ix_permissions_category'), table_name='permissions')
    op.drop_index(op.f('ix_permissions_name'), table_name='permissions')
    op.drop_table('permissions')
    op.drop_table('client_default_settings')
    op.drop_table('security_settings')
    op.drop_index(op.f('ix_user_settings_user_id'), table_name='user_settings')
    op.drop_table('user_settings')
    op.drop_table('system_settings')

    # Drop enums
    sa.Enum(name='language_code').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='theme_mode').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='permission_category').drop(op.get_bind(), checkfirst=True)
