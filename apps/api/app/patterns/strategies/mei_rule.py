"""
Obligation rules for MEI (Microempreendedor Individual).
"""

from typing import List

from app.db.models.client import Client
from app.patterns.strategies.base import DEPARTAMENTO_PESSOAL_CODES, ObligationRule


class MEIRule(ObligationRule):
    """
    Obligation rules for MEI.

    MEI has simplified obligations regardless of activity type.
    """

    def get_applicable_type_codes(self, client: Client) -> List[str]:
        """
        Get applicable obligation types for MEI clients.

        MEI has very few obligations, regardless of commerce/service/industry.

        Args:
            client: Client instance

        Returns:
            List of obligation type codes
        """
        codes = [
            "DAS_MEI_MENSAL",
            "DASN_SIMEI_ANUAL",
        ]

        codes.extend(DEPARTAMENTO_PESSOAL_CODES)

        return codes
