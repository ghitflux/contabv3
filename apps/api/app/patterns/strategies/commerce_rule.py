"""
Obligation rules for commerce companies.
"""

from typing import List

from app.db.models.client import Client, RegimeTributario
from app.patterns.strategies.base import DEPARTAMENTO_PESSOAL_CODES, ObligationRule


class CommerceRule(ObligationRule):
    """
    Obligation rules for commerce (comércio) companies.

    Defines which obligations apply based on tax regime.
    """

    def get_applicable_type_codes(self, client: Client) -> List[str]:
        """
        Get applicable obligation types for commerce clients.

        Args:
            client: Client instance

        Returns:
            List of obligation type codes
        """
        codes = []

        # Simples Nacional
        if client.regime_tributario == RegimeTributario.SIMPLES_NACIONAL:
            codes.extend([
                "PGDAS_MENSAL",
                "DAS_MENSAL",
                "EFD_CONTRIBUICOES",
                "EFD_ICMS_IPI_MENSAL",
                "DIEF_MENSAL",
                "ICMS_ANTECIPACAO_MENSAL",
            ])

        # Lucro Presumido
        elif client.regime_tributario == RegimeTributario.LUCRO_PRESUMIDO:
            codes.extend([
                "PIS_COFINS_MENSAL",
                "EFD_CONTRIBUICOES",
                "EFD_ICMS_IPI_MENSAL",
                "ICMS_NORMAL_MENSAL",
                "IRPJ_CSLL_TRIMESTRAL",
                "ECD_ANUAL",
                "ECF_ANUAL",
            ])

        # Lucro Real
        elif client.regime_tributario == RegimeTributario.LUCRO_REAL:
            codes.extend([
                "PIS_COFINS_MENSAL",
                "EFD_CONTRIBUICOES",
                "EFD_ICMS_IPI_MENSAL",
                "IRPJ_CSLL_TRIMESTRAL",
                "ECD_ANUAL",
                "ECF_ANUAL",
                "LALUR_ANUAL",
            ])

        # MEI
        elif client.regime_tributario == RegimeTributario.MEI:
            codes.extend([
                "DAS_MEI_MENSAL",
                "DASN_SIMEI_ANUAL",
            ])

        codes.extend(DEPARTAMENTO_PESSOAL_CODES)

        return codes
