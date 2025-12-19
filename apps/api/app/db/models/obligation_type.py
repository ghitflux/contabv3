"""
ObligationType model for storing obligation type definitions.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.models.base import Base
from app.schemas.obligation import ObligationRecurrence


class ObligationType(Base):
    """
    Obligation Type model.
    Defines types of fiscal obligations with their generation rules.
    """

    __tablename__ = "obligation_types"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Basic info
    name = Column(String(200), nullable=False, comment="Nome da obrigação")
    code = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Código único (ex: DAS_MENSAL)",
    )
    description = Column(Text, nullable=True, comment="Descrição detalhada")

    # Applicability filters - Tipo de empresa
    applies_to_commerce = Column(
        Boolean, default=False, comment="Aplica para comércio"
    )
    applies_to_service = Column(
        Boolean, default=False, comment="Aplica para serviços"
    )
    applies_to_industry = Column(
        Boolean, default=False, comment="Aplica para indústria"
    )
    applies_to_mei = Column(Boolean, default=False, comment="Aplica para MEI")

    # Applicability filters - Regime tributário
    applies_to_simples = Column(
        Boolean, default=False, comment="Aplica para Simples Nacional"
    )
    applies_to_presumido = Column(
        Boolean, default=False, comment="Aplica para Lucro Presumido"
    )
    applies_to_real = Column(
        Boolean, default=False, comment="Aplica para Lucro Real"
    )

    # Generation settings
    recurrence = Column(
        SQLEnum(
            ObligationRecurrence,
            name="obligationrecurrence",
            create_type=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in ObligationRecurrence]
        ),
        nullable=False,
        comment="Periodicidade (mensal, trimestral, etc)",
    )
    day_of_month = Column(
        Integer, nullable=True, comment="Dia do mês para vencimento (1-31)"
    )
    month_of_year = Column(
        Integer, nullable=True, comment="Mês do ano para obrigações anuais (1-12)"
    )

    # Status
    is_active = Column(Boolean, default=True, index=True, comment="Ativo/Inativo")

    # Timestamps
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<ObligationType {self.code}: {self.name}>"

    def applies_to_client(self, client) -> bool:
        """
        Check if this obligation type applies to a given client.

        Args:
            client: Client model instance

        Returns:
            bool: True if applicable, False otherwise
        """
        tipo_empresa = getattr(client.tipo_empresa, "value", client.tipo_empresa)
        regime = getattr(client.regime_tributario, "value", client.regime_tributario)

        if regime == "mei":
            return self.applies_to_mei

        if tipo_empresa == "financeiro":
            tipo_empresa = "servico"

        # Check tipo_empresa
        tipo_empresa_match = False
        if tipo_empresa == "comercio" and self.applies_to_commerce:
            tipo_empresa_match = True
        elif tipo_empresa == "servico" and self.applies_to_service:
            tipo_empresa_match = True
        elif tipo_empresa == "industria" and self.applies_to_industry:
            tipo_empresa_match = True
        elif tipo_empresa == "misto" and (
            self.applies_to_commerce or self.applies_to_service
        ):
            tipo_empresa_match = True

        if not tipo_empresa_match:
            return False

        # Check regime_tributario
        if regime == "simples_nacional":
            return self.applies_to_simples
        if regime == "lucro_presumido":
            return self.applies_to_presumido
        if regime == "lucro_real":
            return self.applies_to_real

        return False
