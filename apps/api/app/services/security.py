"""
Security-related helpers such as password policy validation.
"""

import logging
import re

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.settings import SecuritySettings
from app.db.repositories.settings import SecuritySettingsRepository

logger = logging.getLogger(__name__)


async def get_effective_security_settings(session: AsyncSession) -> SecuritySettings:
    """
    Load security settings or fall back to defaults defined in the model.

    Args:
        session: Database session

    Returns:
        SecuritySettings instance with policy values
    """
    repo = SecuritySettingsRepository(session)
    settings = await repo.get_settings()
    return settings or SecuritySettings()


def validate_password_strength(password: str, settings: SecuritySettings) -> None:
    """
    Validate a password against the configured policy.

    Args:
        password: Password to validate
        settings: Security settings containing policy flags

    Raises:
        HTTPException: If the password does not satisfy the policy
    """
    requirements: list[str] = []

    if settings.password_min_length and len(password) < settings.password_min_length:
        requirements.append(f"at least {settings.password_min_length} characters")

    if settings.password_require_uppercase and not re.search(r"[A-Z]", password):
        requirements.append("one uppercase letter")

    if settings.password_require_lowercase and not re.search(r"[a-z]", password):
        requirements.append("one lowercase letter")

    if settings.password_require_numbers and not re.search(r"[0-9]", password):
        requirements.append("one number")

    if settings.password_require_special_chars and not re.search(r"[!@#$%^&*(),.?\"':{}|<>\\[\\]\\-_=+;`~]", password):
        requirements.append("one special character")

    if requirements:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password requirements not met: " + ", ".join(requirements),
        )


async def enforce_password_policy(session: AsyncSession, password: str) -> None:
    """
    Fetch policy settings and validate a password.

    Args:
        session: Database session
        password: Password to validate
    """
    settings = await get_effective_security_settings(session)
    validate_password_strength(password, settings)
