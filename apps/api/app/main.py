"""
FastAPI application entry point.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import db_manager
from app.core.dev_bootstrap import bootstrap_development_admin_access

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Background task handle
_expiration_task: asyncio.Task | None = None
_finance_task: asyncio.Task | None = None
_obligation_task: asyncio.Task | None = None


async def _schedule_license_expiration_checks() -> None:
    """
    Schedule daily license expiration checks.
    Runs at 8 AM daily.
    """
    import datetime

    while True:
        try:
            # Calculate next 8 AM
            now = datetime.datetime.now()
            next_run = now.replace(hour=8, minute=0, second=0, microsecond=0)

            # If it's past 8 AM today, schedule for tomorrow
            if now >= next_run:
                next_run += datetime.timedelta(days=1)

            # Wait until next run
            wait_seconds = (next_run - now).total_seconds()
            logger.info(f"Scheduling next license expiration check for {next_run} (in {wait_seconds/3600:.1f} hours)")

            await asyncio.sleep(wait_seconds)

            # Run the check
            from app.tasks.license_expiration import check_license_expirations_task
            await check_license_expirations_task()

        except asyncio.CancelledError:
            logger.info("License expiration check task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in scheduled license expiration check: {e}", exc_info=True)
            # Wait 1 hour before retrying
            await asyncio.sleep(3600)


async def _schedule_finance_automation() -> None:
    """
    Schedule finance automation runs.
    Runs daily at 00:10.
    """
    import datetime

    while True:
        try:
            now = datetime.datetime.now()
            scheduled_today = now.replace(hour=0, minute=10, second=0, microsecond=0)

            if now < scheduled_today:
                wait_seconds = (scheduled_today - now).total_seconds()
                logger.info(
                    "Scheduling next finance automation for "
                    f"{scheduled_today} (in {wait_seconds/3600:.1f} hours)"
                )
                await asyncio.sleep(wait_seconds)
            else:
                logger.info(
                    "Finance automation scheduled time already passed today; running immediately"
                )

            from app.tasks.finance_automation import run_finance_daily_automation

            summary = await run_finance_daily_automation()
            logger.info(
                "Finance automation completed. "
                f"Overdue updated: {summary.get('overdue_transactions_updated')}; "
                f"Client sync: {summary.get('client_status_sync')}; "
                f"Monthly generation: {bool(summary.get('monthly_generation'))}"
            )

            # Wait until next scheduled run (tomorrow 00:10)
            after_run = datetime.datetime.now()
            next_run = scheduled_today + datetime.timedelta(days=1)
            wait_seconds = max(0, (next_run - after_run).total_seconds())
            await asyncio.sleep(wait_seconds)
        except asyncio.CancelledError:
            logger.info("Finance automation task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in scheduled finance automation: {e}", exc_info=True)
            await asyncio.sleep(3600)


async def _schedule_obligation_automation() -> None:
    """
    Schedule obligation automation runs.
    Runs daily at 00:20.
    """
    import datetime

    while True:
        try:
            now = datetime.datetime.now()
            scheduled_today = now.replace(hour=0, minute=20, second=0, microsecond=0)

            if now < scheduled_today:
                wait_seconds = (scheduled_today - now).total_seconds()
                logger.info(
                    "Scheduling next obligation automation for "
                    f"{scheduled_today} (in {wait_seconds/3600:.1f} hours)"
                )
                await asyncio.sleep(wait_seconds)
            else:
                logger.info(
                    "Obligation automation scheduled time already passed today; running immediately"
                )

            from app.tasks.obligation_automation import run_obligation_daily_automation

            summary = await run_obligation_daily_automation()
            logger.info(
                "Obligation automation completed. "
                f"Activity sync: {summary.get('activity_sync')}; "
                f"Reminders: {summary.get('reminders')}"
            )

            after_run = datetime.datetime.now()
            next_run = scheduled_today + datetime.timedelta(days=1)
            wait_seconds = max(0, (next_run - after_run).total_seconds())
            await asyncio.sleep(wait_seconds)
        except asyncio.CancelledError:
            logger.info("Obligation automation task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in scheduled obligation automation: {e}", exc_info=True)
            await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan events.
    Startup and shutdown logic.
    """
    global _expiration_task, _finance_task, _obligation_task

    # Startup
    logger.info("Starting application...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug mode: {settings.DEBUG}")

    # Test database connection
    try:
        async for _ in db_manager.get_session():
            logger.info("✓ Database connection successful")
            break
    except Exception as e:
        logger.error(f"✗ Database connection failed: {e}")

    try:
        await bootstrap_development_admin_access()
        if settings.ENVIRONMENT.lower() == "development":
            logger.info("✓ Development admin bootstrap completed")
    except Exception as e:
        logger.error(f"✗ Failed to bootstrap development admin access: {e}", exc_info=True)

    # Start background task for license expiration checks
    try:
        _expiration_task = asyncio.create_task(_schedule_license_expiration_checks())
        logger.info("✓ License expiration check task scheduled")
    except Exception as e:
        logger.error(f"✗ Failed to start license expiration check task: {e}")

    # Start background task for finance automation
    try:
        _finance_task = asyncio.create_task(_schedule_finance_automation())
        logger.info("✓ Finance automation task scheduled")
    except Exception as e:
        logger.error(f"✗ Failed to start finance automation task: {e}")

    # Start background task for obligation automation
    try:
        _obligation_task = asyncio.create_task(_schedule_obligation_automation())
        logger.info("✓ Obligation automation task scheduled")
    except Exception as e:
        logger.error(f"✗ Failed to start obligation automation task: {e}")

    yield

    # Shutdown
    logger.info("Shutting down application...")

    # Cancel background task
    if _expiration_task:
        _expiration_task.cancel()
        try:
            await _expiration_task
        except asyncio.CancelledError:
            pass
        logger.info("✓ License expiration check task cancelled")

    if _finance_task:
        _finance_task.cancel()
        try:
            await _finance_task
        except asyncio.CancelledError:
            pass
        logger.info("✓ Finance automation task cancelled")

    if _obligation_task:
        _obligation_task.cancel()
        try:
            await _obligation_task
        except asyncio.CancelledError:
            pass
        logger.info("✓ Obligation automation task cancelled")

    await db_manager.close()
    logger.info("✓ Database connections closed")


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="API para sistema de gestão contábil",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware
cors_options = {
    "allow_origins": settings.CORS_ORIGINS,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.CORS_ORIGIN_REGEX:
    cors_options["allow_origin_regex"] = settings.CORS_ORIGIN_REGEX

app.add_middleware(CORSMiddleware, **cors_options)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


# Root endpoint
@app.get("/", include_in_schema=False)
async def root() -> JSONResponse:
    """Root endpoint."""
    return JSONResponse(
        {
            "message": "SaaS Contábil API",
            "version": "0.1.0",
            "docs": "/docs",
            "health": f"{settings.API_V1_STR}/health",
        }
    )


# Exception handlers can be added here
# @app.exception_handler(CustomException)
# async def custom_exception_handler(request, exc):
#     return JSONResponse(status_code=400, content={"message": str(exc)})
