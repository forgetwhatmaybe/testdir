"""WebSocket 路由。"""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.ws_manager import manager

router = APIRouter()


@router.websocket("/api/ws/tasks")
async def ws_tasks(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # 客户端心跳；忽略内容
    except WebSocketDisconnect:
        await manager.disconnect(ws)
    except Exception:
        await manager.disconnect(ws)
