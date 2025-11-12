"\"\"\"Seed script to create sample notifications for demo/testing.\"\"\""

import asyncio
from datetime import datetime, timedelta
import sys
from pathlib import Path

# Ensure the app package is importable when executing as module
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.core.database import Base, db_manager
from app.db.models.notification import Notification
from app.db.models.user import User
from app.schemas.notification import NotificationType


NOTIFICATION_SEED_DATA = [
    {
        "user_email": "admin@contabil.com",
        "type": NotificationType.OBLIGATION_DUE_SOON,
        "title": "Obrigação vencendo",
        "message": "DCTFWeb da Tech Solutions vence em 2 dias",
        "link": "/obrigacoes",
        "extra_data": {
            "client_name": "Tech Solutions Ltda",
            "obligation_code": "DCTFWEB",
            "due_in_days": 2,
        },
        "hours_ago": 1,
    },
    {
        "user_email": "admin@contabil.com",
        "type": NotificationType.SYSTEM_ALERT,
        "title": "Pagamento recebido",
        "message": "Honorários de R$ 2.500,00 recebidos de Tech Solutions",
        "link": "/financeiro",
        "extra_data": {
            "client_name": "Tech Solutions Ltda",
            "amount": 2500.0,
            "payment_method": "PIX",
        },
        "hours_ago": 3,
    },
    {
        "user_email": "admin@contabil.com",
        "type": NotificationType.CLIENT_CREATED,
        "title": "Novo cliente cadastrado",
        "message": "Comércio ABC foi adicionado ao sistema",
        "link": "/clientes",
        "extra_data": {
            "client_name": "Comércio ABC Ltda",
            "cnpj": "12.345.678/0001-99",
        },
        "days_ago": 1,
    },
    {
        "user_email": "admin@contabil.com",
        "type": NotificationType.SYSTEM_ALERT,
        "title": "Licença expirada",
        "message": "Auto de Vistoria do Corpo de Bombeiros de Comércio ABC expirou",
        "link": "/licencas",
        "extra_data": {
            "client_name": "Comércio ABC Ltda",
            "license_type": "AVCB",
        },
        "hours_ago": 6,
    },
]


async def seed_notifications() -> None:
    """Create sample notifications if they don't exist yet."""
    print("[*] Starting notifications seed...")

    # Ensure tables exist
    async with db_manager.write_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Tables verified")

    created_count = 0
    skipped_count = 0

    async with db_manager.session_factory() as session:
        for entry in NOTIFICATION_SEED_DATA:
            result = await session.execute(
                select(User).where(User.email == entry["user_email"])
            )
            user = result.scalar_one_or_none()

            if not user:
                print(f"[WARN] User {entry['user_email']} not found. Skipping notification.")
                skipped_count += 1
                continue

            exists = await session.execute(
                select(Notification).where(
                    Notification.user_id == user.id,
                    Notification.title == entry["title"],
                    Notification.message == entry["message"],
                )
            )
            if exists.scalar_one_or_none():
                print(f"[SKIP] Notification '{entry['title']}' already exists for {user.email}.")
                skipped_count += 1
                continue

            created_at = datetime.utcnow()
            if "hours_ago" in entry:
                created_at -= timedelta(hours=entry["hours_ago"])
            if "days_ago" in entry:
                created_at -= timedelta(days=entry["days_ago"])

            notification = Notification(
                user_id=user.id,
                type=entry["type"],
                title=entry["title"],
                message=entry["message"],
                link=entry.get("link"),
                extra_data=entry.get("extra_data"),
                created_at=created_at,
            )
            session.add(notification)
            created_count += 1
            print(f"[OK] Created notification '{entry['title']}' for {user.email}.")

        await session.commit()

    print(f"\n[SUCCESS] Notifications seed completed. Created: {created_count}, Skipped: {skipped_count}")


async def main() -> None:
    try:
        await seed_notifications()
    except Exception as exc:
        print(f"\n[ERROR] Error while seeding notifications: {exc}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        await db_manager.close()


if __name__ == "__main__":
    asyncio.run(main())

