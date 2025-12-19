"""Activity repository."""

from typing import Optional
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

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
        stmt = select(Activity).where(Activity.id == activity_id)
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
        conditions = []

        if status:
            conditions.append(Activity.status == status)
        if assigned_to_id:
            conditions.append(Activity.assigned_to_id == assigned_to_id)
        if created_by_id:
            conditions.append(Activity.created_by_id == created_by_id)

        # Count total
        if conditions:
            count_stmt = select(Activity).where(and_(*conditions))
        else:
            count_stmt = select(Activity)
        count_result = await self.db.execute(count_stmt)
        total = len(count_result.scalars().all())

        # Get paginated results
        stmt = select(Activity).order_by(Activity.due_date.asc().nullslast(), Activity.created_at.desc())
        if conditions:
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
