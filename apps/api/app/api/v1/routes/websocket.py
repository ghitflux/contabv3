"""
WebSocket routes for real-time communication.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status

from app.api.v1.deps import get_current_active_user
from app.db.models.user import User, UserRole

from app.core.security import decode_token
from app.websockets.events import WebSocketEventBuilder
from app.websockets.manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/{token}")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str
):
    """
    WebSocket endpoint for real-time communication.

    Connection URL: ws://localhost:8000/api/v1/ws/{access_token}

    Flow:
    1. Client connects with JWT token in URL
    2. Server validates token
    3. Connection accepted and registered
    4. Client receives welcome message
    5. Keep-alive with ping/pong
    6. Receive real-time events

    Events:
    - connected: Connection established
    - notification: New notification
    - obligation_update: Obligation created/updated
    - system: System messages
    - client_update: Client created/updated

    Args:
        websocket: WebSocket connection
        token: JWT access token
    """
    user_id: Optional[str] = None

    try:
        # Validate token
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            role = payload.get("role", "cliente")

            if not user_id:
                logger.warning("WebSocket connection rejected: invalid token (no sub)")
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return

        except Exception as e:
            logger.warning(f"WebSocket connection rejected: token validation failed - {e}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Accept connection
        await manager.connect(websocket, user_id, role)

        # Send welcome message
        welcome_event = WebSocketEventBuilder.connected_event(user_id, role)
        await websocket.send_json(welcome_event)

        # Connection stats
        stats = manager.get_connection_stats()
        logger.info(f"WebSocket connections: {stats}")

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()

                # Handle ping/pong
                if data == "ping":
                    await websocket.send_text("pong")
                    logger.debug(f"Ping received from user {user_id}")

                # Handle other client messages (if needed)
                elif data.startswith("{"):
                    # Client sent JSON message (future feature)
                    logger.debug(f"Message received from user {user_id}: {data[:50]}...")
                    # Could handle commands, typing indicators, etc.

            except WebSocketDisconnect:
                logger.info(f"WebSocket client disconnected: user_id={user_id}")
                break

            except Exception as e:
                logger.error(f"Error in WebSocket loop for user {user_id}: {e}")
                break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected during setup: user_id={user_id}")

    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)

    finally:
        # Always disconnect on exit
        if user_id:
            manager.disconnect(user_id)
            stats = manager.get_connection_stats()
            logger.info(f"WebSocket connections after disconnect: {stats}")


@router.get("/ws/stats")
async def websocket_stats(
    current_user: User = Depends(get_current_active_user),
):
    """
    Get WebSocket connection statistics.
    Requires admin/func role.

    Returns:
        Dict with connection stats
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )

    return {
        "stats": manager.get_connection_stats(),
        "connected_users": len(manager.get_connected_users()),
        "by_role": {
            "admin": len(manager.get_connections_by_role("admin")),
            "func": len(manager.get_connections_by_role("func")),
            "cliente": len(manager.get_connections_by_role("cliente")),
        }
    }
