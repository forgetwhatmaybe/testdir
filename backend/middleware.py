"""全局中间件：异常处理 / 请求日志 / 速率限制。"""
from __future__ import annotations

import time
import logging
import traceback
from collections import defaultdict
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("pic_video_0515")

# ---- 速率限制 ----
# 简单滑动窗口：每窗口最大请求数
_RATE_LIMIT = {
    "enabled": True,
    "window_seconds": 60,
    "max_requests": 300,  # 每窗口最多 300 次请求
}
_windows: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(client_ip: str) -> tuple[bool, str]:
    """返回 (允许, 提示)。"""
    now = time.time()
    window = _RATE_LIMIT["window_seconds"]
    entries = _windows[client_ip]

    # 清理过期记录
    while entries and entries[0] < now - window:
        entries.pop(0)

    if len(entries) >= _RATE_LIMIT["max_requests"]:
        return False, f"请求过于频繁，每 {window}s 最多 {_RATE_LIMIT['max_requests']} 次请求，请稍后重试"
    entries.append(now)
    return True, ""


class ExceptionMiddleware(BaseHTTPMiddleware):
    """全局异常捕获中间件 — 统一错误响应格式，记录完整堆栈。"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            tb = traceback.format_exc()
            logger.error(
                "未处理的异常 | %s %s\n%s\n%s",
                request.method,
                request.url.path,
                repr(exc),
                tb,
            )
            return JSONResponse(
                status_code=500,
                content={
                    "error": True,
                    "message": "服务器内部错误，请稍后重试或联系开发者",
                    "detail": str(exc),
                },
            )


class RequestLogMiddleware(BaseHTTPMiddleware):
    """请求日志中间件 — 记录方法/路径/状态码/耗时。"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.time()
        response = await call_next(request)
        elapsed_ms = round((time.time() - start) * 1000, 1)
        status_code = response.status_code if hasattr(response, "status_code") else 0
        logger.info(
            "%s %s → %d (%.1fms)",
            request.method,
            request.url.path,
            status_code,
            elapsed_ms,
        )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """速率限制中间件 — 基于客户端 IP 的滑动窗口。"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not _RATE_LIMIT.get("enabled", True):
            return await call_next(request)

        # 排除健康检查
        if request.url.path in ("/api/health", "/favicon.ico"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        allowed, hint = _check_rate_limit(client_ip)
        if not allowed:
            logger.warning("速率限制触发 | IP=%s %s %s", client_ip, request.method, request.url.path)
            return JSONResponse(
                status_code=429,
                content={"error": True, "message": hint},
            )
        return await call_next(request)