"""FastAPI 入口。"""
from __future__ import annotations

import logging
import os
import sys
import socket

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 让 routers/services/api_clients/models 都能从根目录导入
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import DEFAULT_HOST, DEFAULT_PORT  # noqa: E402
from middleware import ExceptionMiddleware, RateLimitMiddleware, RequestLogMiddleware  # noqa: E402
from routers import projects, files, settings, tasks, ws, history, storyboard, audio, mask, templates  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("pic_video_0515")

app = FastAPI(title="pic_video_0515", version="0.2.0")

# 中间件顺序：最外层异常 → 速率限制 → 日志 → CORS
app.add_middleware(ExceptionMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(files.router)
app.include_router(settings.router)
app.include_router(tasks.router)
app.include_router(ws.router)
app.include_router(history.router)
app.include_router(storyboard.router)
app.include_router(audio.router)
app.include_router(mask.router)
app.include_router(templates.router)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "service": "pic_video_0515", "port": DEFAULT_PORT}


def _single_instance_lock(port: int) -> bool:
    """通过监听端口实现单实例：被占用则失败。"""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 0)
    try:
        s.bind((DEFAULT_HOST, port))
        s.listen(1)
        # 不关闭：交给 uvicorn 之后会自己 bind，这里仅用于侦测
        return True
    except OSError:
        return False
    finally:
        s.close()


def main() -> None:
    import uvicorn

    if not _single_instance_lock(DEFAULT_PORT):
        print(f"端口 {DEFAULT_PORT} 已被占用，可能已有实例运行。", file=sys.stderr)
        # 仍然尝试启动 uvicorn，让用户感知错误
    uvicorn.run("main:app", host=DEFAULT_HOST, port=DEFAULT_PORT, reload=False)


if __name__ == "__main__":
    main()
