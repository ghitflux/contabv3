"""Seed office client placeholder row

Revision ID: 20260127_1210_office_client
Revises: 20260127_1200_honorarios_auto
Create Date: 2026-01-27 12:10:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260127_1210_office_client"
down_revision = "20260127_1200_honorarios_auto"
branch_labels = None
depends_on = None


OFFICE_CLIENT_ID = "522d5b00-2a4d-4f5a-8913-5d4ee0cf8104"


def upgrade() -> None:
    # Ensure a stable "office" client exists for office financial transactions.
    # It is soft-deleted (deleted_at not null) so it won't appear in normal client lists.
    op.execute(
        f"""
        INSERT INTO clients (
          id,
          razao_social,
          nome_fantasia,
          cnpj,
          email,
          honorarios_mensais,
          dia_vencimento,
          regime_tributario,
          tipo_empresa,
          status,
          deleted_at
        )
        VALUES (
          '{OFFICE_CLIENT_ID}'::uuid,
          'Contabil Consult - Escritório',
          'Escritório',
          'OFFICE-CLIENT-001',
          'escritorio@contabil.consult',
          0,
          10,
          'SIMPLES_NACIONAL',
          'FINANCEIRO',
          'INATIVO',
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(f"DELETE FROM clients WHERE id = '{OFFICE_CLIENT_ID}'::uuid")

