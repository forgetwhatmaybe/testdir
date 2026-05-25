"""设置：API 密钥读写、测试连接、帮助文本、模板。"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from models.schemas import ApiKeysPayload, TestConnectionRequest
from services import crypto

router = APIRouter(prefix="/api/settings", tags=["settings"])

RES_DIR = Path(__file__).resolve().parent.parent / "resources"


@router.get("/api-keys")
def get_keys() -> dict:
    return {"ok": True, "data": crypto.masked_settings()}


@router.put("/api-keys")
def put_keys(payload: ApiKeysPayload) -> dict:
    existing = crypto.load_settings()
    existing_map = {e["provider"]: e.get("fields", {}) for e in existing.get("keys", [])}
    new_map: dict[str, dict] = {}
    mask_marker = "*"
    for entry in payload.keys:
        merged: dict[str, str] = {}
        old = existing_map.get(entry.provider, {})
        for k, v in entry.fields.items():
            if v and mask_marker in v and old.get(k) and v.startswith(old[k][:3]):
                merged[k] = old[k]
            else:
                merged[k] = v
        new_map[entry.provider] = merged
    crypto.save_settings({"keys": [
        {"provider": p, "fields": f} for p, f in new_map.items()
    ]})
    return {"ok": True}


@router.post("/test-connection")
def test_connection(req: TestConnectionRequest) -> dict:
    from api_clients.kling import KlingClient
    from api_clients.jimeng import JimengClient
    from api_clients.gemini import GeminiClient
    from api_clients.veo3 import Veo3Client
    from api_clients.text_vision import TextVisionClient
    from api_clients.seedance2 import Seedance2Client

    keys = crypto.get_keys(req.provider)
    try:
        if req.provider == "kling":
            ok = KlingClient(keys.get("access_key", ""), keys.get("secret_key", "")).test_connection()
        elif req.provider == "jimeng":
            ok = JimengClient(keys.get("access_key", ""), keys.get("secret_key", "")).test_connection()
        elif req.provider == "gemini":
            ok = GeminiClient(keys.get("api_key", ""), keys.get("base_url", "")).test_connection()
        elif req.provider == "veo3":
            ok = Veo3Client(keys.get("api_key", "")).test_connection()
        elif req.provider == "seedance2":
            ok = Seedance2Client(keys.get("api_key", "")).test_connection()
        elif req.provider in {"gpt_vision", "gemini_vision"}:
            ok = TextVisionClient(keys.get("api_key", ""), keys.get("base_url", "")).test_connection(
                "gpt-5.4" if req.provider == "gpt_vision" else "gemini-3.1-pro-preview"
            )
        else:
            raise HTTPException(status_code=400, detail=f"未知 provider: {req.provider}")
        return {"ok": True, "data": {"connected": bool(ok)}}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/general")
def get_general() -> dict:
    settings = crypto.load_settings()
    return {"ok": True, "data": settings.get("general") or {
        "show_help_panel": True,
        "default_disk": "",
    }}


@router.put("/general")
def put_general(payload: dict) -> dict:
    settings = crypto.load_settings()
    settings["general"] = {
        "show_help_panel": bool(payload.get("show_help_panel", True)),
        "default_disk": str(payload.get("default_disk", "") or ""),
    }
    crypto.save_settings(settings)
    return {"ok": True}


@router.get("/help-text")
def help_text() -> dict:
    p = RES_DIR / "sm.txt"
    if not p.exists():
        return {"ok": True, "data": []}
    lines = [ln.rstrip() for ln in p.read_text(encoding="utf-8").splitlines() if ln.strip()]
    return {"ok": True, "data": lines}


@router.get("/templates")
def templates() -> dict:
    p = RES_DIR / "templates.json"
    if not p.exists():
        return {"ok": True, "data": []}
    try:
        return {"ok": True, "data": json.loads(p.read_text(encoding="utf-8"))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
