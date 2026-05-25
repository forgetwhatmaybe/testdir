"""可灵 AI 客户端（图生视频 / 首尾帧 / 扩图）— JWT错误处理增强版。"""
from __future__ import annotations

import base64
import json
import time
from pathlib import Path
from typing import Optional

import jwt
import requests

from .base import make_retry_session


# 可灵 API 错误码完整映射
KLING_ERROR_CODES = {
    1200: ("AuthFailure", "认证失败：JWT签名无效或已过期"),
    1201: ("InvalidAccessKeyId", "Access Key ID 无效"),
    1202: ("NoPermission", "账号无权限，请检查账户状态"),
    1203: ("ResourceNotFound", "接口路径不存在，请检查API版本"),
    1204: ("LimitExceeded", "超出调用频率限制"),
    1205: ("InternalError", "可灵内部服务错误"),
    1206: ("ServiceUnavailable", "可灵服务暂不可用"),
    1300: ("InvalidParameter", "请求参数错误"),
    1301: ("InvalidImageFormat", "图片格式不支持"),
    1302: ("ConcurrentLimit", "并发请求过多，请稍后重试"),
    1303: ("RateLimitExceeded", "请求频率超限"),
    1304: ("QuotaExhausted", "当日配额已用完"),
    1400: ("TaskNotFound", "任务 ID 不存在"),
    1401: ("TaskFailed", "任务执行失败"),
    1402: ("TaskTimeout", "任务执行超时"),
    1403: ("TaskCancelled", "任务已被取消"),
}

KLING_JWT_ERROR_PATTERNS = [
    ("expired", "JWT Token 已过期，正在自动刷新"),
    ("immature signature", "JWT Token 签名时间早于 nbf，系统时间可能不准确"),
    ("invalid signature", "JWT Secret Key 无效或格式错误"),
    ("invalid token", "JWT Token 格式无效"),
    ("not enough segments", "JWT Token 格式错误（缺少分隔段）"),
    ("algorithm", "JWT 签名算法不匹配（需要 HS256）"),
]


class KlingClient:
    BASE_URL = "https://api-beijing.klingai.com"

    def __init__(self, access_key: str, secret_key: str) -> None:
        self.access_key = (access_key or "").strip()
        self.secret_key = (secret_key or "").strip()
        self._session = make_retry_session()
        self._cached_token: Optional[str] = None
        self._token_expiry = 0
        self._last_jwt_error: Optional[str] = None

    def _jwt(self) -> str:
        now = int(time.time())
        if self._cached_token and self._token_expiry > now + 300:
            return self._cached_token
        try:
            payload = {"iss": self.access_key, "exp": now + 1800, "nbf": now - 5}
            token = jwt.encode(payload, self.secret_key, algorithm="HS256",
                               headers={"alg": "HS256", "typ": "JWT"})
            self._cached_token = token
            self._token_expiry = now + 1800
            self._last_jwt_error = None
            return token
        except jwt.ExpiredSignatureError:
            raise Exception("可灵 JWT 签名错误：Token 已过期（系统时间异常）")
        except jwt.InvalidTokenError as e:
            self._last_jwt_error = str(e)
            raise Exception(f"可灵 JWT 生成失败：{self._diagnose_jwt_error(str(e))}")
        except Exception as e:
            raise Exception(f"可灵 JWT 生成失败：{str(e)}")

    def _diagnose_jwt_error(self, msg: str) -> str:
        """诊断 JWT 错误并给出可操作的提示"""
        for keyword, explanation in KLING_JWT_ERROR_PATTERNS:
            if keyword in msg.lower():
                return explanation
        return f"未知JWT错误: {msg}"

    def _headers(self) -> dict:
        return {"Content-Type": "application/json", "Authorization": f"Bearer {self._jwt()}"}

    def test_connection(self) -> bool:
        if not self.access_key or not self.secret_key:
            raise Exception("可灵 access_key / secret_key 未配置")
        try:
            resp = requests.get(f"{self.BASE_URL}/v1/videos/image2video",
                                headers=self._headers(), timeout=30)
        except Exception as e:
            raise Exception(f"可灵 网络连接失败：{str(e)}")

        try:
            data = resp.json()
        except Exception:
            data = {}

        code = data.get("code", -1)

        if resp.status_code in (200, 400):
            # 400 但有正常code也可能是参数缺省，允许通过
            return True
        if resp.status_code == 404 and code in (1202, 1203):
            return True

        # 详细错误诊断
        if resp.status_code == 401:
            detail = KLING_ERROR_CODES.get(code, (None, None))
            if detail[0]:
                raise Exception(f"可灵 认证失败 (code={code}): {detail[1]}")
            raise Exception(f"可灵 密钥无效 (HTTP 401, code={code})")
        if resp.status_code == 403:
            detail = KLING_ERROR_CODES.get(code, (None, None))
            if detail[0]:
                raise Exception(f"可灵 权限不足 (code={code}): {detail[1]}")
            raise Exception(f"可灵 无权限，请检查账户余额和配额 (HTTP 403)")
        if resp.status_code == 429:
            raise Exception("可灵 请求频率超限，请稍后重试 (HTTP 429)")
        if resp.status_code >= 500:
            raise Exception(f"可灵 服务器错误 (HTTP {resp.status_code})：可灵服务暂时不可用")

        raise Exception(f"可灵 连接失败: HTTP {resp.status_code} {resp.text[:200]}")

    @staticmethod
    def _b64(path: str) -> str:
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode()

    @staticmethod
    def _is_omni(model: str) -> bool:
        return model == "kling-video-o1"

    def _handle_api_error(self, code: int, message: str, status_code: int = 0) -> str:
        """统一错误消息生成"""
        detail = KLING_ERROR_CODES.get(code)
        if detail:
            return f"可灵 {detail[0]} (code={code}): {detail[1]}"
        return f"可灵 错误 code={code}: {message}"

    def submit_image_to_video(self, image_path: str, prompt: str, *,
                               model: str = "kling-v1", duration: int = 5,
                               mode: str = "std", cfg_scale: float = 0.5,
                               tail_image: Optional[str] = None) -> str:
        if self._is_omni(model):
            return self._submit_omni(image_path, prompt, model, duration, mode, tail_image)
        return self._submit_i2v(image_path, prompt, model, duration, mode, cfg_scale, tail_image)

    def _submit_i2v(self, image_path: str, prompt: str, model: str, duration: int,
                    mode: str, cfg_scale: float, tail_image: Optional[str]) -> str:
        payload = {
            "model_name": model,
            "image": self._b64(image_path),
            "prompt": prompt,
            "duration": duration,
            "cfg_scale": cfg_scale,
            "mode": mode,
        }
        if tail_image:
            payload["image_tail"] = self._b64(tail_image)

        for attempt in range(6):
            try:
                r = self._session.post(f"{self.BASE_URL}/v1/videos/image2video",
                                       headers=self._headers(), json=payload, timeout=(15, 60))
            except requests.exceptions.Timeout:
                if attempt < 5:
                    time.sleep(10 * (attempt + 1))
                    continue
                raise Exception("可灵 请求超时：网络不稳定或可灵服务响应慢")

            if r.status_code == 200:
                d = r.json()
                code = d.get("code", -1)
                if code == 0:
                    return d.get("data", {}).get("task_id", "")

                # 限流/并发重试
                if code in (1302, 1303, 1204):
                    wait = 30 * (attempt + 1)
                    print(f"可灵 限流(code={code}): {wait}秒后重试({attempt+1}/6)")
                    time.sleep(wait)
                    continue

                # 配额耗尽 — 不重试
                if code == 1304:
                    raise Exception(self._handle_api_error(code, d.get("message", "")))

                # JWT 过期 — 强制刷新 token
                if code == 1200:
                    self._cached_token = None
                    self._token_expiry = 0
                    if attempt < 2:
                        continue
                    raise Exception(self._handle_api_error(code, d.get("message", "")))

                raise Exception(self._handle_api_error(code, d.get("message", "")))

            if r.status_code == 401:
                # JWT 认证失败，刷新 token 重试
                self._cached_token = None
                self._token_expiry = 0
                if attempt < 3:
                    continue
                raise Exception("可灵 JWT 认证持续失败，请检查 Access Key 和 Secret Key")

            if r.status_code == 429:
                wait = 30 * (attempt + 1)
                time.sleep(wait)
                continue

            if r.status_code >= 500 and attempt < 3:
                time.sleep(15 * (attempt + 1))
                continue

            try:
                d = r.json()
                code = d.get("code", -1)
                raise Exception(self._handle_api_error(code, d.get("message", ""), r.status_code))
            except json.JSONDecodeError:
                raise Exception(f"可灵 API Error: HTTP {r.status_code} - {r.text[:300]}")

        raise Exception("可灵 提交失败：多次限流或认证失败，请稍后重试")

    def _submit_omni(self, image_path: str, prompt: str, model: str, duration: int,
                     mode: str, tail_image: Optional[str]) -> str:
        image_list = [{"image_url": self._b64(image_path), "type": "first_frame"}]
        if tail_image:
            image_list.append({"image_url": self._b64(tail_image), "type": "end_frame"})
        payload = {"model_name": model, "prompt": prompt, "duration": duration,
                   "mode": mode, "image_list": image_list}

        for attempt in range(3):
            r = self._session.post(f"{self.BASE_URL}/v1/videos/omni-video",
                                    headers=self._headers(), json=payload, timeout=(15, 60))
            if r.status_code == 200:
                d = r.json()
                if d.get("code") == 0:
                    return d.get("data", {}).get("task_id", "")
                raise Exception(self._handle_api_error(d.get("code", -1), d.get("message", "")))
            if r.status_code == 401:
                self._cached_token = None
                self._token_expiry = 0
                if attempt < 2:
                    continue
                raise Exception("可灵 Omni JWT 认证失败")
            if r.status_code == 429 and attempt < 2:
                time.sleep(30)
                continue
            raise Exception(f"可灵 Omni: HTTP {r.status_code} {r.text[:200]}")
        raise Exception("可灵 Omni 提交失败")

    def query_video(self, task_id: str) -> tuple[str, Optional[str]]:
        for path in ("image2video", "omni-video"):
            try:
                r = self._session.get(f"{self.BASE_URL}/v1/videos/{path}/{task_id}",
                                       headers=self._headers(), timeout=(10, 30))
            except Exception:
                continue

            if r.status_code != 200:
                # 401 JWT 过期重试一次
                if r.status_code == 401:
                    self._cached_token = None
                    self._token_expiry = 0
                    try:
                        r = self._session.get(f"{self.BASE_URL}/v1/videos/{path}/{task_id}",
                                               headers=self._headers(), timeout=(10, 30))
                        if r.status_code != 200:
                            continue
                    except Exception:
                        continue
                else:
                    continue

            d = r.json().get("data", {})
            status = d.get("task_status", "")
            videos = (d.get("task_result") or {}).get("videos") or []
            url = videos[0].get("url") if videos else None
            return status, url
        return "failed", None

    def submit_expand_image(self, image_path: str, **kwargs) -> str:
        payload = {
            "image": self._b64(image_path),
            "up_expansion_ratio": float(kwargs.get("up_expansion_ratio", 0.0)),
            "down_expansion_ratio": float(kwargs.get("down_expansion_ratio", 0.0)),
            "left_expansion_ratio": float(kwargs.get("left_expansion_ratio", 0.0)),
            "right_expansion_ratio": float(kwargs.get("right_expansion_ratio", 0.0)),
            "n": int(kwargs.get("n", 1)),
        }
        prompt = kwargs.get("prompt") or ""
        if prompt:
            payload["prompt"] = prompt

        r = self._session.post(f"{self.BASE_URL}/v1/images/editing/expand",
                                headers=self._headers(), json=payload, timeout=(15, 60))
        if r.status_code != 200:
            try:
                d = r.json()
                raise Exception(self._handle_api_error(d.get("code", -1), d.get("message", ""), r.status_code))
            except json.JSONDecodeError:
                raise Exception(f"可灵扩图 API: HTTP {r.status_code} {r.text[:200]}")

        d = r.json()
        if d.get("code") != 0:
            raise Exception(self._handle_api_error(d.get("code", -1), d.get("message", "")))
        return d.get("data", {}).get("task_id", "")

    def query_expand(self, task_id: str) -> tuple[str, Optional[str]]:
        for attempt in range(2):
            r = self._session.get(f"{self.BASE_URL}/v1/images/editing/expand/{task_id}",
                                   headers=self._headers(), timeout=(10, 30))
            if r.status_code == 401 and attempt == 0:
                self._cached_token = None
                self._token_expiry = 0
                continue
            if r.status_code != 200:
                return "failed", None
            d = r.json().get("data", {})
            status = d.get("task_status", "")
            images = (d.get("task_result") or {}).get("images") or []
            return status, (images[0].get("url") if images else None)
        return "failed", None