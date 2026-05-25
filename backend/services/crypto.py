"""API 密钥加密存取（Fernet）。"""
from __future__ import annotations

import json
from pathlib import Path

from cryptography.fernet import Fernet

from config import SECRET_KEY_PATH, SETTINGS_PATH


def _load_or_create_key() -> bytes:
    if SECRET_KEY_PATH.exists():
        return SECRET_KEY_PATH.read_bytes().strip()
    key = Fernet.generate_key()
    SECRET_KEY_PATH.write_bytes(key)
    return key


_FERNET = Fernet(_load_or_create_key())


def load_settings() -> dict:
    if not SETTINGS_PATH.exists():
        return {"keys": []}
    raw = SETTINGS_PATH.read_bytes()
    if not raw:
        return {"keys": []}
    try:
        plain = _FERNET.decrypt(raw)
        return json.loads(plain.decode("utf-8"))
    except Exception:
        return {"keys": []}


def save_settings(data: dict) -> None:
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    enc = _FERNET.encrypt(payload)
    SETTINGS_PATH.write_bytes(enc)


def get_keys(provider: str) -> dict[str, str]:
    settings = load_settings()
    for entry in settings.get("keys", []):
        if entry.get("provider") == provider:
            return entry.get("fields") or {}
    return {}


def mask_value(v: str) -> str:
    if not v:
        return ""
    if len(v) <= 6:
        return "*" * len(v)
    return v[:3] + "*" * (len(v) - 6) + v[-3:]


def masked_settings() -> dict:
    settings = load_settings()
    out = {"keys": []}
    for entry in settings.get("keys", []):
        out["keys"].append({
            "provider": entry["provider"],
            "fields": {k: mask_value(v) for k, v in (entry.get("fields") or {}).items()},
        })
    return out
