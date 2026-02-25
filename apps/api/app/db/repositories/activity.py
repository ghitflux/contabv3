"""Activity repository."""

from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.activity import Activity, ActivityStatus


class ActivityRepository:
    """Repository for Activity model."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, activity: Activity) -> Activity:
        """Create a new activity."""
        self.db.add(activity)
        await self.db.commit()
        await self.db.refresh(activity)
        return activity

    async def get_by_id(self, activity_id: UUID) -> Optional[Activity]:
        """Get activity by ID."""
        stmt = (
            select(Activity)
            .options(selectinload(Activity.assigned_to))
            .where(Activity.id == activity_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        status: Optional[ActivityStatus] = None,
        assigned_to_id: Optional[UUID] = None,
        created_by_id: Optional[UUID] = None,
    ) -> tuple[list[Activity], int]:
        """List activities with filters."""
        conditions = [Activity.deleted_at.is_(None)]

        if status:
            conditions.append(Activity.status == status)
        if assigned_to_id:
            conditions.append(Activity.assigned_to_id == assigned_to_id)
        if created_by_id:
            conditions.append(Activity.created_by_id == created_by_id)

        count_stmt = select(func.count()).select_from(Activity).where(and_(*conditions))
        total = int(await self.db.scalar(count_stmt) or 0)

        # Get paginated results
        stmt = (
            select(Activity)
            .options(selectinload(Activity.assigned_to))
            .order_by(Activity.due_date.asc().nullslast(), Activity.created_at.desc())
        )
        stmt = stmt.where(and_(*conditions))
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        activities = result.scalars().all()

        return list(activities), total

    async def update(self, activity: Activity) -> Activity:
        """Update an activity."""
        await self.db.commit()
        await self.db.refresh(activity)
        return activity

    async def delete(self, activity_id: UUID) -> None:
        """Delete an activity."""
        activity = await self.get_by_id(activity_id)
        if activity:
            await self.db.delete(activity)
            await self.db.commit()
