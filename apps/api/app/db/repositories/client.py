"""
Client repository for database operations.
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa
from app.db.repositories.base import BaseRepository


class ClientRepository(BaseRepository[Client]):
    """Repository for Client model operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize client repository.

        Args:
            session: Database session
        """
        super().__init__(Client, session)

    async def get_by_cnpj(self, cnpj: str) -> Client | None:
        """
        Get client by CNPJ.

        Args:
            cnpj: Client CNPJ

        Returns:
            Client or None if not found
        """
        result = await self.session.execute(
            select(Client).where(
                and_(
                    Client.cnpj == cnpj,
                    Client.deleted_at.is_(None)
                )
            )
        )
        return result.scalar_one_or_none()

    async def cnpj_exists(self, cnpj: str, exclude_id: Optional[UUID] = None) -> bool:
        """
        Check if CNPJ already exists (excluding a specific ID).

        Args:
            cnpj: CNPJ to check
            exclude_id: Optional UUID to exclude from check (for updates)

        Returns:
            True if CNPJ exists, False otherwise
        """
        query = select(Client).where(
            and_(
                Client.cnpj == cnpj,
                Client.deleted_at.is_(None)
            )
        )

        if exclude_id:
            query = query.where(Client.id != exclude_id)

        result = await self.session.execute(query)
        return result.scalar_one_or_none() is not None

    async def list_with_filters(
        self,
        query: Optional[str] = None,
        status: Optional[ClientStatus] = None,
        starts_with: Optional[str] = None,
        regime_tributario: Optional[RegimeTributario] = None,
        tipo_empresa: Optional[TipoEmpresa] = None,
        skip: int = 0,
        limit: int = 10,
    ) -> tuple[list[Client], int]:
        """
        List clients with filters and pagination.

        Args:
            query: Search term for razao_social or CNPJ
            status: Filter by status
            starts_with: Filter by first letter of razao_social
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (clients list, total count)
        """
        # Base query - only non-deleted
        filters = [Client.deleted_at.is_(None)]

        # Apply search query
        if query:
            search_term = f"%{query}%"
            filters.append(
                or_(
                    Client.razao_social.ilike(search_term),
                    Client.nome_fantasia.ilike(search_term),
                    Client.cnpj.ilike(search_term),
                )
            )

        # Apply status filter
        if status:
            filters.append(Client.status == status)

        # Apply starts_with filter
        if starts_with and len(starts_with) == 1:
            filters.append(Client.razao_social.ilike(f"{starts_with}%"))

        if regime_tributario:
            filters.append(Client.regime_tributario == regime_tributario)

        if tipo_empresa:
            filters.append(Client.tipo_empresa == tipo_empresa)

        # Count query
        count_query = select(func.count()).select_from(Client).where(and_(*filters))
        total_result = await self.session.execute(count_query)
        total = total_result.scalar_one()

        # Data query with pagination
        data_query = (
            select(Client)
            .where(and_(*filters))
            .order_by(Client.razao_social)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(data_query)
        clients = list(result.scalars().all())

        return clients, total

    async def search(
        self,
        query: str,
        limit: int = 10,
    ) -> list[Client]:
        """
        Quick search for autocomplete.

        Args:
            query: Search term
            limit: Maximum number of results

        Returns:
            List of matching clients
        """
        search_term = f"%{query}%"
        result = await self.session.execute(
            select(Client)
            .where(
                and_(
                    Client.deleted_at.is_(None),
                    or_(
                        Client.razao_social.ilike(search_term),
                        Client.nome_fantasia.ilike(search_term),
                        Client.cnpj.ilike(search_term),
                    ),
                )
            )
            .order_by(Client.razao_social)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_active_clients(self, skip: int = 0, limit: int = 100) -> list[Client]:
        """
        Get all active clients.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of active clients
        """
        result = await self.session.execute(
            select(Client)
            .where(
                and_(
                    Client.status == ClientStatus.ATIVO,
                    Client.deleted_at.is_(None)
                )
            )
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_user_id(self, user_id: UUID, user_email: str | None = None) -> Client | None:
        """
        Get client associated with a user account.

        Args:
            user_id: User ID
            user_email: Optional email fallback for legacy data

        Returns:
            Client or None if not found
        """
        result = await self.session.execute(
            select(Client).where(
                and_(
                    Client.user_id == user_id,
                    Client.deleted_at.is_(None)
                )
            )
        )
        client = result.scalar_one_or_none()

        if not client and user_email:
            result = await self.session.execute(
                select(Client).where(
                    and_(
                        Client.email == user_email,
                        Client.deleted_at.is_(None)
                    )
                )
            )
            client = result.scalar_one_or_none()

        return client
