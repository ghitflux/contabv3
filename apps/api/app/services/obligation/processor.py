"""Obligation Processor Service - Handles obligation completion and receipt processing."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.obligation import Obligation, ObligationStatus
from app.db.models.obligation_event import ObligationEvent, ObligationEventType
from app.db.repositories.obligation import ObligationRepository
from app.db.repositories.obligation_event import ObligationEventRepository
from app.websockets.manager import ConnectionManager


class ObligationProcessor:
    """Service for processing obligation receipts and status changes."""

    def __init__(
        self,
        db: AsyncSession,
        ws_manager: Optional[ConnectionManager] = None,
    ):
        self.db = db
        self.obligation_repo = ObligationRepository(db)
        self.event_repo = ObligationEventRepository(db)
        self.ws_manager = ws_manager

    async def process_receipt(
        self,
        obligation_id: UUID,
        receipt_url: str,
        processed_by_id: UUID,
        notes: Optional[str] = None,
    ) -> Obligation:
        """
        Process obligation receipt and mark as completed.

        Args:
            obligation_id: ID of the obligation to process
            receipt_url: URL of the uploaded receipt document
            processed_by_id: ID of the user processing the receipt
            notes: Optional notes about the receipt

        Returns:
            Updated obligation

        Raises:
            HTTPException: If obligation not found or already completed
        """
        # Get obligation with relationships
        obligation = await self.obligation_repo.get_by_id_with_relations(obligation_id)
        if not obligation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Obligation not found",
            )

        # Validate current status
        if obligation.status == ObligationStatus.CONCLUIDA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Obligation already completed",
            )

        if obligation.status == ObligationStatus.CANCELADA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot process receipt for cancelled obligation",
            )

        # Update obligation status
        now = datetime.utcnow()
        obligation = await self.obligation_repo.update_status(
            obligation_id=obligation_id,
            status=ObligationStatus.CONCLUIDA,
            completed_at=now,
            receipt_url=receipt_url,
            processed_by_id=processed_by_id,
        )

        # Create event
        event = ObligationEvent(
            obligation_id=obligation_id,
            event_type=ObligationEventType.RECEIPT_UPLOADED,
            description=f"Receipt uploaded and obligation marked as completed{f': {notes}' if notes else ''}",
            user_id=processed_by_id,
            extra_data={
                "receipt_url": receipt_url,
                "completed_at": now.isoformat(),
                "notes": notes,
            },
        )
        await self.event_repo.create(event)

        await self.db.commit()
        await self.db.refresh(obligation)

        # Send WebSocket notification
        if self.ws_manager:
            await self._send_websocket_notification(obligation, processed_by_id)

        return obligation

    async def mark_as_pending(
        self,
        obligation_id: UUID,
        performed_by_id: UUID,
        notes: Optional[str] = None,
    ) -> Obligation:
        """Mark obligation back as pending (undo completion)."""
        obligation = await self.obligation_repo.get(obligation_id)
        if not obligation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Obligation not found",
            )

        # Update to pending
        obligation = await self.obligation_repo.update_status(
            obligation_id=obligation_id,
            status=ObligationStatus.PENDENTE,
            completed_at=None,
            receipt_url=None,
            processed_by_id=None,
        )

        # Create event
        event = ObligationEvent(
            obligation_id=obligation_id,
            event_type=ObligationEventType.STATUS_CHANGED,
            description=f"Obligation marked as pending{f': {notes}' if notes else ''}",
            user_id=performed_by_id,
            extra_data={
                "new_status": ObligationStatus.PENDENTE.value,
                "notes": notes,
            },
        )
        await self.event_repo.create(event)

        await self.db.commit()
        await self.db.refresh(obligation)

        return obligation

    async def cancel_obligation(
        self,
        obligation_id: UUID,
        reason: str,
        performed_by_id: UUID,
    ) -> Obligation:
        """Cancel an obligation."""
        obligation = await self.obligation_repo.get(obligation_id)
        if not obligation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Obligation not found",
            )

        if obligation.status == ObligationStatus.CONCLUIDA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel completed obligation",
            )

        # Update to cancelled
        obligation = await self.obligation_repo.update_status(
            obligation_id=obligation_id,
            status=ObligationStatus.CANCELADA,
        )

        # Create event
        event = ObligationEvent(
            obligation_id=obligation_id,
            event_type=ObligationEventType.CANCELED,
            description=f"Obligation cancelled: {reason}",
            user_id=performed_by_id,
            extra_data={
                "reason": reason,
            },
        )
        await self.event_repo.create(event)

        await self.db.commit()
        await self.db.refresh(obligation)

        return obligation

    async def update_due_date(
        self,
        obligation_id: UUID,
        new_due_date: datetime,
        reason: str,
        performed_by_id: UUID,
    ) -> Obligation:
        """Update obligation due date."""
        obligation = await self.obligation_repo.get(obligation_id)
        if not obligation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Obligation not found",
            )

        if obligation.status == ObligationStatus.CONCLUIDA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update due date of completed obligation",
            )

        old_due_date = obligation.due_date
        obligation.due_date = new_due_date

        # Create event
        event = ObligationEvent(
            obligation_id=obligation_id,
            event_type=ObligationEventType.DUE_DATE_CHANGED,
            description=f"Due date changed from {old_due_date.strftime('%Y-%m-%d')} to {new_due_date.strftime('%Y-%m-%d')}: {reason}",
            user_id=performed_by_id,
            extra_data={
                "old_due_date": old_due_date.isoformat(),
                "new_due_date": new_due_date.isoformat(),
                "reason": reason,
            },
        )
        await self.event_repo.create(event)

        await self.db.commit()
        await self.db.refresh(obligation)

        return obligation

    async def _send_websocket_notification(self, obligation: Obligation, user_id: UUID):
        """Send WebSocket notification about obligation update."""
        if not self.ws_manager:
            return

        try:
            message = {
                "type": "obligation.completed",
                "data": {
                    "obligation_id": str(obligation.id),
                    "client_id": str(obligation.client_id),
                    "obligation_type": obligation.obligation_type.name if obligation.obligation_type else None,
                    "status": obligation.status.value,
                    "completed_at": obligation.completed_at.isoformat() if obligation.completed_at else None,
                },
            }

            # Send to client if connected
            await self.ws_manager.send_to_user(str(obligation.client_id), message)

            # Send to all admins/functionaries
            await self.ws_manager.broadcast(message, exclude_user=str(user_id))
        except Exception as e:
            # Log error but don't fail the operation
            print(f"Error sending WebSocket notification: {e}")
