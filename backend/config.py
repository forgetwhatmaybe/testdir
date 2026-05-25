"""全局配置：路径、加密密钥位置等。"""
from __future__ import annotations

import os
from pathlib import Path


def _appdata_dir() -> Path:
    base = os.environ.get("APPDATA") or str(Path.home())
    return Path(base) / "pic_video_0515"


APP_DATA_DIR = _appdata_dir()
APP_DATA_DIR.mkdir(parents=True, exist_ok=True)

SECRET_KEY_PATH = APP_DATA_DIR / "secret.key"
SETTINGS_PATH = APP_DATA_DIR / "settings.enc"
PROJECTS_INDEX_PATH = APP_DATA_DIR / "projects_index.json"

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = int(os.environ.get("PIC_VIDEO_PORT", "18765"))

ROOT_FOLDER_NAME = "AIVIDEO"

ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}
ALLOWED_VIDEO_EXT = {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm"}

MAX_IMAGE_BYTES = int(4.7 * 1024 * 1024)
