"""Veo3（向量引擎中转）。"""
from __future__ import annotations

import base64
import time
from pathlib import Path
from typing import Optional

import requests

from .base import make_retry_session


class Veo3Client:
    BASE = "https://api.vectorengine.ai"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key or ""
        self._session = make_retry_session()

    def test_connection(self) -> bool:
        if not self.api_key:
            raise Exception("Veo3 api_key 未配置")
        return True

    @staticmethod
    def _data_url(path: str) -> str:
        ext = Path(path).suffix.lower()
        mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                ".webp": "image/webp"}.get(ext, "image/jpeg")
        with open(path, "rb") as f:
            return f"data:{mime};base64,{base64.b64encode(f.read()).decode()}"

    def submit(self, prompt: str, *, model: str = "veo_3_1",
                images: Optional[list[str]] = None,
                enhance_prompt: bool = True, enable_upsample: bool = True,
                aspect_ratio: str = "16:9") -> str:
        body: dict = {"prompt": prompt, "model": model,
                       "enhance_prompt": enhance_prompt,
                       "enable_upsample": enable_upsample}
        if "veo3" in model or "veo_3_1" in model:
            body["aspect_ratio"] = aspect_ratio
        if images:
            urls = []
            for p in images:
                if p and Path(p).exists():
                    urls.append(self._data_url(p))
            if urls:
                body["images"] = urls
        headers = {"Authorization": f"Bearer {self.api_key}",
                   "Content-Type": "application/json", "Accept": "application/json"}
        for attempt in range(1, 4):
            try:
                r = self._session.post(f"{self.BASE}/v1/video/create",
                                        headers=headers, json=body, timeout=(30, 180))
                if r.status_code != 200:
                    raise Exception(f"Veo3 HTTP {r.status_code}: {r.text[:300]}")
                data = r.json()
                tid = data.get("id", "")
                if not tid:
                    raise Exception(f"Veo3 未返回任务 ID: {str(data)[:300]}")
                return tid
            except (requests.exceptions.SSLError,
                    requests.exceptions.ConnectionError,
                    requests.exceptions.Timeout):
                if attempt < 3:
                    time.sleep(5 * attempt)
                    continue
                raise

    def query(self, task_id: str) -> dict:
        headers = {"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"}
        r = self._session.get(f"{self.BASE}/v1/video/query?id={task_id}",
                               headers=headers, timeout=(30, 120))
        if r.status_code != 200:
            return {"status": "failed", "error": f"HTTP {r.status_code}: {r.text[:200]}"}
        data = r.json()
        status = data.get("status", "pending")
        out: dict = {"status": status}
        if status == "completed":
            url = data.get("video_url")
            if not url and "detail" in data:
                d = data.get("detail", {})
                url = d.get("upsample_video_url") or d.get("video_url")
            if not url:
                url = data.get("output_url") or data.get("url")
            if not url and "choices" in data and data["choices"]:
                url = data["choices"][0].get("video_url") or data["choices"][0].get("url")
            out["video_url"] = url
        elif status == "failed":
            err = data.get("error") or data.get("message")
            if isinstance(err, dict):
                err = err.get("message") or str(err)
            out["error"] = err or "未知错误"
        return out
