"""add_client_credential_fields_cpf_gov_nfse_cert

Revision ID: ff2122bfb7ca
Revises: 42786cd90859
Create Date: 2025-12-03 11:27:31.363094

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ff2122bfb7ca'
down_revision = '42786cd90859'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add additional credential fields to clients table."""
    # Add CPF and government access credentials
    op.add_column('clients', sa.Column('cpf_empresa', sa.String(14), nullable=True))
    op.add_column('clients', sa.Column('senha_gov', sa.String(255), nullable=True))

    # Add unemployment insurance email
    op.add_column('clients', sa.Column('email_seg_desemp', sa.String(255), nullable=True))

    # Add NFS-e and digital certificate passwords
    op.add_column('clients', sa.Column('senha_nfse', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('senha_certificado_digital', sa.String(255), nullable=True))


def downgrade() -> None:
    """Remove additional credential fields from clients table."""
    op.drop_column('clients', 'senha_certificado_digital')
    op.drop_column('clients', 'senha_nfse')
    op.drop_column('clients', 'email_seg_desemp')
    op.drop_column('clients', 'senha_gov')
    op.drop_column('clients', 'cpf_empresa')
