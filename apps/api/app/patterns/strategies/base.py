"""
Base strategy for obligation rules.
"""

from abc import ABC, abstractmethod
import calendar
from datetime import date
from typing import List

from app.db.models.client import Client, RegimeTributario
from app.db.models.obligation_type import ObligationType
from app.schemas.obligation import ObligationPriority, ObligationRecurrence

DEPARTAMENTO_PESSOAL_CODES = [
    "FOLHA_PAGAMENTO_MENSAL",
    "ESOCIAL_MENSAL",
    "DCTF_WEB_MENSAL",
    "FGTS_MENSAL",
    "EFD_REINF_MENSAL",
    "MIT_MENSAL",
    "DECIMO_TERCEIRO_1_ANUAL",
    "DECIMO_TERCEIRO_2_ANUAL",
    "DCTF_WEB_13_ANUAL",
    "PARCELAMENTOS_MENSAL",
]


class ObligationRule(ABC):
    """
    Base class for obligation generation rules.

    Each concrete implementation defines rules for a specific
    type of company (commerce, service, industry, MEI).
    """

    @abstractmethod
    def get_applicable_type_codes(self, client: Client) -> List[str]:
        """
        Returns obligation type codes applicable to this client.

        Args:
            client: Client model instance

        Returns:
            List of obligation type codes (e.g., ["DAS_MENSAL", "DEFIS_ANUAL"])
        """
        pass

    def calculate_due_date(
        self,
        obligation_type: ObligationType,
        reference_month: date,
        client: Client,
    ) -> date:
        """
        Calculate due date for given type and month.

        Default implementation uses the day_of_month from obligation_type.
        Can be overridden for custom logic.

        Args:
            obligation_type: ObligationType instance
            reference_month: Reference month (first day)
            client: Client model instance

        Returns:
            Calculated due date
        """
        day = obligation_type.day_of_month or 20  # Default to 20th
        recurrence = getattr(obligation_type.recurrence, "value", obligation_type.recurrence)

        if obligation_type.code == "EFD_ICMS_IPI_MENSAL":
            regime = getattr(client.regime_tributario, "value", client.regime_tributario)
            if regime == RegimeTributario.SIMPLES_NACIONAL.value:
                day = 25

        if recurrence == ObligationRecurrence.ANUAL.value:
            year = reference_month.year
            month = obligation_type.month_of_year or reference_month.month
        else:
            year, month = self._next_month(reference_month)

        max_day = calendar.monthrange(year, month)[1]
        day = min(day, max_day)

        return date(year, month, day)

    def _next_month(self, reference_month: date) -> tuple[int, int]:
        """Return year/month for the next month."""
        if reference_month.month == 12:
            return reference_month.year + 1, 1
        return reference_month.year, reference_month.month + 1

    def get_priority(
        self,
        obligation_type: ObligationType,
        due_date: date
    ) -> ObligationPriority:
        """
        Calculate priority based on type and due date.

        Default implementation based on days until due.
        Can be overridden for custom logic.

        Args:
            obligation_type: ObligationType instance
            due_date: Due date

        Returns:
            Calculated priority
        """
        today = date.today()
        days_until_due = (due_date - today).days

        if days_until_due < 0:
            return ObligationPriority.URGENTE
        elif days_until_due <= 3:
            return ObligationPriority.ALTA
        elif days_until_due <= 7:
            return ObligationPriority.MEDIA
        else:
            return ObligationPriority.BAIXA

    def should_generate_for_client(self, client: Client) -> bool:
        """
        Check if obligations should be generated for this client.

        Default checks: client is active and not deleted.
        Can be overridden for additional checks.

        Args:
            client: Client instance

        Returns:
            True if should generate, False otherwise
        """
        from app.db.models.client import ClientStatus

        return (
            client.status in [ClientStatus.ATIVO, ClientStatus.INADIMPLENTE] and
            client.deleted_at is None
        )
