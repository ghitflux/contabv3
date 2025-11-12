"""
Notification model for user notifications.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.models.base import Base
from app.schemas.notification import NotificationType


class Notification(Base):
    """
    Notification model.
    Stores notifications for users.
    """

    __tablename__ = "notifications"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Foreign key
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Usuário destinatário",
    )

    # Notification details
    type = Column(
        Enum(
            NotificationType,
            name="notificationtype",
            values_callable=lambda enum: [member.value for member in enum],
            validate_strings=True,
        ),
        nullable=False,
        index=True,
        comment="Tipo de notificação",
    )
    title = Column(String(200), nullable=False, comment="Título da notificação")
    message = Column(Text, nullable=False, comment="Mensagem da notificação")
    link = Column(String(500), nullable=True, comment="Link relacionado")
    extra_data = Column(
        JSONB, nullable=True, comment="Dados adicionais (JSON)"
    )

    # Read status
    read = Column(Boolean, default=False, nullable=False, index=True, comment="Lida?")
    read_at = Column(
        DateTime(timezone=True), nullable=True, comment="Data/hora de leitura"
    )

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        comment="Data de criação",
    )

    # Relationships
    user = relationship("User", back_populates="notifications")

    # Table arguments (composite indexes)
    __table_args__ = (
        Index("idx_notifications_user_unread", "user_id", "read", "created_at"),
        Index("idx_notifications_user_type", "user_id", "type"),
    )

    def __repr__(self):
        return f"<Notification {self.id}: {self.type} - {'read' if self.read else 'unread'}>"

    def mark_as_read(self) -> None:
        """Mark notification as read."""
        if not self.read:
            self.read = True
            self.read_at = datetime.utcnow()

    def mark_as_unread(self) -> None:
        """Mark notification as unread."""
        if self.read:
            self.read = False
            self.read_at = None

    @classmethod
    def create_notification(
        cls,
        user_id: UUID,
        notification_type: NotificationType,
        title: str,
        message: str,
        link: str | None = None,
        extra_data: dict | None = None,
    ) -> "Notification":
        """
        Factory method to create a notification.

        Args:
            user_id: User ID to send notification to
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            link: Optional link
            extra_data: Optional extra data (metadata)

        Returns:
            Notification: New notification instance
        """
        return cls(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            link=link,
            extra_data=extra_data,
        )

    @staticmethod
    def create_obligation_notification(
        user_id: UUID,
        notification_type: NotificationType,
        obligation: "Obligation",
        title: str | None = None,
        message: str | None = None,
    ) -> "Notification":
        """
        Helper to create obligation-related notification.

        Args:
            user_id: User ID
            notification_type: Notification type
            obligation: Obligation instance
            title: Optional custom title
            message: Optional custom message

        Returns:
            Notification: New notification instance
        """
        # Default titles and messages based on type
        if not title:
            if notification_type == NotificationType.OBLIGATION_CREATED:
                title = "Nova Obrigação"
            elif notification_type == NotificationType.OBLIGATION_DUE_SOON:
                title = "Obrigação Próxima ao Vencimento"
            elif notification_type == NotificationType.OBLIGATION_OVERDUE:
                title = "Obrigação Atrasada"
            elif notification_type == NotificationType.OBLIGATION_COMPLETED:
                title = "Obrigação Concluída"
            else:
                title = "Atualização de Obrigação"

        if not message:
            ob_type_name = obligation.obligation_type.name
            client_name = obligation.client.razao_social
            due_date = obligation.due_date.strftime("%d/%m/%Y")

            if notification_type == NotificationType.OBLIGATION_CREATED:
                message = f"{ob_type_name} criada para {client_name}"
            elif notification_type == NotificationType.OBLIGATION_DUE_SOON:
                days = obligation.days_until_due
                message = f"{ob_type_name} vence em {days} dia(s) - {client_name}"
            elif notification_type == NotificationType.OBLIGATION_OVERDUE:
                message = f"{ob_type_name} atrasada desde {due_date} - {client_name}"
            elif notification_type == NotificationType.OBLIGATION_COMPLETED:
                message = f"{ob_type_name} concluída para {client_name}"
            else:
                message = f"{ob_type_name} - {client_name}"

        extra_data = {
            "obligation_id": str(obligation.id),
            "client_id": str(obligation.client_id),
            "client_name": obligation.client.razao_social,
            "obligation_type": obligation.obligation_type.code,
            "due_date": obligation.due_date.isoformat(),
            "status": obligation.status.value,
        }

        link = f"/obrigacoes/{obligation.id}"

        return Notification.create_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            extra_data=extra_data,
        )
