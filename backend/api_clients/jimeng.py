"""即梦 AI 客户端（火山引擎）— 错误码完整识别增强版。"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests

from .base import make_retry_session

# 火山引擎 / 即梦 错误码完整映射
JIMENG_ERROR_CODES = {
    # 通用
    100: ("Continue", "请求继续"),
    20000000: ("Success", "操作成功"),
    # 参数 / 验证类
    50400: ("InvalidParameter", "请求参数缺失或格式错误"),
    50401: ("MissingParameter", "缺少必填参数"),
    50402: ("InvalidParameterValue", "参数值不在允许范围"),
    50403: ("InvalidImageFormat", "图片格式不支持（需要 JPG/PNG/WEBP）"),
    50404: ("InvalidImageSize", "图片尺寸超出限制或分辨率不足"),
    50405: ("PromptEmpty", "Prompt 为空"),
    50406: ("PromptTooLong", "Prompt 超过最大长度限制"),
    50407: ("InvalidModelVersion", "模型版本不存在"),
    50408: ("InvalidRatio", "宽高比参数无效"),
    50409: ("InvalidStyle", "风格参数无效"),
    # 认证 / 权限
    50500: ("AuthFailure", "HMAC-SHA256 签名失败"),
    50501: ("SignatureDoesNotMatch", "签名不匹配，请检查 Secret Key"),
    50502: ("AccessKeyNotFound", "Access Key 不存在或已停用"),
    50503: ("AccessDenied", "无权限调用此服务，请检查账户配额"),
    50504: ("AccountArrears", "账户欠费，请充值"),
    50505: ("AccountExpired", "账户已过期"),
    50506: ("ServiceNotEnabled", "该服务未开通，请在火山引擎控制台开通"),
    # 限流 / 配额
    50600: ("RateLimitExceeded", "调用频率超限"),
    50601: ("DailyQuotaExhausted", "当日调用配额已用完"),
    50602: ("ConcurrentLimitExceeded", "并发调用超限，请稍后重试"),
    50603: ("MonthlyQuotaExhausted", "月度配额已用完"),
    # 资源
    50700: ("ResourceNotFound", "任务 ID 不存在"),
    50701: ("ImageNotFound", "源图片未找到或链接已过期"),
    50702: ("ModelNotReady", "模型正在初始化或维护中"),
    # 任务
    50800: ("TaskTimeout", "任务执行超时"),
    50801: ("TaskFailed", "任务执行失败，内容审核不通过"),
    50802: ("TaskCancelled", "任务已被取消"),
    50803: ("ContentFiltered", "内容触发安全审核拦截"),
    50804: ("SafetyBlocked", "输出内容被安全策略拦截"),
    50805: ("NSFWDetected", "检测到违规内容，生成终止"),
    # 服务
    50900: ("InternalError", "火山引擎内部服务错误"),
    50901: ("ServiceUnavailable", "火山引擎服务暂不可用，请稍后重试"),
    50902: ("RegionNotSupported", "当前区域不支持此服务"),
}

JIMENG_RETRYABLE_CODES = {50800, 50900, 50901, 50902, 50602, 50600}
JIMENG_FATAL_CODES = {50503, 50504, 50505, 50506, 50601, 50603, 50803, 50804, 50805}


class JimengClient:
    BASE = "https://visual.volcengineapi.com"
    ACTION_IMAGE = "CVSync2AsyncSubmitTask"
    ACTION_QUERY = "CVSync2AsyncGetResult"
    VERSION = "2022-08-31"
    REGION = "cn-north-1"
    HOST = "visual.volcengineapi.com"

    def __init__(self, access_key: str, secret_key: str, concurrency: int = 5) -> None:
        self.ak = (access_key or "").strip()
        self.sk = (secret_key or "").strip()
        self._guard = threading.Semaphore(concurrency)
        self._session = make_retry_session()

    @staticmethod
    def _err_msg(code: int, default_msg: str = "") -> str:
        """根据火山引擎错误码生成可读错误消息"""
        detail = JIMENG_ERROR_CODES.get(code)
        if detail:
            return f"即梦 {detail[0]} (code={code}): {detail[1]}"
        return f"即梦 错误 code={code}: {default_msg}" if default_msg else f"即梦 未知错误 (code={code})"

    def _sign(self, req_body: dict) -> dict:
        now = datetime.now(timezone.utc)
        timestamp = now.strftime("%Y%m%dT%H%M%SZ")
        date = now.strftime("%Y%m%d")
        payload = json.dumps(req_body, separators=(",", ":"))
        hashed = hashlib.sha256(payload.encode()).hexdigest()
        cr = f"{hashed}\n{AUTHORIZATION}\n".encode()

        headers = {
            "Content-Type": "application/json",
            "Host": self.HOST,
            "X-Date": timestamp,
        }

        signed_h = "\n".join(f"{k}:{v}" for k, v in sorted(headers.items()))
        sl = "\n".join(["POST", "/", "", signed_h, "", ";".join(sorted(headers.keys()))])
        sr = hashlib.sha256(sl.encode()).hexdigest()

        ss = "\n".join(["HMAC-SHA256", timestamp, f"{date}/{self.REGION}/cv/request", sr])
        sig = ["", date, self.REGION, "cv", ""]
        signing_key = self.sk.encode()
        for s in sig:
            signing_key = hmac.new(signing_key, s.encode(), hashlib.sha256).digest()
        signature = hmac.new(signing_key, ss.encode(), hashlib.sha256).hexdigest()

        auth = (f"HMAC-SHA256 Credential={self.ak}/{date}/{self.REGION}/cv/request, "
                f"SignedHeaders={';'.join(sorted(headers.keys()))}, Signature={signature}")
        headers["Authorization"] = auth
        return headers

    def _post(self, body: dict, *, timeout: int = 120) -> dict:
        headers = self._sign(body)
        for attempt in range(4):
            try:
                r = self._session.post(self.BASE, headers=headers, json=body, timeout=(15, timeout))
            except requests.exceptions.Timeout:
                if attempt < 3:
                    time.sleep(15 * (attempt + 1))
                    continue
                raise Exception("即梦 请求超时：网络不稳定或服务响应慢")
            except requests.exceptions.ConnectionError as e:
                if attempt < 3:
                    time.sleep(10 * (attempt + 1))
                    continue
                raise Exception(f"即梦 连接失败：{str(e)}")

            try:
                data = r.json()
            except json.JSONDecodeError:
                if attempt < 2:
                    time.sleep(5)
                    continue
                raise Exception(f"即梦 非JSON响应: HTTP {r.status_code} — {r.text[:300]}")

            resp = data.get("ResponseMetadata", data.get("Response", data))
            err = resp.get("Error") or resp.get("ErrorDetails") or resp.get("RespMetadata") or resp

            if "Error" in err and err["Error"]:
                code_num = int(err["Error"].get("CodeN", 0))
                msg = err["Error"].get("Message", "")

                # 限流 / 内部错误 — 重试
                if code_num in JIMENG_RETRYABLE_CODES and attempt < 3:
                    wait = 15 * (attempt + 1)
                    print(f"即梦 retryable(code={code_num}): {wait}s wait ({attempt+1}/4)")
                    time.sleep(wait)
                    continue

                # 致命错误 — 不重试
                if code_num in JIMENG_FATAL_CODES:
                    raise Exception(self._err_msg(code_num, msg))

                raise Exception(self._err_msg(code_num, msg))

            if err.get("CodeN") and int(err.get("CodeN", 0)) != 0:
                code_num = int(err["CodeN"])
                if code_num in JIMENG_RETRYABLE_CODES and attempt < 3:
                    time.sleep(15 * (attempt + 1))
                    continue
                raise Exception(self._err_msg(code_num, err.get("Message", "")))

            if r.status_code >= 500 and attempt < 3:
                time.sleep(15 * (attempt + 1))
                continue

            if r.status_code != 200:
                raise Exception(f"即梦 HTTP {r.status_code}: {r.text[:300]}")

            return data

        raise Exception("即梦 提交失败：多次重试后仍失败")

    def submit_t2i(self, prompt: str, *, negative: str = "", model: str = "jimeng-2.1",
                   width: int = 1024, height: int = 1024, ratio: str = "1:1",
                   n: int = 1, style: str = "", seed: int = -1,
                   logo_info: bool = False, enhance_prompt: bool = False) -> str:
        body = {
            "Action": self.ACTION_IMAGE, "Version": self.VERSION,
            "json": {
                "req_key": "jimeng_t2i_v31",
                "prompt": prompt,
                "negative_prompt": negative or "",
                "use_sr": False,
                "return_url": True,
                "logo_info": {"add_logo": logo_info} if logo_info else None,
            },
        }
        self._clean(body["json"])

        d = self._post(body)
        resp = d.get("ResponseMetadata", d.get("Response", d))
        if resp.get("CodeN", 0) != 0:
            raise Exception(self._err_msg(int(resp.get("CodeN", 0)), resp.get("Message", "")))

        return resp.get("TaskId", resp.get("data", {}).get("TaskId", ""))

    def submit_i2i(self, image_path: str, prompt: str, *, negative: str = "",
                   strength: float = 0.7, model: str = "jimeng-2.1",
                   style: str = "", seed: int = -1) -> str:
        with open(image_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode()

        body = {
            "Action": self.ACTION_IMAGE, "Version": self.VERSION, "Region": self.REGION,
            "json": {
                "req_key": "img2img",
                "prompt": prompt,
                "negative_prompt": negative or "",
                "binary_data_base64": [image_b64],
                "strength": strength,
                "return_url": True,
            },
        }
        self._clean(body["json"])

        d = self._post(body)
        resp = d.get("ResponseMetadata", d.get("Response", d))
        if resp.get("CodeN", 0) != 0:
            raise Exception(self._err_msg(int(resp.get("CodeN", 0)), resp.get("Message", "")))

        return resp.get("TaskId", resp.get("data", {}).get("TaskId", ""))

    def query_image(self, task_id: str) -> tuple[str, Optional[list]]:
        body = {
            "Action": self.ACTION_QUERY, "Version": self.VERSION,
            "json": {"req_key": "jimeng_t2i_v31", "task_id": task_id, "return_url": True},
        }

        for attempt in range(3):
            d = self._post(body)
            resp = d.get("ResponseMetadata", d.get("Response", d))

            if resp.get("CodeN", 0) != 0:
                code_num = int(resp.get("CodeN", 0))
                if code_num in (50700,):
                    raise Exception(self._err_msg(code_num, resp.get("Message", "")))
                if code_num in JIMENG_RETRYABLE_CODES and attempt < 2:
                    time.sleep(10)
                    continue
                raise Exception(self._err_msg(code_num, resp.get("Message", "")))

            data = resp.get("data", resp)
            status = data.get("status", data.get("Status", ""))

            if status in ("done", "success"):
                urls = data.get("binary_data_base64") or data.get("image_urls") or []
                if urls and isinstance(urls[0], str) and urls[0].startswith("http"):
                    return "done", urls
                return "done", urls

            if status in ("failed", "error"):
                return "failed", None

            if status in ("queuing", "running", "pending", "processing"):
                return "running", None

            return status or "running", None

        return "running", None

    @staticmethod
    def _clean(d: dict) -> None:
        for k in list(d.keys()):
            if d[k] is None:
                del d[k]