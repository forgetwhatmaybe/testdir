"""WebSocket 广播：任务进度推送给所有订阅者。"""
from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import WebSocket


class WSManager:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.clients.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self.clients.discard(ws)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        text = json.dumps(payload, ensure_ascii=False)
        async with self._lock:
            dead: list[WebSocket] = []
            for ws in list(self.clients):
                try:
                    await ws.send_text(text)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.clients.discard(ws)


manager = WSManager()


def broadcast_sync(payload: dict[str, Any]) -> None:
    """从同步线程调用：投递到事件循环。"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        return
    if loop.is_running():
        asyncio.run_coroutine_threadsafe(manager.broadcast(payload), loop)
