"""生成历史：每次执行的参数 + 结果。存到项目根的 history.json。"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import project_manager as pm

router = APIRouter(prefix="/api/history", tags=["history"])


class HistoryAdd(BaseModel):
    project: str
    entry: dict[str, Any]


def _history_path(project: str) -> Path:
    root = pm.find_project(project)
    return root / "history.json"


@router.get("/{project}")
def list_history(project: str) -> dict:
    p = _history_path(project)
    if not p.exists():
        return {"ok": True, "data": []}
    try:
        return {"ok": True, "data": json.loads(p.read_text(encoding="utf-8"))}
    except Exception:
        return {"ok": True, "data": []}


@router.post("/")
def add_history(payload: HistoryAdd) -> dict:
    p = _history_path(payload.project)
    items: list = []
    if p.exists():
        try:
            items = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            items = []
    items.insert(0, payload.entry)
    items = items[:200]
    p.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "data": items}


@router.delete("/{project}")
def clear_history(project: str) -> dict:
    p = _history_path(project)
    if p.exists():
        p.write_text("[]", encoding="utf-8")
    return {"ok": True}
