"""Consolidate finance bank accounts into one cash account per scope.

Revision ID: 20260424_single_cash
Revises: 20260423_client_obl_type_ids
Create Date: 2026-04-24 09:00:00
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260424_single_cash"
down_revision = "20260423_client_obl_type_ids"
branch_labels = None
depends_on = None

OFFICE_CLIENT_ID = "522d5b00-2a4d-4f5a-8913-5d4ee0cf8104"


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.execute(
        f"""
        DO $$
        DECLARE
            office_id uuid := '{OFFICE_CLIENT_ID}'::uuid;
            office_cash_id uuid;
        BEGIN
            SELECT id
              INTO office_cash_id
              FROM bank_accounts
             WHERE client_id IS NULL
             ORDER BY created_at ASC, id ASC
             LIMIT 1;

            IF office_cash_id IS NULL THEN
                SELECT id
                  INTO office_cash_id
                  FROM bank_accounts
                 WHERE client_id = office_id
                 ORDER BY created_at ASC, id ASC
                 LIMIT 1;

                IF office_cash_id IS NOT NULL THEN
                    UPDATE bank_accounts
                       SET client_id = NULL,
                           name = COALESCE(NULLIF(name, ''), 'Caixa do Escritório'),
                           account_number = COALESCE(NULLIF(account_number, ''), 'CAIXA-ESCRITORIO'),
                           updated_at = now()
                     WHERE id = office_cash_id;
                END IF;
            END IF;

            IF office_cash_id IS NULL THEN
                INSERT INTO bank_accounts (
                    id,
                    client_id,
                    name,
                    account_number,
                    balance,
                    accounting_account,
                    created_at,
                    updated_at
                )
                VALUES (
                    gen_random_uuid(),
                    NULL,
                    'Caixa do Escritório',
                    'CAIXA-ESCRITORIO',
                    0,
                    NULL,
                    now(),
                    now()
                )
                RETURNING id INTO office_cash_id;
            END IF;
        END $$;
        """
    )

    op.execute(
        f"""
        INSERT INTO bank_accounts (
            id,
            client_id,
            name,
            account_number,
            balance,
            accounting_account,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid(),
            c.id,
            'Caixa do Cliente',
            'CAIXA-' || left(c.id::text, 8),
            0,
            NULL,
            now(),
            now()
          FROM clients c
         WHERE c.id <> '{OFFICE_CLIENT_ID}'::uuid
           AND NOT EXISTS (
                SELECT 1
                  FROM bank_accounts ba
                 WHERE ba.client_id = c.id
           )
        """
    )

    op.execute(
        f"""
        WITH office_canonical AS (
            SELECT id
              FROM bank_accounts
             WHERE client_id IS NULL OR client_id = '{OFFICE_CLIENT_ID}'::uuid
             ORDER BY
                CASE WHEN client_id IS NULL THEN 0 ELSE 1 END,
                created_at ASC,
                id ASC
             LIMIT 1
        ),
        office_sum AS (
            SELECT COALESCE(SUM(balance), 0) AS total_balance
              FROM bank_accounts
             WHERE client_id IS NULL OR client_id = '{OFFICE_CLIENT_ID}'::uuid
        )
        UPDATE bank_accounts ba
           SET client_id = NULL,
               name = COALESCE(NULLIF(ba.name, ''), 'Caixa do Escritório'),
               account_number = COALESCE(NULLIF(ba.account_number, ''), 'CAIXA-ESCRITORIO'),
               balance = office_sum.total_balance,
               updated_at = now()
          FROM office_canonical, office_sum
         WHERE ba.id = office_canonical.id;
        """
    )

    op.execute(
        f"""
        WITH canonical AS (
            SELECT DISTINCT ON (client_id)
                   client_id,
                   id
              FROM bank_accounts
             WHERE client_id IS NOT NULL
               AND client_id <> '{OFFICE_CLIENT_ID}'::uuid
             ORDER BY client_id, created_at ASC, id ASC
        ),
        totals AS (
            SELECT client_id, COALESCE(SUM(balance), 0) AS total_balance
              FROM bank_accounts
             WHERE client_id IS NOT NULL
               AND client_id <> '{OFFICE_CLIENT_ID}'::uuid
             GROUP BY client_id
        )
        UPDATE bank_accounts ba
           SET name = COALESCE(NULLIF(ba.name, ''), 'Caixa do Cliente'),
               account_number = COALESCE(NULLIF(ba.account_number, ''), 'CAIXA-' || left(ba.client_id::text, 8)),
               balance = totals.total_balance,
               updated_at = now()
          FROM canonical
          JOIN totals ON totals.client_id = canonical.client_id
         WHERE ba.id = canonical.id;
        """
    )

    op.execute(
        f"""
        WITH office_canonical AS (
            SELECT id
              FROM bank_accounts
             WHERE client_id IS NULL
             ORDER BY created_at ASC, id ASC
             LIMIT 1
        )
        UPDATE financial_transactions ft
           SET bank_account_id = office_canonical.id
          FROM office_canonical
         WHERE ft.client_id = '{OFFICE_CLIENT_ID}'::uuid;
        """
    )

    op.execute(
        f"""
        WITH office_canonical AS (
            SELECT id
              FROM bank_accounts
             WHERE client_id IS NULL
             ORDER BY created_at ASC, id ASC
             LIMIT 1
        )
        UPDATE statement_imports si
           SET bank_account_id = office_canonical.id
          FROM office_canonical
         WHERE si.client_id = '{OFFICE_CLIENT_ID}'::uuid;
        """
    )

    op.execute(
        f"""
        WITH canonical AS (
            SELECT DISTINCT ON (client_id)
                   client_id,
                   id
              FROM bank_accounts
             WHERE client_id IS NOT NULL
               AND client_id <> '{OFFICE_CLIENT_ID}'::uuid
             ORDER BY client_id, created_at ASC, id ASC
        )
        UPDATE financial_transactions ft
           SET bank_account_id = canonical.id
          FROM canonical
         WHERE ft.client_id = canonical.client_id
           AND ft.client_id <> '{OFFICE_CLIENT_ID}'::uuid;
        """
    )

    op.execute(
        f"""
        WITH canonical AS (
            SELECT DISTINCT ON (client_id)
                   client_id,
                   id
              FROM bank_accounts
             WHERE client_id IS NOT NULL
               AND client_id <> '{OFFICE_CLIENT_ID}'::uuid
             ORDER BY client_id, created_at ASC, id ASC
        )
        UPDATE statement_imports si
           SET bank_account_id = canonical.id
          FROM canonical
         WHERE si.client_id = canonical.client_id
           AND si.client_id <> '{OFFICE_CLIENT_ID}'::uuid;
        """
    )

    op.execute(
        f"""
        WITH office_canonical AS (
            SELECT id
              FROM bank_accounts
             WHERE client_id IS NULL
             ORDER BY created_at ASC, id ASC
             LIMIT 1
        )
        DELETE FROM bank_accounts ba
         USING office_canonical
         WHERE (ba.client_id IS NULL OR ba.client_id = '{OFFICE_CLIENT_ID}'::uuid)
           AND ba.id <> office_canonical.id;
        """
    )

    op.execute(
        f"""
        WITH canonical AS (
            SELECT DISTINCT ON (client_id)
                   client_id,
                   id
              FROM bank_accounts
             WHERE client_id IS NOT NULL
               AND client_id <> '{OFFICE_CLIENT_ID}'::uuid
             ORDER BY client_id, created_at ASC, id ASC
        )
        DELETE FROM bank_accounts ba
         USING canonical
         WHERE ba.client_id = canonical.client_id
           AND ba.id <> canonical.id;
        """
    )

    op.execute(
        """
        ALTER TABLE financial_transactions
        ALTER COLUMN bank_account_id SET NOT NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts_client_cash
            ON bank_accounts (client_id)
         WHERE client_id IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts_office_cash
            ON bank_accounts ((client_id IS NULL))
         WHERE client_id IS NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_bank_accounts_office_cash")
    op.execute("DROP INDEX IF EXISTS uq_bank_accounts_client_cash")
    op.execute(
        """
        ALTER TABLE financial_transactions
        ALTER COLUMN bank_account_id DROP NOT NULL
        """
    )

