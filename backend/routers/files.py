"""文件接口：上传/原始流/缩略图/压缩/打开文件夹/保存蒙版。"""
from __future__ import annotations

import base64
import os
import shutil
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from models.schemas import FilesOpenRequest, SaveMaskRequest
from services import project_manager as pm
from services.thumbnail import extract_video_thumbnail, compress_images_batch


class CompressRequest(BaseModel):
    image_paths: list[str]

router = APIRouter(prefix="/api/files", tags=["files"])


def _resolve_in_project(project: str, rel_path: str) -> Path:
    root = pm.find_project(project)
    candidate = (root / rel_path).resolve()
    root_resolved = root.resolve()
    if root_resolved not in candidate.parents and candidate != root_resolved:
        raise HTTPException(status_code=400, detail="路径越界")
    return candidate


@router.post("/upload")
async def upload(project: str = Form(...), file: UploadFile = File(...)) -> dict:
    root = pm.find_project(project)
    target_dir = root / "素材库"
    target_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename).name
    target = target_dir / safe_name
    counter = 1
    while target.exists():
        target = target_dir / f"{Path(safe_name).stem}_{counter}{Path(safe_name).suffix}"
        counter += 1
    with target.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    rel = target.relative_to(root).as_posix()
    return {"ok": True, "data": {"rel_path": rel, "abs_path": str(target)}}


@router.get("/raw")
def raw(project: str, path: str):
    abs_path = _resolve_in_project(project, path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(str(abs_path))


@router.get("/thumbnail")
def thumbnail(project: str, path: str):
    abs_path = _resolve_in_project(project, path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    ext = abs_path.suffix.lower()
    if ext in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}:
        return FileResponse(str(abs_path))
    thumb = abs_path.with_name(abs_path.stem + "_thumb.jpg")
    if not thumb.exists():
        ok = extract_video_thumbnail(str(abs_path), str(thumb))
        if not ok:
            raise HTTPException(status_code=500, detail="无法生成缩略图")
    return FileResponse(str(thumb))


@router.post("/open-folder")
def open_folder(req: FilesOpenRequest) -> dict:
    raw = req.path
    p = Path(raw)
    # 兼容相对项目根（"项目名/素材库/x.png"）
    if not p.is_absolute():
        parts = raw.replace("\\", "/").split("/", 1)
        if len(parts) == 2:
            project, rest = parts
            try:
                root = pm.find_project(project)
                p = root / rest
            except Exception:
                pass
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"路径不存在: {p}")
    if sys.platform.startswith("win"):
        if p.is_file():
            subprocess.Popen(["explorer", "/select,", str(p)])
        else:
            subprocess.Popen(["explorer", str(p)])
    elif sys.platform == "darwin":
        subprocess.Popen(["open", "-R", str(p)] if p.is_file() else ["open", str(p)])
    else:
        subprocess.Popen(["xdg-open", str(p.parent if p.is_file() else p)])
    return {"ok": True}


@router.post("/open-with-system")
def open_with_system(req: FilesOpenRequest) -> dict:
    raw = req.path
    p = Path(raw)
    if not p.is_absolute():
        parts = raw.replace("\\", "/").split("/", 1)
        if len(parts) == 2:
            project, rest = parts
            try:
                root = pm.find_project(project)
                p = root / rest
            except Exception:
                pass
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"路径不存在: {p}")
    if sys.platform.startswith("win"):
        os.startfile(str(p))  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(p)])
    else:
        subprocess.Popen(["xdg-open", str(p)])
    return {"ok": True}


@router.post("/save-mask")
def save_mask(req: SaveMaskRequest) -> dict:
    root = pm.find_project(req.project)
    base = Path(req.image_name).stem
    out = root / "素材库" / f"{base}_mask.png"
    raw = req.png_base64
    if "," in raw:
        raw = raw.split(",", 1)[1]
    data = base64.b64decode(raw)
    out.write_bytes(data)
    rel = out.relative_to(root).as_posix()
    return {"ok": True, "data": {"rel_path": rel, "abs_path": str(out)}}


@router.post("/compress-batch")
async def compress_batch(req: CompressRequest) -> dict:
    """批量压缩图片。传入图片绝对路径列表，返回每张图的压缩结果与汇总。"""
    if not req.image_paths:
        raise HTTPException(status_code=400, detail="image_paths 不能为空")
    report = await compress_images_batch(req.image_paths)
    return {"ok": True, "data": report}
