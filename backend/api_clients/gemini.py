"""Gemini（香蕉模型）图片生成。"""
from __future__ import annotations

import base64
import time
from pathlib import Path
from typing import Optional

import requests

from .base import make_retry_session


class GeminiClient:
    DEFAULT_BASE = "https://api.vectorengine.ai/v1beta"

    def __init__(self, api_key: str, base_url: str = "") -> None:
        self.api_key = api_key or ""
        self.base_url = (base_url.strip().rstrip("/") if base_url else self.DEFAULT_BASE) or self.DEFAULT_BASE
        self._session = make_retry_session()

    def test_connection(self) -> bool:
        if not self.api_key:
            raise Exception("Gemini api_key 未配置")
        url = f"{self.base_url}/models?key={self.api_key}"
        r = self._session.get(url, timeout=(10, 30))
        if r.status_code == 200:
            return True
        if r.status_code in (401, 403):
            raise Exception("Gemini 密钥无效或无权限")
        if r.status_code == 429:
            raise Exception("Gemini 请求过于频繁")
        raise Exception(f"Gemini 错误: HTTP {r.status_code} {r.text[:200]}")

    @staticmethod
    def _mime(path: str) -> str:
        ext = Path(path).suffix.lower()
        return {
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp",
        }.get(ext, "image/png")

    def generate_image(self, prompt: str, image_paths: Optional[list[str]] = None, *,
                        model: str = "gemini-2.5-flash-preview-image-generation",
                        aspect_ratio: str = "1:1", image_size: str = "",
                        save_path: str = "output.png",
                        is_stopped=None, timeout_seconds: int = 1200) -> Optional[str]:
        parts = [{"text": f"生成图片{prompt}生成图片"}]
        if image_paths:
            for p in image_paths:
                if not p or not Path(p).exists():
                    continue
                with open(p, "rb") as f:
                    parts.append({"inlineData": {"mimeType": self._mime(p),
                                                  "data": base64.b64encode(f.read()).decode()}})
        gen_cfg: dict = {"responseModalities": ["TEXT", "IMAGE"]}
        img_cfg: dict = {}
        if aspect_ratio:
            img_cfg["aspectRatio"] = aspect_ratio
        if image_size and ("pro" in model.lower() or "3.1-flash" in model.lower()):
            img_cfg["imageSize"] = image_size
        if img_cfg:
            gen_cfg["imageConfig"] = img_cfg
        body = {"contents": [{"parts": parts}], "generationConfig": gen_cfg}
        url = f"{self.base_url}/models/{model}:generateContent?key={self.api_key}"

        started = time.time()
        for attempt in range(1, 7):
            if is_stopped and is_stopped():
                return None
            remaining = timeout_seconds - (time.time() - started)
            if remaining <= 0:
                raise Exception(f"Gemini 超时 {timeout_seconds//60} 分钟")
            try:
                r = self._session.post(url, json=body,
                                        timeout=(15, max(30, int(remaining))))
                if r.status_code == 429:
                    time.sleep(min(30 * attempt, max(0, remaining)))
                    continue
                if r.status_code == 200:
                    return self._extract(r.json(), save_path)
                raise Exception(f"Gemini 错误 HTTP {r.status_code}: {r.text[:300]}")
            except (requests.exceptions.SSLError,
                    requests.exceptions.ConnectionError,
                    requests.exceptions.Timeout,
                    requests.exceptions.ChunkedEncodingError):
                if attempt < 6:
                    time.sleep(min(5 * attempt, max(0, timeout_seconds - (time.time() - started))))
                    continue
                raise
        raise Exception("Gemini 超过最大重试次数")

    @staticmethod
    def _extract(data: dict, save_path: str) -> Optional[str]:
        candidates = data.get("candidates") or []
        if not candidates:
            block = (data.get("promptFeedback") or {}).get("blockReason")
            if block:
                raise Exception(f"被安全过滤拦截: {block}")
            raise Exception("Gemini 响应空 candidates")
        parts = ((candidates[0].get("content") or {}).get("parts")) or []
        for part in parts:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                Path(save_path).parent.mkdir(parents=True, exist_ok=True)
                with open(save_path, "wb") as f:
                    f.write(base64.b64decode(inline["data"]))
                return save_path
        raise Exception("Gemini 响应未包含图像")
