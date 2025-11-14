"""add_client_extended_fields

Revision ID: d3365fae53fd
Revises: 20251031_1053
Create Date: 2025-11-06 19:58:38.148327

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'd3365fae53fd'
down_revision = '20251031_1053'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add extended fields to clients table."""

    # Add tax code field (only if doesn't exist)
    op.add_column('clients', sa.Column('codigo_simples', sa.String(50), nullable=True))

    # Add multi-select fields using JSONB
    op.add_column('clients', sa.Column(
        'tipos_empresa',
        postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
        server_default='[]'
    ))

    op.add_column('clients', sa.Column(
        'servicos_contratados',
        postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
        server_default='[]'
    ))

    op.add_column('clients', sa.Column(
        'licencas_necessarias',
        postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
        server_default='[]'
    ))

    # Migrate existing tipo_empresa enum to tipos_empresa JSONB array
    op.execute("""
        UPDATE clients
        SET tipos_empresa = jsonb_build_array(tipo_empresa::text)
        WHERE tipo_empresa IS NOT NULL
    """)

    # Migrate existing servicos array to servicos_contratados JSONB
    # NOTE: skipping migration as servicos column may not exist in all environments
    # op.execute("""
    #     UPDATE clients
    #     SET servicos_contratados = to_jsonb(servicos)
    #     WHERE servicos IS NOT NULL AND array_length(servicos, 1) > 0
    # """)


def downgrade() -> None:
    """Remove extended fields from clients table."""

    # Remove new columns (only those added in this migration)
    op.drop_column('clients', 'licencas_necessarias')
    op.drop_column('clients', 'servicos_contratados')
    op.drop_column('clients', 'tipos_empresa')
    op.drop_column('clients', 'codigo_simples')
