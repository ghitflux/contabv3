"""Bank account repository."""

from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bank_account import BankAccount
from app.db.repositories.base import BaseRepository


class BankAccountRepository(BaseRepository[BankAccount]):
    """Repository for BankAccount operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(BankAccount, db)

    async def list_with_filters(
        self,
        client_id: Optional[UUID] = None,
        office_only: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[BankAccount], int]:
        conditions = []
        if office_only:
            # List only the office cash account (client_id is null)
            conditions.append(BankAccount.client_id.is_(None))
        elif client_id:
            conditions.append(BankAccount.client_id == client_id)

        count_stmt = select(func.count()).select_from(BankAccount)
        if conditions:
            count_stmt = count_stmt.where(and_(*conditions))
        total = await self.db.scalar(count_stmt) or 0

        stmt = select(BankAccount)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(BankAccount.name.asc()).offset(skip).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total
