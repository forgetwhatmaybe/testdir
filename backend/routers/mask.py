"""蒙版路由：涂抹/擦除蒙版生成、保存、加载、清除。"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import mask_service as ms

router = APIRouter(prefix="/api/mask", tags=["mask"])


class StrokesPayload(BaseModel):
    project: str
    image_name: str
    strokes: list[dict]  # [{"x":int,"y":int,"type":"paint"|"erase"}]
    brush_size: int = ms.DEFAULT_BRUSH_SIZE
    brush_color: Optional[list[int]] = None  # [R,G,B,A]
    original_size: Optional[list[int]] = None  # [w,h]


class SavePayload(StrokesPayload):
    pass


@router.post("/preview")
def preview_mask(payload: StrokesPayload) -> dict:
    color = tuple(payload.brush_color) if payload.brush_color else ms.DEFAULT_BRUSH_COLOR
    size = tuple(payload.original_size) if payload.original_size else None
    url = ms.create_mask_image(
        payload.project, payload.image_name,
        payload.strokes, payload.brush_size, color, size,
    )
    return {"ok": True, "data": url}


@router.post("/save")
def save_mask(payload: SavePayload) -> dict:
    color = tuple(payload.brush_color) if payload.brush_color else ms.DEFAULT_BRUSH_COLOR
    size = tuple(payload.original_size) if payload.original_size else None
    path = ms.save_mask(
        payload.project, payload.image_name,
        payload.strokes, payload.brush_size, color, size,
    )
    return {"ok": True, "data": str(path)}


@router.get("/{project}/{image_name}")
def get_mask(project: str, image_name: str) -> dict:
    url = ms.load_mask(project, image_name)
    if url is None:
        raise HTTPException(status_code=404, detail="Mask not found")
    return {"ok": True, "data": url}


@router.delete("/{project}/{image_name}")
def delete_mask(project: str, image_name: str) -> dict:
    ok = ms.delete_mask(project, image_name)
    return {"ok": ok}