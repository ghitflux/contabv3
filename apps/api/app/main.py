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

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Background task handle
_expiration_task: asyncio.Task | None = None


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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan events.
    Startup and shutdown logic.
    """
    global _expiration_task

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

    # Start background task for license expiration checks
    try:
        _expiration_task = asyncio.create_task(_schedule_license_expiration_checks())
        logger.info("✓ License expiration check task scheduled")
    except Exception as e:
        logger.error(f"✗ Failed to start license expiration check task: {e}")

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
