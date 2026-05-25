"""Seedance 2.0 客户端：参考图/视频/音频 → 视频。"""
from __future__ import annotations

import time
from typing import Optional

from .base import make_retry_session


class Seedance2Client:
    BASE = "https://api.evolink.ai"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key or ""
        self._session = make_retry_session()

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    def test_connection(self) -> bool:
        if not self.api_key:
            raise Exception("Seedance 2.0 api_key 未配置")
        # 提交一个最小请求；429/200/201/4xx 均说明鉴权通过
        r = self._session.post(f"{self.BASE}/v1/videos/generations",
                                headers=self._headers(),
                                json={"model": "seedance-2.0", "prompt": "test"},
                                timeout=(10, 15))
        if r.status_code == 401:
            raise Exception("Seedance 2.0 密钥无效")
        if r.status_code in (200, 201, 429):
            return True
        if r.status_code < 500:
            return True
        raise Exception(f"Seedance 2.0 服务器错误 HTTP {r.status_code}")

    def submit(self, prompt: str, *, image_urls: Optional[list[str]] = None,
                video_urls: Optional[list[str]] = None,
                audio_urls: Optional[list[str]] = None,
                duration: int = 5, quality: str = "720p",
                aspect_ratio: str = "16:9", generate_audio: bool = True) -> str:
        payload: dict = {
            "model": "seedance-2.0", "prompt": prompt, "duration": duration,
            "quality": quality, "aspect_ratio": aspect_ratio,
            "generate_audio": generate_audio,
        }
        if image_urls: payload["image_urls"] = image_urls[:9]
        if video_urls: payload["video_urls"] = video_urls[:3]
        if audio_urls: payload["audio_urls"] = audio_urls[:3]

        for attempt in range(6):
            r = self._session.post(f"{self.BASE}/v1/videos/generations",
                                    headers=self._headers(), json=payload, timeout=(15, 60))
            if r.status_code in (200, 201):
                d = r.json()
                tid = d.get("id", "")
                if tid:
                    return tid
                raise Exception(f"Seedance 2.0 缺任务 ID: {d}")
            if r.status_code == 429:
                time.sleep(30 * (attempt + 1))
                continue
            try:
                err = r.json().get("error", {}).get("message", r.text[:300])
            except Exception:
                err = r.text[:300]
            raise Exception(f"Seedance 2.0 提交失败 HTTP {r.status_code}: {err}")
        raise Exception("Seedance 2.0 限流多次后失败")

    def query(self, task_id: str) -> tuple[str, Optional[str]]:
        r = self._session.get(f"{self.BASE}/v1/tasks/{task_id}",
                               headers=self._headers(), timeout=(10, 30))
        if r.status_code != 200:
            return "failed", None
        d = r.json()
        status = d.get("status", "")
        results = d.get("results")
        url = results[0] if isinstance(results, list) and results else None
        return status, url
