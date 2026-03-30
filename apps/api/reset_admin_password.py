"""
Script to reset admin password.
"""
import asyncio
import sys
from sqlalchemy import select

from app.core.database import db_manager
from app.db.models.user import User


async def reset_admin_password():
    """Reset admin user password."""
    async for session in db_manager.get_session():
        try:
            # Find admin user
            result = await session.execute(
                select(User).where(User.email == "admin@contabil.com")
            )
            user = result.scalar_one_or_none()

            if not user:
                print("Admin user not found!")
                return

            # Set new password
            user.set_password("admin123")
            await session.commit()

            print("✓ Admin password has been reset to: admin123")
            print(f"✓ Hash: {user.password_hash}")

        except Exception as e:
            print(f"✗ Error: {e}")
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(reset_admin_password())
