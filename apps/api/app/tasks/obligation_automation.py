"""Daily obligation automation tasks.

- Backfill/sync activities for obligations
- Send reminder notifications 5 days before due date
"""

from __future__ import annotations

import logging
from datetime import date

from app.core.database import db_manager
from app.services.obligation.activity_notification import (
    send_due_soon_notifications_for_date,
    sync_all_existing_obligation_activities,
)

logger = logging.getLogger(__name__)


async def run_obligation_daily_automation() -> dict:
    """Run daily obligation automation routines."""
    today = date.today()

    async with db_manager.session_factory() as session:
        activity_summary = await sync_all_existing_obligation_activities(session)
        reminder_summary = await send_due_soon_notifications_for_date(
            session,
            reminder_days=5,
            reference_date=today,
        )

        await session.commit()

    return {
        "success": True,
        "date": today.isoformat(),
        "activity_sync": activity_summary,
        "reminders": reminder_summary,
    }


async def run_obligation_automation_now() -> dict:
    """Manual helper for tests/admin scripts."""
    return await run_obligation_daily_automation()
