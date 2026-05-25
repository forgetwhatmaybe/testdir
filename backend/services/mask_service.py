"""蒙版服务：Canvas 红色涂抹蒙版生成、擦除、预览。"""
from __future__ import annotations

import io
import base64
import json
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw

from config import APP_DATA_DIR

MASK_DIR = APP_DATA_DIR / "masks"
MASK_DIR.mkdir(parents=True, exist_ok=True)

# 默认画笔 RGBA（半透明红）
DEFAULT_BRUSH_COLOR = (220, 38, 38, 180)  # R, G, B, A
DEFAULT_BRUSH_SIZE = 20
DEFAULT_ERASER_SIZE = 30


def _mask_path(project: str, image_name: str) -> Path:
    safe = f"{project}_{Path(image_name).stem}"
    return MASK_DIR / f"{safe}_mask.png"


def create_mask_image(
    project: str,
    image_name: str,
    strokes: list[dict],
    brush_size: int = DEFAULT_BRUSH_SIZE,
    brush_color: tuple = DEFAULT_BRUSH_COLOR,
    original_size: Optional[tuple[int, int]] = None,
) -> str:
    """
    根据 stroke 列表生成蒙版 PNG，返回 base64 data URL。
    stroke: {"x": int, "y": int, "type": "paint"|"erase"}
    """
    w, h = original_size or (1024, 1024)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for s in strokes:
        x, y = s["x"], s["y"]
        size = brush_size
        if s.get("type") == "erase":
            color = (0, 0, 0, 0)  # 透明 = 擦除
        else:
            color = brush_color
        r = size // 2
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def save_mask(
    project: str,
    image_name: str,
    strokes: list[dict],
    brush_size: int = DEFAULT_BRUSH_SIZE,
    brush_color: tuple = DEFAULT_BRUSH_COLOR,
    original_size: Optional[tuple[int, int]] = None,
) -> Path:
    """保存蒙版到磁盘，返回路径。"""
    w, h = original_size or (1024, 1024)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for s in strokes:
        x, y = s["x"], s["y"]
        size = brush_size
        if s.get("type") == "erase":
            color = (0, 0, 0, 0)
        else:
            color = brush_color
        r = size // 2
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)

    path = _mask_path(project, image_name)
    img.save(path, format="PNG")
    return path


def load_mask(project: str, image_name: str) -> Optional[str]:
    """加载已保存的蒙版，返回 base64 data URL。"""
    path = _mask_path(project, image_name)
    if not path.exists():
        return None
    buf = io.BytesIO(path.read_bytes())
    b64 = base64.b64encode(buf.read()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def delete_mask(project: str, image_name: str) -> bool:
    path = _mask_path(project, image_name)
    if path.exists():
        path.unlink()
        return True
    return False