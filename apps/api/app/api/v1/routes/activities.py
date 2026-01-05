"""Activity API routes."""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db
from app.db.models.activity import Activity, ActivityStatus
from app.db.models.user import User
from app.db.repositories.activity import ActivityRepository
from app.schemas.activity import (
    ActivityCreate,
    ActivityListResponse,
    ActivityResponse,
    ActivityUpdate,
)

router = APIRouter()


def _build_activity_response(activity: Activity) -> ActivityResponse:
    return ActivityResponse(
        id=activity.id,
        title=activity.title,
        description=activity.description,
        status=activity.status.value,
        priority=activity.priority.value,
        assigned_to_id=activity.assigned_to_id,
        assigned_to_name=activity.assigned_to.name if activity.assigned_to else None,
        due_date=activity.due_date,
        labels=activity.labels.split(",") if activity.labels else [],
        recurrence=activity.recurrence.value if activity.recurrence else None,
        reminders=activity.reminders,
        created_by_id=activity.created_by_id,
        created_at=activity.created_at,
        updated_at=activity.updated_at,
    )


@router.get("", response_model=ActivityListResponse)
async def list_activities(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    assigned_to_id: Optional[UUID] = Query(None),
):
    """List activities with optional filters."""
    repo = ActivityRepository(db)

    # Parse status
    activity_status = None
    if status_filter:
        try:
            activity_status = ActivityStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}",
            )

    activities, total = await repo.list(
        skip=skip,
        limit=limit,
        status=activity_status,
        assigned_to_id=assigned_to_id,
    )

    items = [_build_activity_response(activity) for activity in activities]

    pages = (total + limit - 1) // limit if limit > 0 else 0
    page = (skip // limit) + 1 if limit > 0 else 1

    return ActivityListResponse(
        items=items,
        total=total,
        page=page,
        size=limit,
        pages=pages,
    )


@router.get("/{activity_id}", response_model=ActivityResponse)
async def get_activity(
    activity_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get activity by ID."""
    repo = ActivityRepository(db)
    activity = await repo.get_by_id(activity_id)

    if not activity:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        )

    return _build_activity_response(activity)


@router.post("", response_model=ActivityResponse, status_code=http_status.HTTP_201_CREATED)
async def create_activity(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    activity_data: ActivityCreate,
):
    """Create a new activity."""
    from app.db.models.activity import ActivityPriority, ActivityRecurrence, ActivityStatus

    # Convert labels list to comma-separated string
    labels_str = ",".join(activity_data.labels) if activity_data.labels else None

    activity = Activity(
        title=activity_data.title,
        description=activity_data.description,
        status=ActivityStatus(activity_data.status),
        priority=ActivityPriority(activity_data.priority),
        assigned_to_id=activity_data.assigned_to_id,
        due_date=activity_data.due_date,
        labels=labels_str,
        recurrence=ActivityRecurrence(activity_data.recurrence) if activity_data.recurrence else None,
        reminders=activity_data.reminders,
        created_by_id=current_user.id,
    )

    repo = ActivityRepository(db)
    created = await repo.create(activity)
    refreshed = await repo.get_by_id(created.id)
    return _build_activity_response(refreshed or created)


@router.put("/{activity_id}", response_model=ActivityResponse)
async def update_activity(
    activity_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    activity_data: ActivityUpdate,
):
    """Update an activity."""
    from app.db.models.activity import ActivityPriority, ActivityRecurrence, ActivityStatus

    repo = ActivityRepository(db)
    activity = await repo.get_by_id(activity_id)

    if not activity:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        )

    # Update fields
    update_data = activity_data.model_dump(exclude_unset=True)

    if "status" in update_data:
        activity.status = ActivityStatus(update_data["status"])
    if "priority" in update_data:
        activity.priority = ActivityPriority(update_data["priority"])
    if "recurrence" in update_data and update_data["recurrence"]:
        activity.recurrence = ActivityRecurrence(update_data["recurrence"])
    if "labels" in update_data:
        activity.labels = ",".join(update_data["labels"]) if update_data["labels"] else None

    for key in ["title", "description", "assigned_to_id", "due_date", "reminders"]:
        if key in update_data:
            setattr(activity, key, update_data[key])

    updated = await repo.update(activity)
    refreshed = await repo.get_by_id(updated.id)
    return _build_activity_response(refreshed or updated)


@router.delete("/{activity_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_activity(
    activity_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete an activity."""
    repo = ActivityRepository(db)
    activity = await repo.get_by_id(activity_id)

    if not activity:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        )

    await repo.delete(activity_id)
    return None
