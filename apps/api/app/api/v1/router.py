"""
API v1 router aggregator.
"""

from fastapi import APIRouter

from app.api.v1.routes import (
    activities,
    admin,
    audit_logs,
    auth,
    bank_accounts,
    clients,
    cnaes,
    documents,
    finance,
    finance_imports,
    health,
    licenses,
    municipal_registrations,
    obligations,
    permissions,
    reports,
    settings,
    users,
    websocket,
)

api_router = APIRouter()

# Include all route modules
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(clients.router)
api_router.include_router(documents.router)
api_router.include_router(activities.router, prefix="/activities", tags=["activities"])
api_router.include_router(obligations.router, prefix="/obligations", tags=["obligations"])
api_router.include_router(finance_imports.router)
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])
api_router.include_router(bank_accounts.router)
api_router.include_router(licenses.router)
api_router.include_router(cnaes.router)
api_router.include_router(municipal_registrations.router)
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(settings.router, tags=["settings"])
api_router.include_router(permissions.router, tags=["permissions"])
api_router.include_router(audit_logs.router)
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(websocket.router, tags=["websocket"])

# Future routers will be added here:
# api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
