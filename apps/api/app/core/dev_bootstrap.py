"""
Development-only bootstrap helpers.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import db_manager
from app.db.models.user import User, UserRole
from app.db.repositories.user import UserRepository

logger = logging.getLogger(__name__)


async def ensure_development_admin_user(
    session: AsyncSession,
    *,
    environment: str | None = None,
    enabled: bool | None = None,
    email: str | None = None,
    password: str | None = None,
    name: str | None = None,
) -> User | None:
    """
    Ensure a predictable admin login exists for local development.
    """
    current_environment = (environment or settings.ENVIRONMENT).lower()
    bootstrap_enabled = (
        settings.ENABLE_DEV_ADMIN_BOOTSTRAP if enabled is None else enabled
    )

    if current_environment != "development" or not bootstrap_enabled:
        return None

    admin_email = email or settings.DEV_ADMIN_EMAIL
    admin_password = password or settings.DEV_ADMIN_PASSWORD
    admin_name = name or settings.DEV_ADMIN_NAME

    user_repo = UserRepository(session)
    user = await user_repo.get_by_email(admin_email)
    should_commit = False

    if user is None:
        user = User(
            name=admin_name,
            email=admin_email,
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        session.add(user)
        should_commit = True

    if user.name != admin_name:
        user.name = admin_name
        should_commit = True
    if user.role != UserRole.ADMIN:
        user.role = UserRole.ADMIN
        should_commit = True
    if not user.is_active:
        user.is_active = True
        should_commit = True
    if not user.is_verified:
        user.is_verified = True
        should_commit = True

    password_matches = False
    if user.password_hash:
        try:
            password_matches = user.verify_password(admin_password)
        except ValueError:
            logger.warning(
                "Invalid password hash for development admin %s. Resetting password.",
                admin_email,
            )

    if not password_matches:
        user.set_password(admin_password)
        should_commit = True

    if should_commit:
        await session.commit()
        await session.refresh(user)
        logger.info("Development admin access ensured for %s", admin_email)

    return user


async def bootstrap_development_admin_access() -> None:
    """
    Provision or repair the local development admin user.
    """
    async with db_manager.session_factory() as session:
        await ensure_development_admin_user(session)
