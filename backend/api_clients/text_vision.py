"""文本视觉：GPT-5.4 / Gemini-3.1 Pro，支持 thinking_mode + format_mode + temperature。"""
from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Optional

from .base import make_retry_session


SYS_PROMPT_JSON = (
    "你是一个图像理解助手。请根据用户给定的图片，输出严格、可被 json.loads "
    "解析的 JSON 对象。不要包含解释，不要使用代码块。"
)
SYS_PROMPT_REVERSE = (
    "你是图像反推助手。请根据用户提供的图片输出 JSON：\n"
    "{\n  \"subject\": \"主体描述\",\n  \"style\": \"风格\",\n  \"camera\": \"机位/景别\",\n"
    "  \"lighting\": \"光照\",\n  \"palette\": \"色彩\",\n  \"keywords\": [\"...\"]\n}\n"
    "只输出 JSON 字面量。"
)


class TextVisionClient:
    DEFAULT_BASE = "https://api.vectorengine.ai"

    def __init__(self, api_key: str, base_url: str = "") -> None:
        self.api_key = api_key or ""
        self.base_url = (base_url.strip().rstrip("/") if base_url else self.DEFAULT_BASE) or self.DEFAULT_BASE
        self._session = make_retry_session()

    def test_connection(self, model: str = "gpt-5.4") -> bool:
        if not self.api_key:
            raise Exception("api_key 未配置")
        if model.startswith("gpt"):
            url = f"{self.base_url}/v1/models"
            r = self._session.get(url, headers={"Authorization": f"Bearer {self.api_key}"}, timeout=(10, 30))
        else:
            url = f"{self.base_url}/v1beta/models?key={self.api_key}"
            r = self._session.get(url, timeout=(10, 30))
        if r.status_code == 200:
            return True
        if r.status_code == 401:
            raise Exception("API 密钥无效")
        raise Exception(f"连接失败 HTTP {r.status_code}")

    @staticmethod
    def _b64_data_url(path: str) -> str:
        ext = Path(path).suffix.lower()
        mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp"}.get(ext, "image/png")
        with open(path, "rb") as f:
            return f"data:{mime};base64,{base64.b64encode(f.read()).decode()}"

    @staticmethod
    def _system_prompt(format_mode: str) -> str:
        if format_mode == "图片反推json":
            return SYS_PROMPT_REVERSE
        if format_mode == "json格式":
            return SYS_PROMPT_JSON
        return ""

    @staticmethod
    def _format_text(text: str, format_mode: str) -> str:
        if format_mode == "无":
            return text
        # 抽取 ```json ... ``` 中的内容
        s = text.strip()
        if s.startswith("```"):
            s = s.strip("`")
            if s.lower().startswith("json"):
                s = s[4:]
            s = s.strip()
        return s

    def generate_text(self, prompt: str, image_paths: Optional[list[str]] = None, *,
                       model: str = "gpt-5.4", temperature: float = 0.7,
                       thinking_mode: str = "none", format_mode: str = "无") -> str:
        # 区分 GPT vs Gemini 风格
        if model.startswith("gpt"):
            return self._call_gpt(prompt, image_paths, model, temperature, thinking_mode, format_mode)
        return self._call_gemini(prompt, image_paths, model, temperature, thinking_mode, format_mode)

    def _call_gpt(self, prompt: str, image_paths, model, temperature, thinking_mode, format_mode) -> str:
        sys_prompt = self._system_prompt(format_mode)
        messages: list[dict] = []
        if sys_prompt:
            messages.append({"role": "system", "content": sys_prompt})
        content_parts: list[dict] = [{"type": "text", "text": prompt}]
        for p in image_paths or []:
            if p and Path(p).exists():
                content_parts.append({"type": "image_url", "image_url": {"url": self._b64_data_url(p)}})
        messages.append({"role": "user", "content": content_parts})

        body: dict = {"model": model, "messages": messages,
                       "reasoning_effort": thinking_mode or "none"}
        if (thinking_mode or "none") == "none":
            body["temperature"] = temperature

        url = f"{self.base_url}/v1/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        r = self._session.post(url, headers=headers, json=body, timeout=(30, 600))
        if r.status_code != 200:
            raise Exception(f"GPT 视觉 HTTP {r.status_code}: {r.text[:300]}")
        data = r.json()
        choices = data.get("choices") or []
        if not choices:
            raise Exception(f"GPT 视觉 空响应: {str(data)[:300]}")
        msg = choices[0].get("message") or {}
        return self._format_text(msg.get("content") or "", format_mode)

    def _call_gemini(self, prompt: str, image_paths, model, temperature, thinking_mode, format_mode) -> str:
        sys_prompt = self._system_prompt(format_mode)
        parts: list[dict] = []
        if sys_prompt:
            parts.append({"text": sys_prompt + "\n\n" + prompt})
        else:
            parts.append({"text": prompt})
        for p in image_paths or []:
            if p and Path(p).exists():
                ext = Path(p).suffix.lower()
                mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                        ".webp": "image/webp"}.get(ext, "image/png")
                with open(p, "rb") as f:
                    parts.append({"inlineData": {"mimeType": mime,
                                                  "data": base64.b64encode(f.read()).decode()}})

        body = {
            "contents": [{"parts": parts}],
            "generationConfig": {"temperature": temperature},
        }
        url = f"{self.base_url}/v1beta/models/{model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json",
                   "thinking-level": "low" if thinking_mode == "minimal" else (thinking_mode or "low")}
        r = self._session.post(url, headers=headers, json=body, timeout=(30, 600))
        if r.status_code != 200:
            raise Exception(f"Gemini 视觉 HTTP {r.status_code}: {r.text[:300]}")
        data = r.json()
        candidates = data.get("candidates") or []
        if not candidates:
            raise Exception(f"Gemini 视觉 空候选: {str(data)[:200]}")
        ps = ((candidates[0].get("content") or {}).get("parts")) or []
        text = "".join(p.get("text", "") for p in ps)
        return self._format_text(text, format_mode)
