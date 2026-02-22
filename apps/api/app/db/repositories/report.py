"""Report Repository - Data access layer for reports."""

from datetime import datetime, timedelta
from typing import Optional, Sequence
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.report import ReportFormat, ReportHistory, ReportStatus, ReportTemplate, ReportType
from app.db.repositories.base import BaseRepository
from fastapi.encoders import jsonable_encoder


class ReportRepository(BaseRepository[ReportTemplate]):
    """Repository for Report operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(ReportTemplate, db)

    async def get_user_templates(
        self, user_id: UUID, include_system: bool = False
    ) -> Sequence[ReportTemplate]:
        """
        Get templates for a user.

        Args:
            user_id: User UUID
            include_system: Include system templates

        Returns:
            List of templates
        """
        conditions = []

        if include_system:
            conditions.append(
                (ReportTemplate.created_by_id == user_id) | (ReportTemplate.is_system.is_(True))
            )
        else:
            conditions.append(ReportTemplate.created_by_id == user_id)

        stmt = select(ReportTemplate).where(and_(*conditions)).order_by(
            ReportTemplate.is_system.desc(), ReportTemplate.name
        )

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_system_templates(self) -> Sequence[ReportTemplate]:
        """
        Get all system templates.

        Returns:
            List of system templates
        """
        stmt = (
            select(ReportTemplate)
            .where(ReportTemplate.is_system.is_(True))
            .order_by(ReportTemplate.name)
        )

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def save_template_history(
        self,
        user_id: UUID,
        report_type: ReportType | str,
        filters_used: dict,
        format: ReportFormat | str,
        file_path: Optional[str] = None,
        file_size: Optional[int] = None,
        template_id: Optional[UUID] = None,
        expires_at: Optional[datetime] = None,
        status: ReportStatus = ReportStatus.COMPLETED,
    ) -> ReportHistory:
        """
        Save report generation history.

        Args:
            user_id: User who generated the report
            report_type: Type of report
            filters_used: Filters applied
            format: Export format
            file_path: Path to generated file
            file_size: File size in bytes
            template_id: Template used (optional)
            expires_at: Expiration datetime
            status: Generation status

        Returns:
            Created ReportHistory instance
        """
        if not expires_at:
            expires_at = datetime.utcnow() + timedelta(days=7)

        # Normalize enums to DB enums
        if not isinstance(report_type, ReportType):
            # Accept pydantic enums/strings
            value = getattr(report_type, "value", report_type)
            report_type = ReportType(value)

        if not isinstance(format, ReportFormat):
            value = getattr(format, "value", format)
            format = ReportFormat(value)

        # Ensure filters are JSON-serializable (dates/datetimes -> ISO strings)
        filters_json = jsonable_encoder(filters_used)

        history = ReportHistory(
            template_id=template_id,
            user_id=user_id,
            report_type=report_type,
            filters_used=filters_json,
            format=format,
            file_path=file_path,
            file_size=file_size,
            expires_at=expires_at,
            status=status,
        )

        self.db.add(history)
        await self.db.flush()
        await self.db.refresh(history)
        await self.db.commit()

        return history

    async def get_history_by_id(
        self, history_id: UUID, include_deleted: bool = False
    ) -> Optional[ReportHistory]:
        """Get a report history record by ID."""
        conditions = [ReportHistory.id == history_id]
        if not include_deleted:
            conditions.append(ReportHistory.deleted_at.is_(None))

        stmt = select(ReportHistory).where(and_(*conditions))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_history(
        self,
        user_id: UUID,
        report_type: Optional[str] = None,
        format: Optional[str] = None,
        include_deleted: bool = False,
        deleted_only: bool = False,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[Sequence[ReportHistory], int]:
        """
        Get report history for a user with pagination.

        Args:
            user_id: User UUID
            report_type: Filter by report type
            format: Filter by format
            include_deleted: Include soft-deleted rows
            deleted_only: Return only soft-deleted rows
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            Tuple of (history list, total count)
        """
        conditions = [ReportHistory.user_id == user_id]

        if deleted_only:
            conditions.append(ReportHistory.deleted_at.is_not(None))
        elif not include_deleted:
            conditions.append(ReportHistory.deleted_at.is_(None))

        if report_type:
            conditions.append(ReportHistory.report_type == report_type)

        if format:
            conditions.append(ReportHistory.format == format)

        # Count query
        count_stmt = select(func.count()).select_from(ReportHistory).where(and_(*conditions))
        total = await self.db.scalar(count_stmt) or 0

        # Data query
        order_column = ReportHistory.deleted_at.desc() if deleted_only else ReportHistory.generated_at.desc()
        stmt = (
            select(ReportHistory)
            .where(and_(*conditions))
            .order_by(order_column)
            .offset(skip)
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        history_list = result.scalars().all()

        return history_list, total

    async def cleanup_expired_files(self) -> int:
        """
        Remove expired report files from history.

        Returns:
            Number of records cleaned up
        """
        now = datetime.utcnow()

        stmt = select(ReportHistory).where(ReportHistory.expires_at <= now)
        result = await self.db.execute(stmt)
        expired_records = result.scalars().all()

        count = len(expired_records)
        for record in expired_records:
            await self.db.delete(record)

        await self.db.flush()

        return count
