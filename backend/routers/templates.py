"""模板路由：工作流模板库 CRUD。"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import APP_DATA_DIR

router = APIRouter(prefix="/api/templates", tags=["templates"])

TEMPLATES_PATH = APP_DATA_DIR / "workflow_templates.json"

# ---- 内置模板 ----
_BUILTIN: list[dict[str, Any]] = [
    {
        "id": "txt2vid_kling",
        "name": "文生视频·可灵",
        "description": "文本提示 → Kling 生成视频 → 输出",
        "category": "文生视频",
        "icon": "video",
        "nodes": 2,
        "tags": ["可灵", "文生视频", "入门"],
        "flow": {
            "nodes": [
                {"id": "n1", "type": "text_display", "position": {"x": 100, "y": 200},
                 "data": {"name": "提示词", "text": ""}},
                {"id": "n2", "type": "kling", "position": {"x": 400, "y": 200},
                 "data": {"mode": "text_to_video", "duration": "5s"}},
                {"id": "n3", "type": "output", "position": {"x": 700, "y": 200},
                 "data": {"name": "视频输出"}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "sourceHandle": "text", "target": "n2", "targetHandle": "text"},
                {"id": "e2", "source": "n2", "sourceHandle": "out", "target": "n3", "targetHandle": "in"},
            ],
        },
    },
    {
        "id": "img2vid_jimeng",
        "name": "图生视频·即梦",
        "description": "上传图片 → 即梦图生视频 → 输出",
        "category": "图生视频",
        "icon": "video",
        "nodes": 3,
        "tags": ["即梦", "图生视频"],
        "flow": {
            "nodes": [
                {"id": "n1", "type": "image", "position": {"x": 100, "y": 200},
                 "data": {"image_path": ""}},
                {"id": "n2", "type": "jimeng", "position": {"x": 400, "y": 200},
                 "data": {"mode": "image_to_video"}},
                {"id": "n3", "type": "output", "position": {"x": 700, "y": 200},
                 "data": {"name": "视频输出"}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "sourceHandle": "out", "target": "n2", "targetHandle": "image"},
                {"id": "e2", "source": "n2", "sourceHandle": "out", "target": "n3", "targetHandle": "in"},
            ],
        },
    },
    {
        "id": "img_edit_inpaint",
        "name": "图片修复·局部重绘",
        "description": "上传图片+蒙版 → 即梦局部重绘 → 输出",
        "category": "图片编辑",
        "icon": "image",
        "nodes": 3,
        "tags": ["即梦", "局部重绘", "蒙版"],
        "flow": {
            "nodes": [
                {"id": "n1", "type": "image", "position": {"x": 100, "y": 200},
                 "data": {"image_path": ""}},
                {"id": "n2", "type": "image_edit", "position": {"x": 400, "y": 200},
                 "data": {"edit_mode": "jimeng_inpaint"}},
                {"id": "n3", "type": "output", "position": {"x": 700, "y": 200},
                 "data": {"name": "结果"}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "sourceHandle": "out", "target": "n2", "targetHandle": "in_image"},
                {"id": "e2", "source": "n2", "sourceHandle": "out", "target": "n3", "targetHandle": "in"},
            ],
        },
    },
    {
        "id": "text_vision_gemini",
        "name": "文本视觉·Gemini",
        "description": "图片 → Gemini 视觉问答 → TextDisplay",
        "category": "文本视觉",
        "icon": "experiment",
        "nodes": 3,
        "tags": ["Gemini", "文本视觉", "问答"],
        "flow": {
            "nodes": [
                {"id": "n1", "type": "image", "position": {"x": 100, "y": 200},
                 "data": {"image_path": ""}},
                {"id": "n2", "type": "text_vision", "position": {"x": 400, "y": 200},
                 "data": {"model": "gemini"}},
                {"id": "n3", "type": "text_display", "position": {"x": 700, "y": 200},
                 "data": {"name": "答案"}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "sourceHandle": "out", "target": "n2", "targetHandle": "in_image"},
                {"id": "e2", "source": "n2", "sourceHandle": "text", "target": "n3", "targetHandle": "text"},
            ],
        },
    },
    {
        "id": "expand_kling",
        "name": "图片扩图·可灵",
        "description": "上传图片 → 可灵扩图 → 输出",
        "category": "图片编辑",
        "icon": "image",
        "nodes": 3,
        "tags": ["可灵", "扩图", "Outpainting"],
        "flow": {
            "nodes": [
                {"id": "n1", "type": "image", "position": {"x": 100, "y": 200},
                 "data": {"image_path": ""}},
                {"id": "n2", "type": "image_edit", "position": {"x": 400, "y": 200},
                 "data": {"edit_mode": "kling_expand"}},
                {"id": "n3", "type": "output", "position": {"x": 700, "y": 200},
                 "data": {"name": "扩图结果"}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "sourceHandle": "out", "target": "n2", "targetHandle": "in_image"},
                {"id": "e2", "source": "n2", "sourceHandle": "out", "target": "n3", "targetHandle": "in"},
            ],
        },
    },
    {
        "id": "super_res_jimeng",
        "name": "超分辨率·即梦",
        "description": "上传图片 → 即梦超分辨率 → 输出",
        "category": "图片编辑",
        "icon": "image",
        "nodes": 3,
        "tags": ["即梦", "超分", "4K/8K"],
        "flow": {
            "nodes": [
                {"id": "n1", "type": "image", "position": {"x": 100, "y": 200},
                 "data": {"image_path": ""}},
                {"id": "n2", "type": "image_edit", "position": {"x": 400, "y": 200},
                 "data": {"edit_mode": "jimeng_super"}},
                {"id": "n3", "type": "output", "position": {"x": 700, "y": 200},
                 "data": {"name": "高清结果"}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "sourceHandle": "out", "target": "n2", "targetHandle": "in_image"},
                {"id": "e2", "source": "n2", "sourceHandle": "out", "target": "n3", "targetHandle": "in"},
            ],
        },
    },
]


def _load() -> list[dict]:
    if TEMPLATES_PATH.exists():
        try:
            return json.loads(TEMPLATES_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    # 首次返回内置模板
    return [{"id": t["id"], "name": t["name"], "description": t["description"],
             "category": t["category"], "icon": t["icon"], "nodes": t["nodes"],
             "tags": t["tags"]} for t in _BUILTIN]


def _load_full() -> list[dict]:
    return _BUILTIN


def _find(tpl_id: str) -> dict | None:
    for t in _BUILTIN:
        if t["id"] == tpl_id:
            return t
    return None


@router.get("")
def list_templates() -> dict:
    return {"ok": True, "data": _load()}


@router.get("/{tpl_id}")
def get_template(tpl_id: str) -> dict:
    t = _find(tpl_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"ok": True, "data": t["flow"]}