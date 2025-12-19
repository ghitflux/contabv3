"""
License service with business logic.
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.license import License
from app.db.repositories.license import LicenseRepository
from app.schemas.license import LicenseCreate, LicenseEventType, LicenseRenewal, LicenseResponse, LicenseStatus, LicenseUpdate


class LicenseService:
    """Service for license operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize license service.

        Args:
            session: Database session
        """
        self.session = session
        self.repo = LicenseRepository(session)

    async def create_license(self, license_data: LicenseCreate, user_id: Optional[UUID] = None) -> LicenseResponse:
        """
        Create a new license.

        Args:
            license_data: License creation data
            user_id: Optional user ID who creates the license

        Returns:
            Created license
        """
        # Determine initial status
        initial_status = LicenseStatus.ATIVA
        if license_data.expiration_date:
            if license_data.expiration_date < date.today():
                initial_status = LicenseStatus.VENCIDA
            elif (license_data.expiration_date - date.today()).days <= 30:
                initial_status = LicenseStatus.PENDENTE_RENOVACAO

        # Create license
        license_obj = License(
            client_id=license_data.client_id,
            license_type=license_data.license_type,
            registration_number=license_data.registration_number,
            issuing_authority=license_data.issuing_authority,
            issue_date=license_data.issue_date,
            expiration_date=license_data.expiration_date,
            status=initial_status,
            notes=license_data.notes,
        )

        license_obj = await self.repo.create(license_obj)
        await self.session.flush()

        # Add creation event
        await self.repo.add_event(
            license_id=license_obj.id,
            event_type=LicenseEventType.CREATED,
            description=f"Licença criada: {license_obj.registration_number}",
            user_id=user_id,
        )

        await self.session.commit()
        await self.session.refresh(license_obj)

        return self._to_response(license_obj)

    async def update_license(
        self,
        license_id: UUID,
        license_data: LicenseUpdate,
        user_id: Optional[UUID] = None,
    ) -> LicenseResponse:
        """
        Update a license.

        Args:
            license_id: License ID
            license_data: Update data
            user_id: Optional user ID who updates the license

        Returns:
            Updated license

        Raises:
            HTTPException: If license not found
        """
        license_obj = await self.repo.get_by_id(license_id)
        if not license_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="License not found"
            )

        # Update fields
        update_data = license_data.model_dump(exclude_unset=True)

        # Recalculate status if expiration_date changed
        if "expiration_date" in update_data or "status" not in update_data:
            new_expiration = update_data.get("expiration_date", license_obj.expiration_date)
            if new_expiration:
                if new_expiration < date.today():
                    update_data["status"] = LicenseStatus.VENCIDA
                elif (new_expiration - date.today()).days <= 30:
                    if license_obj.status != LicenseStatus.CANCELADA:
                        update_data["status"] = LicenseStatus.PENDENTE_RENOVACAO
                else:
                    if license_obj.status not in [LicenseStatus.CANCELADA, LicenseStatus.SUSPENSA]:
                        update_data["status"] = LicenseStatus.ATIVA

        for key, value in update_data.items():
            setattr(license_obj, key, value)

        await self.session.flush()

        # Add update event
        await self.repo.add_event(
            license_id=license_obj.id,
            event_type=LicenseEventType.UPDATED,
            description="Informações da licença atualizadas",
            user_id=user_id,
        )

        await self.session.commit()
        await self.session.refresh(license_obj)

        return self._to_response(license_obj)

    async def renew_license(
        self,
        license_id: UUID,
        renewal_data: LicenseRenewal,
        user_id: Optional[UUID] = None,
    ) -> LicenseResponse:
        """
        Renew a license.

        Args:
            license_id: License ID
            renewal_data: Renewal data
            user_id: Optional user ID who renews the license

        Returns:
            Renewed license

        Raises:
            HTTPException: If license not found
        """
        license_obj = await self.repo.get_by_id(license_id)
        if not license_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="License not found"
            )

        # Update license with renewal data
        license_obj.issue_date = renewal_data.new_issue_date
        if renewal_data.new_expiration_date:
            license_obj.expiration_date = renewal_data.new_expiration_date
        if renewal_data.new_registration_number:
            license_obj.registration_number = renewal_data.new_registration_number

        # Update status
        if license_obj.expiration_date:
            if (license_obj.expiration_date - date.today()).days <= 30:
                license_obj.status = LicenseStatus.PENDENTE_RENOVACAO
            else:
                license_obj.status = LicenseStatus.ATIVA
        else:
            license_obj.status = LicenseStatus.ATIVA

        if renewal_data.notes:
            existing_notes = license_obj.notes or ""
            license_obj.notes = f"{existing_notes}\n[Renovação] {renewal_data.notes}".strip()

        await self.session.flush()

        # Add renewal event
        await self.repo.add_event(
            license_id=license_obj.id,
            event_type=LicenseEventType.RENEWED,
            description=f"Licença renovada. Nova data de vencimento: {renewal_data.new_expiration_date or 'N/A'}",
            user_id=user_id,
        )

        await self.session.commit()
        await self.session.refresh(license_obj)

        return self._to_response(license_obj)

    async def delete_license(self, license_id: UUID, user_id: Optional[UUID] = None) -> None:
        """
        Delete a license (soft delete by setting status to CANCELADA).

        Args:
            license_id: License ID
            user_id: Optional user ID who deletes the license

        Raises:
            HTTPException: If license not found
        """
        license_obj = await self.repo.get_by_id(license_id)
        if not license_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="License not found"
            )

        license_obj.status = LicenseStatus.CANCELADA
        await self.session.flush()

        # Add cancellation event
        await self.repo.add_event(
            license_id=license_obj.id,
            event_type=LicenseEventType.CANCELLED,
            description="Licença cancelada",
            user_id=user_id,
        )

        await self.session.commit()

    async def check_expirations(self, days: int = 30) -> dict:
        """
        Check for expiring licenses.

        Args:
            days: Number of days to look ahead (default: 30)

        Returns:
            Dictionary with expiring and expired licenses
        """
        expiring = await self.repo.get_expiring_soon(days)
        expired = await self.repo.get_expired()

        return {
            "expiring": [self._to_response(lic) for lic in expiring],
            "expired": [self._to_response(lic) for lic in expired],
        }

    def _to_response(self, license_obj: License) -> LicenseResponse:
        """
        Convert License model to LicenseResponse.

        Args:
            license_obj: License model

        Returns:
            LicenseResponse
        """
        today = date.today()
        days_until_expiration = None
        is_expired = False
        is_expiring_soon = False

        if license_obj.expiration_date:
            days_until_expiration = (license_obj.expiration_date - today).days
            is_expired = days_until_expiration < 0
            is_expiring_soon = 0 <= days_until_expiration <= 30

        return LicenseResponse(
            id=license_obj.id,
            client_id=license_obj.client_id,
            license_type=license_obj.license_type,
            registration_number=license_obj.registration_number,
            issuing_authority=license_obj.issuing_authority,
            issue_date=license_obj.issue_date,
            expiration_date=license_obj.expiration_date,
            status=license_obj.status,
            notes=license_obj.notes,
            created_at=license_obj.created_at,
            updated_at=license_obj.updated_at,
            days_until_expiration=days_until_expiration,
            is_expired=is_expired,
            is_expiring_soon=is_expiring_soon,
        )

