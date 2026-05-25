"""工作流执行引擎与任务队列。

每个 OutputNode（含 TextDisplayNode）一个独立 asyncio Task；
从输出节点反向 BFS 收集依赖子图，按拓扑序执行；
中间结果在内存缓存（同次 run）；
执行进度通过 WS 推送。

v3: 完整链式执行 — 拓扑排序、依赖检测、并行分支、逐节点状态追踪。
"""
from __future__ import annotations

import asyncio
import base64 as _b64
import time
import traceback
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional

import requests

from services import crypto, project_manager as pm
from services.thumbnail import compress_image_if_large, extract_video_thumbnail
from services.ws_manager import manager as ws_manager
from api_clients.kling import KlingClient
from api_clients.jimeng import JimengClient
from api_clients.gemini import GeminiClient
from api_clients.veo3 import Veo3Client
from api_clients.text_vision import TextVisionClient
from api_clients.seedance2 import Seedance2Client


VIDEO_EXT = {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}

# 节点类型常量
API_TYPES = {"kling", "jimeng", "gemini", "veo3", "seedance2", "image_edit", "storyboard", "text_vision"}
DATA_TYPES = {"image", "video", "audio"}
OUTPUT_TYPES = {"output", "text_display"}


def _is_video(path: str) -> bool:
    return Path(path).suffix.lower() in VIDEO_EXT


def _is_image(path: str) -> bool:
    return Path(path).suffix.lower() in IMAGE_EXT


class TaskQueue:
    def __init__(self) -> None:
        self.tasks: dict[str, dict[str, Any]] = {}
        self._async_tasks: dict[str, asyncio.Task] = {}
        # 同一 OutputNode 不重复提交：(project, output_node_id) → task_id
        self._running_outputs: dict[tuple[str, str], str] = {}
        # 批次管理：batch_id → list[task_id]
        self._batches: dict[str, list[str]] = {}

    def snapshot(self) -> list[dict]:
        return list(self.tasks.values())

    async def submit(self, project: str, workflow: dict, output_node_id: str) -> str:
        key = (project, output_node_id)
        existing = self._running_outputs.get(key)
        if existing and self.tasks.get(existing, {}).get("status") in ("queued", "running"):
            return existing

        node = next((n for n in workflow["nodes"] if n["id"] == output_node_id), None)
        if not node:
            raise ValueError(f"未找到输出节点 {output_node_id}")
        name = (node.get("data") or {}).get("name") or output_node_id
        kind = self._guess_kind(workflow, output_node_id)

        task_id = str(uuid.uuid4())
        task = {
            "id": task_id, "project": project, "output_node_id": output_node_id,
            "name": name, "kind": kind, "status": "queued",
            "progress": 0, "message": "已加入队列",
            "result_path": None, "thumbnail_path": None, "error": None,
            # 链式执行扩展字段
            "node_statuses": {},  # node_id → { status, progress }
            "subgraph_order": [],  # 拓扑序节点列表
        }
        self.tasks[task_id] = task
        self._running_outputs[key] = task_id
        await ws_manager.broadcast({"type": "task_update", "task": task})

        async_task = asyncio.create_task(self._run(task_id, project, workflow, output_node_id))
        self._async_tasks[task_id] = async_task
        return task_id

    def cancel(self, task_id: str) -> None:
        t = self.tasks.get(task_id)
        if not t:
            return
        async_task = self._async_tasks.get(task_id)
        if async_task and not async_task.done():
            async_task.cancel()
        if t["status"] in ("queued", "running"):
            t["status"] = "cancelled"
            t["message"] = "已取消"

    def cancel_all(self) -> None:
        for tid in list(self.tasks.keys()):
            self.cancel(tid)

    def clear_finished(self) -> None:
        for tid in [k for k, v in self.tasks.items() if v["status"] in ("done", "failed", "cancelled")]:
            self.tasks.pop(tid, None)
            self._async_tasks.pop(tid, None)
            for k, v in list(self._running_outputs.items()):
                if v == tid:
                    self._running_outputs.pop(k, None)

    @staticmethod
    def _normalized_generation_mode(data: dict[str, Any], *, default: str) -> str:
        raw = str((data or {}).get("mode") or (data or {}).get("generation_mode") or default)
        return {
            "image_to_video": "image2video",
            "first_last_frame": "first_last",
            "multimodal": "reference",
        }.get(raw, raw)

    @staticmethod
    def _file_to_data_url(path: str) -> str:
        if path.startswith("data:") or path.startswith("http://") or path.startswith("https://"):
            return path
        ext = Path(path).suffix.lower()
        mime = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".bmp": "image/bmp",
            ".gif": "image/gif",
            ".tiff": "image/tiff",
            ".mp4": "video/mp4",
            ".mov": "video/quicktime",
            ".avi": "video/x-msvideo",
            ".mkv": "video/x-matroska",
            ".webm": "video/webm",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".m4a": "audio/mp4",
            ".aac": "audio/aac",
            ".flac": "audio/flac",
            ".ogg": "audio/ogg",
        }.get(ext, "application/octet-stream")
        with open(path, "rb") as f:
            return f"data:{mime};base64,{_b64.b64encode(f.read()).decode()}"

    @classmethod
    def _seedance_media_payload(cls, data: dict[str, Any], inputs: dict[str, list[Any]]) -> dict[str, Optional[list[str]]]:
        pairs_map = inputs.get("_pairs", {})

        def _ordered(handle: str) -> list[str]:
            pairs = pairs_map.get(handle, [])
            order = list((data or {}).get(f"ref_order_{handle}") or [])
            if order:
                by_source = {source: value for source, value in pairs}
                raw_values = [by_source[source] for source in order if source in by_source]
                raw_values.extend(value for source, value in pairs if source not in order)
            else:
                raw_values = [value for _, value in pairs]
            return [cls._file_to_data_url(value) for value in raw_values if value]

        mode = cls._normalized_generation_mode(data, default="reference")
        image_urls: Optional[list[str]] = None
        video_urls: Optional[list[str]] = None
        audio_urls: Optional[list[str]] = None

        if mode == "reference":
            image_urls = _ordered("in_images") or None
            video_urls = _ordered("in_videos") or None
            audio_urls = _ordered("in_audios") or None
        elif mode == "image2video":
            image_path = (inputs.get("in_image") or [None])[0]
            if not image_path:
                raise Exception("Seedance 2.0 图生视频缺少图片输入")
            image_urls = [cls._file_to_data_url(image_path)]
        elif mode == "first_last":
            first = (inputs.get("in_first") or [None])[0]
            last = (inputs.get("in_last") or [None])[0]
            if not first or not last:
                raise Exception("Seedance 2.0 首尾帧模式需要首帧和尾帧图片")
            image_urls = [cls._file_to_data_url(first), cls._file_to_data_url(last)]
        else:
            raise Exception(f"未知 Seedance 2.0 模式: {mode}")

        return {
            "image_urls": image_urls,
            "video_urls": video_urls,
            "audio_urls": audio_urls,
        }

    @staticmethod
    def _guess_kind(workflow: dict, output_id: str) -> str:
        upstream = TaskQueue._upstream_subgraph(workflow, output_id)
        for nid in upstream:
            n = next((x for x in workflow["nodes"] if x["id"] == nid), None)
            if not n:
                continue
            t = n["type"]
            if t in {"kling", "jimeng", "veo3", "seedance2"}:
                return t
            if t == "gemini":
                return "gemini"
            if t == "text_vision":
                return "text_vision"
            if t == "image_edit":
                return "image_edit"
        return "unknown"

    # ========== 链式执行：拓扑排序 & 依赖分析 ==========

    @staticmethod
    def _upstream_subgraph(workflow: dict, sink_id: str) -> list[str]:
        """从 output/display 节点出发，反向 BFS 收集所有上游节点。"""
        edges = workflow["edges"]
        visited: list[str] = []
        stack = [sink_id]
        seen: set[str] = set()
        while stack:
            nid = stack.pop()
            if nid in seen:
                continue
            seen.add(nid)
            visited.append(nid)
            for e in edges:
                if e["target"] == nid:
                    stack.append(e["source"])
        return visited

    @staticmethod
    def _topo_order(workflow: dict, subgraph: set[str]) -> list[str]:
        """Kahn 拓扑排序，支持并行层级检测。返回顺序列表。"""
        edges = [e for e in workflow["edges"] if e["source"] in subgraph and e["target"] in subgraph]
        in_deg: dict[str, int] = {n: 0 for n in subgraph}
        for e in edges:
            in_deg[e["target"]] = in_deg.get(e["target"], 0) + 1
        queue = [n for n in subgraph if in_deg.get(n, 0) == 0]
        order: list[str] = []
        while queue:
            n = queue.pop(0)
            order.append(n)
            for e in edges:
                if e["source"] == n:
                    in_deg[e["target"]] -= 1
                    if in_deg[e["target"]] == 0:
                        queue.append(e["target"])
        return order

    @staticmethod
    def _get_parallel_groups(workflow: dict, order: list[str]) -> list[list[str]]:
        """将拓扑序分组为可并行执行的层级（同级节点互不依赖）。"""
        edges = workflow["edges"]
        # 构建邻接表
        adj: dict[str, list[str]] = defaultdict(list)
        for e in edges:
            if e["source"] in order and e["target"] in order:
                adj[e["source"]].append(e["target"])
        # BFS 分层
        in_deg = {n: 0 for n in order}
        for e in edges:
            if e["source"] in order and e["target"] in order:
                in_deg[e["target"]] += 1
        groups: list[list[str]] = []
        front = [n for n in order if in_deg.get(n, 0) == 0]
        while front:
            groups.append(list(front))
            next_front = []
            for n in front:
                for m in adj.get(n, []):
                    in_deg[m] -= 1
                    if in_deg[m] == 0:
                        next_front.append(m)
            front = next_front
        return groups

    @staticmethod
    def _inputs_of(workflow: dict, target_id: str, outputs: dict) -> dict[str, list[Any]]:
        """收集 target_id 节点每个 targetHandle 上游产生的结果。

        - 一般端口取 outputs[source]
        - 当 source 是 image 节点且 sourceHandle == 'mask'，取 outputs[source::mask]
        - 一并保留连线源信息以支持 Gemini 参考图排序
        """
        result: dict[str, list[tuple[str, Any]]] = {}
        for e in workflow["edges"]:
            if e["target"] != target_id:
                continue
            handle = e.get("targetHandle") or "in"
            sh = e.get("sourceHandle") or "out"
            key = e["source"]
            if sh == "mask":
                key = f"{e['source']}::mask"
            val = outputs.get(key)
            if val is None:
                continue
            result.setdefault(handle, []).append((e["source"], val))

        plain: dict[str, list[Any]] = {h: [v for _, v in lst] for h, lst in result.items()}
        plain["_pairs"] = result
        return plain

    # ========== 主执行循环（链式）==========

    async def _run(self, task_id: str, project: str, workflow: dict, output_id: str) -> None:
        task = self.tasks[task_id]
        task["status"] = "running"
        task["message"] = "开始执行"
        await ws_manager.broadcast({"type": "task_update", "task": task})

        try:
            project_path = pm.find_project(project)
            sub = set(self._upstream_subgraph(workflow, output_id))
            order = self._topo_order(workflow, sub)
            groups = self._get_parallel_groups(workflow, order)
            outputs: dict[str, Any] = {}
            task["subgraph_order"] = order
            total = max(1, len(order))
            node_index_map = {nid: idx for idx, nid in enumerate(order)}

            # 广播初始节点状态
            for nid in order:
                task["node_statuses"][nid] = {"status": "idle", "progress": 0}
            await ws_manager.broadcast({
                "type": "node_status",
                "task_id": task_id,
                "node_statuses": task["node_statuses"],
                "subgraph_order": order,
            })

            # 逐层执行（允许同级并行）
            for group in groups:
                if task["status"] == "cancelled":
                    return
                # 同层节点可并行（asyncio.gather），但共享 outputs 字典需注意写隔离
                # 这里保守串行执行同层（简单安全，且 API 节点通常有并发限制）
                for nid in sorted(group, key=lambda x: order.index(x)):
                    if task["status"] == "cancelled":
                        return
                    node = next(n for n in workflow["nodes"] if n["id"] == nid)
                    t = node["type"]
                    inputs = self._inputs_of(workflow, nid, outputs)

                    # 更新节点状态为 executing
                    task["node_statuses"][nid] = {"status": "executing", "progress": 0}
                    task["message"] = f"执行 {t}"
                    task["progress"] = int(node_index_map[nid] * 100 / total)
                    await ws_manager.broadcast({
                        "type": "node_status",
                        "task_id": task_id,
                        "node_id": nid,
                        "status": "executing",
                        "progress": 0,
                        "message": f"执行 {t}",
                    })
                    await ws_manager.broadcast({"type": "task_update", "task": task})

                    try:
                        if t == "image":
                            rel = (node.get("data") or {}).get("image_path")
                            outputs[nid] = str(project_path / rel) if rel else None
                            mask_rel = (node.get("data") or {}).get("mask_path")
                            if mask_rel:
                                outputs[f"{nid}::mask"] = str(project_path / mask_rel)
                        elif t == "video":
                            rel = (node.get("data") or {}).get("video_path")
                            outputs[nid] = str(project_path / rel) if rel else None
                        elif t == "audio":
                            rel = (node.get("data") or {}).get("audio_path")
                            outputs[nid] = str(project_path / rel) if rel else None
                        elif t == "kling":
                            outputs[nid] = await self._run_kling(project_path, node, inputs, task)
                        elif t == "jimeng":
                            outputs[nid] = await self._run_jimeng(project_path, node, inputs, task)
                        elif t == "gemini":
                            outputs[nid] = await self._run_gemini(project_path, node, inputs, task, workflow)
                        elif t == "veo3":
                            outputs[nid] = await self._run_veo3(project_path, node, inputs, task)
                        elif t == "seedance2":
                            outputs[nid] = await self._run_seedance2(project_path, node, inputs, task)
                        elif t == "image_edit":
                            outputs[nid] = await self._run_image_edit(project_path, node, inputs, task)
                        elif t == "text_vision":
                            outputs[nid] = await self._run_text_vision(node, inputs)
                        elif t == "storyboard":
                            outputs[nid] = await self._run_storyboard(project_path, node, inputs, task)
                        elif t == "text_display":
                            outputs[nid] = await self._finalize_text(project_path, node, inputs)
                        elif t == "output":
                            outputs[nid] = await self._finalize_output(project_path, node, inputs)

                        # 节点执行成功
                        task["node_statuses"][nid] = {"status": "success", "progress": 100}
                        await ws_manager.broadcast({
                            "type": "node_status",
                            "task_id": task_id,
                            "node_id": nid,
                            "status": "success",
                            "progress": 100,
                        })
                    except asyncio.CancelledError:
                        task["node_statuses"][nid] = {"status": "cancelled", "progress": 0}
                        await ws_manager.broadcast({
                            "type": "node_status",
                            "task_id": task_id,
                            "node_id": nid,
                            "status": "cancelled",
                        })
                        raise
                    except Exception as e_node:
                        task["node_statuses"][nid] = {"status": "error", "progress": 0, "error": str(e_node)}
                        await ws_manager.broadcast({
                            "type": "node_status",
                            "task_id": task_id,
                            "node_id": nid,
                            "status": "error",
                            "error": str(e_node),
                        })
                        raise

            # 整条链执行完成
            result_path = outputs.get(output_id)
            task["result_path"] = result_path
            if result_path and isinstance(result_path, str) and Path(result_path).exists():
                if Path(result_path).suffix.lower() == ".mp4":
                    thumb = Path(result_path).with_name(Path(result_path).stem + "_thumb.jpg")
                    if not thumb.exists():
                        extract_video_thumbnail(result_path, str(thumb))
                    task["thumbnail_path"] = str(thumb)
                elif _is_image(result_path):
                    task["thumbnail_path"] = result_path
            task["status"] = "done"
            task["progress"] = 100
            task["message"] = "完成"
            await ws_manager.broadcast({"type": "task_done", "task_id": task_id,
                                          "result_path": task["result_path"],
                                          "thumbnail_path": task["thumbnail_path"]})
            await ws_manager.broadcast({"type": "task_update", "task": task})
        except asyncio.CancelledError:
            task["status"] = "cancelled"
            task["message"] = "已取消"
            await ws_manager.broadcast({"type": "task_update", "task": task})
            raise
        except Exception as e:
            task["status"] = "failed"
            task["message"] = str(e)
            task["error"] = str(e)
            traceback.print_exc()
            await ws_manager.broadcast({"type": "task_failed", "task_id": task_id, "error": str(e)})
            await ws_manager.broadcast({"type": "task_update", "task": task})

    # ===== 节点执行器 =====
    async def _run_kling(self, project_path: Path, node, inputs, task) -> str:
        keys = crypto.get_keys("kling")
        client = KlingClient(keys.get("access_key", ""), keys.get("secret_key", ""))
        d = node["data"]
        prompt = d.get("prompt") or ""
        model = d.get("model", "kling-v1")
        duration = int(d.get("duration", 5))
        mode = "pro" if d.get("resolution", "1080p").lower() == "1080p" else "std"
        cfg_scale = float(d.get("cfg_scale", 0.5))
        is_first_last = self._normalized_generation_mode(d, default="image2video") == "first_last"

        first = (inputs.get("in_first") or inputs.get("in_image") or [None])[0]
        last = (inputs.get("in_last") or [None])[0] if is_first_last else None
        if not first:
            raise Exception("可灵节点缺少图片输入")
        first = compress_image_if_large(first)
        if last:
            last = compress_image_if_large(last)

        loop = asyncio.get_event_loop()
        task_id = await loop.run_in_executor(None, lambda: client.submit_image_to_video(
            first, prompt, model=model, duration=duration, mode=mode,
            cfg_scale=cfg_scale, tail_image=last))
        out_name = (node.get("data") or {}).get("name") or node["id"]
        return await self._poll_video(client.query_video, task_id, project_path, out_name, task)

    async def _run_jimeng(self, project_path: Path, node, inputs, task) -> str:
        keys = crypto.get_keys("jimeng")
        client = JimengClient(keys.get("access_key", ""), keys.get("secret_key", ""))
        d = node["data"]
        prompt = d.get("prompt") or ""
        model = d.get("model", "jimeng_v1")
        duration = int(d.get("duration", 5))
        seed = int(d.get("seed", -1))
        resolution = d.get("resolution", "720P")

        is_fl = self._normalized_generation_mode(d, default="image2video") == "first_last"
        first = (inputs.get("in_first") or inputs.get("in_image") or [None])[0]
        last = (inputs.get("in_last") or [None])[0] if is_fl else None
        if not first:
            raise Exception("即梦节点缺少图片输入")
        first = compress_image_if_large(first)
        if last:
            last = compress_image_if_large(last)

        loop = asyncio.get_event_loop()
        task_id = await loop.run_in_executor(None, lambda: client.submit_image_to_video(
            first, prompt, model=model, video_duration=duration, seed=seed,
            tail_image=last, resolution=resolution))
        out_name = (node.get("data") or {}).get("name") or node["id"]
        return await self._poll_video(client.query_task, task_id, project_path, out_name, task)

    async def _run_gemini(self, project_path: Path, node, inputs, task, workflow) -> str:
        keys = crypto.get_keys("gemini")
        client = GeminiClient(keys.get("api_key", ""), keys.get("base_url", ""))
        d = node["data"]
        pairs = inputs.get("_pairs", {}).get("in_refs", [])
        ref_order: list[str] = list(d.get("ref_order") or [])
        ordered: list[str] = []
        if ref_order:
            mp = {src: val for src, val in pairs}
            for sid in ref_order:
                if sid in mp:
                    ordered.append(mp[sid])
            for src, val in pairs:
                if src not in ref_order:
                    ordered.append(val)
        else:
            ordered = [v for _, v in pairs]
        refs = [compress_image_if_large(p) for p in ordered if p]
        save_path = str(project_path / "素材库" / f"gemini_{int(time.time())}.png")
        loop = asyncio.get_event_loop()

        def _gen():
            return client.generate_image(d.get("prompt") or "", image_paths=refs,
                                          model=d.get("model", "gemini-2.5-flash-preview-image-generation"),
                                          aspect_ratio=d.get("aspect_ratio", "1:1"),
                                          image_size=d.get("image_size", ""),
                                          save_path=save_path)
        return await loop.run_in_executor(None, _gen)

    async def _run_veo3(self, project_path: Path, node, inputs, task) -> str:
        keys = crypto.get_keys("veo3")
        client = Veo3Client(keys.get("api_key", ""))
        d = node["data"]
        is_fl = self._normalized_generation_mode(d, default="image2video") == "first_last"
        first = (inputs.get("in_first") or inputs.get("in_image") or [None])[0]
        last = (inputs.get("in_last") or [None])[0] if is_fl else None
        if not first:
            raise Exception("Veo3 节点缺少图片输入")
        first = compress_image_if_large(first)
        images = [first] + ([last] if last else [])

        loop = asyncio.get_event_loop()
        veo_task_id = await loop.run_in_executor(None, lambda: client.submit(
            d.get("prompt") or "", model=d.get("model", "veo_3_1"), images=images,
            enhance_prompt=bool(d.get("enhance_prompt", True)),
            enable_upsample=bool(d.get("enable_upsample", True)),
            aspect_ratio=d.get("aspect_ratio", "16:9")))

        out_name = (node.get("data") or {}).get("name") or node["id"]
        target = project_path / f"{out_name}.mp4"
        for _ in range(2400):
            if task["status"] == "cancelled":
                raise asyncio.CancelledError()
            await asyncio.sleep(5)
            res = await loop.run_in_executor(None, client.query, veo_task_id)
            status = res.get("status")
            if status == "completed" and res.get("video_url"):
                return await loop.run_in_executor(None, _download, res["video_url"], str(target))
            if status == "failed":
                raise Exception(f"Veo3 失败: {res.get('error')}")
            task["progress"] = min(95, task.get("progress", 0) + 1)
            task["message"] = "Veo3 生成中..."
            await ws_manager.broadcast({"type": "task_update", "task": task})
        raise Exception("Veo3 超时")

    async def _run_seedance2(self, project_path: Path, node, inputs, task) -> str:
        keys = crypto.get_keys("seedance2")
        client = Seedance2Client(keys.get("api_key", ""))
        d = node["data"]
        media_payload = self._seedance_media_payload(d, inputs)
        prompt = d.get("prompt") or ""
        duration = int(d.get("duration", 5))
        quality = d.get("quality", "720p")
        aspect_ratio = d.get("aspect_ratio", "16:9")
        gen_audio = bool(d.get("generate_audio", True))

        loop = asyncio.get_event_loop()
        seedance_task = await loop.run_in_executor(None, lambda: client.submit(
            prompt,
            image_urls=media_payload["image_urls"],
            video_urls=media_payload["video_urls"],
            audio_urls=media_payload["audio_urls"],
            duration=duration, quality=quality, aspect_ratio=aspect_ratio,
            generate_audio=gen_audio))

        out_name = (node.get("data") or {}).get("name") or node["id"]
        target = project_path / f"{out_name}.mp4"
        for _ in range(2400):
            if task["status"] == "cancelled":
                raise asyncio.CancelledError()
            await asyncio.sleep(5)
            status, url = await loop.run_in_executor(None, client.query, seedance_task)
            if status == "completed" and url:
                return await loop.run_in_executor(None, _download, url, str(target))
            if status == "failed":
                raise Exception("Seedance 2.0 失败")
            task["progress"] = min(95, task.get("progress", 0) + 1)
            task["message"] = "Seedance 生成中..."
            await ws_manager.broadcast({"type": "task_update", "task": task})
        raise Exception("Seedance 超时")

    async def _run_image_edit(self, project_path: Path, node, inputs, task) -> str:
        d = node["data"]
        edit_mode = d.get("edit_mode", "kling_expand")
        loop = asyncio.get_event_loop()
        out_name = (node.get("data") or {}).get("name") or node["id"]
        target = project_path / "素材库" / f"{out_name}_edited.png"
        if edit_mode == "kling_expand":
            keys = crypto.get_keys("kling")
            client = KlingClient(keys.get("access_key", ""), keys.get("secret_key", ""))
            img = (inputs.get("in_image") or [None])[0]
            if not img:
                raise Exception("可灵扩图缺少图片")
            tid = await loop.run_in_executor(None, lambda: client.submit_expand_image(
                img,
                up_expansion_ratio=float(d.get("up", 0)),
                down_expansion_ratio=float(d.get("down", 0)),
                left_expansion_ratio=float(d.get("left", 0)),
                right_expansion_ratio=float(d.get("right", 0)),
                prompt=d.get("prompt") or "",
            ))
            for _ in range(120):
                await asyncio.sleep(5)
                status, url = await loop.run_in_executor(None, client.query_expand, tid)
                if status == "succeed" and url:
                    return await loop.run_in_executor(None, _download, url, str(target))
                if status == "failed":
                    raise Exception("可灵扩图失败")
                task["progress"] = min(95, task.get("progress", 0) + 1)
                task["message"] = "可灵扩图中..."
                await ws_manager.broadcast({"type": "task_update", "task": task})
            raise Exception("可灵扩图超时")
        if edit_mode == "jimeng_super":
            keys = crypto.get_keys("jimeng")
            client = JimengClient(keys.get("access_key", ""), keys.get("secret_key", ""))
            img = (inputs.get("in_image") or [None])[0]
            if not img:
                raise Exception("即梦超清缺少图片")
            tid = await loop.run_in_executor(None, lambda: client.submit_super_resolution(
                img, resolution=d.get("resolution", "4k"), scale=int(d.get("scale", 50))))
            return await self._poll_video(client.query_task, tid, project_path, out_name, task)
        if edit_mode == "jimeng_inpaint":
            keys = crypto.get_keys("jimeng")
            client = JimengClient(keys.get("access_key", ""), keys.get("secret_key", ""))
            img = (inputs.get("in_image") or [None])[0]
            mask = (inputs.get("in_mask") or [None])[0]
            if not img or not mask:
                raise Exception("即梦局部重绘需要图片+蒙版")
            tid = await loop.run_in_executor(None, lambda: client.submit_inpaint(
                img, mask, d.get("prompt") or "", seed=int(d.get("seed", 101))))
            return await self._poll_video(client.query_task, tid, project_path, out_name, task)
        raise Exception(f"未知 edit_mode={edit_mode}")

    async def _run_text_vision(self, node, inputs) -> str:
        provider = "gpt_vision" if (node["data"].get("model") or "").startswith("gpt") else "gemini_vision"
        keys = crypto.get_keys(provider)
        client = TextVisionClient(keys.get("api_key", ""), keys.get("base_url", ""))
        d = node["data"]
        pairs = inputs.get("_pairs", {}).get("in_image", [])
        ref_order: list[str] = list(d.get("ref_order") or [])
        if ref_order:
            mp = {s: v for s, v in pairs}
            ordered = [mp[s] for s in ref_order if s in mp] + [v for s, v in pairs if s not in ref_order]
        else:
            ordered = [v for _, v in pairs]
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: client.generate_text(
            d.get("prompt") or "", image_paths=ordered,
            model=d.get("model", "gpt-5.4"),
            temperature=float(d.get("temperature", 0.7)),
            thinking_mode=d.get("thinking_mode", "none"),
            format_mode=d.get("format_mode", "无")))

    async def _run_storyboard(self, project_path: Path, node, inputs, task) -> str:
        """执行图片分镜节点：图片合成分镜 / 分镜拆解图片"""
        d = node["data"]
        mode = d.get("mode", "图片合成分镜")
        rows = max(1, min(9, int(d.get("rows", 2))))
        cols = max(1, min(9, int(d.get("cols", 2))))
        save_dir = project_path / "素材库"
        save_dir.mkdir(exist_ok=True)
        import time as _time
        timestamp = int(_time.time() * 1000)

        try:
            from PIL import Image
        except ImportError:
            raise Exception("Pillow 未安装，无法使用分镜功能")

        if mode == "图片合成分镜":
            pairs = inputs.get("_pairs", {}).get("in_refs", [])
            image_paths = [v for _, v in pairs]
            if not image_paths:
                # 回退：非 Gemini 连线方式
                image_paths = inputs.get("in_image") or []
            if not image_paths:
                raise Exception("分镜节点没有输入图片")
            max_images = rows * cols
            image_paths = image_paths[:max_images]

            canvas_w, canvas_h = 3840, 2160
            gap = max(24, min(96, int(min(canvas_w / max(cols, 1), canvas_h / max(rows, 1)) * 0.08)))
            border_width = max(4, min(12, gap // 4))
            cell_w = canvas_w // cols
            cell_h = canvas_h // rows
            inner_w = max(1, cell_w - gap * 2)
            inner_h = max(1, cell_h - gap * 2)
            image_w = max(1, inner_w - border_width * 2)
            image_h = max(1, inner_h - border_width * 2)
            canvas = Image.new("RGB", (canvas_w, canvas_h), (255, 255, 255))

            for index, img_path in enumerate(image_paths):
                try:
                    img = Image.open(img_path)
                    if img.mode not in ("RGB", "L"):
                        img = img.convert("RGB")
                    elif img.mode == "L":
                        img = img.convert("RGB")
                    thumb = img.copy()
                    thumb.thumbnail((image_w, image_h), Image.LANCZOS)
                    row = index // cols
                    col = index % cols
                    cell_x = col * cell_w
                    cell_y = row * cell_h
                    frame_x = cell_x + (cell_w - (thumb.width + border_width * 2)) // 2
                    frame_y = cell_y + (cell_h - (thumb.height + border_width * 2)) // 2
                    for bx in range(frame_x, frame_x + thumb.width + border_width * 2):
                        for by in range(frame_y, frame_y + thumb.height + border_width * 2):
                            canvas.putpixel((bx, by), (0, 0, 0))
                    canvas.paste(thumb, (frame_x + border_width, frame_y + border_width))
                except Exception as e:
                    raise Exception(f"处理图片失败: {Path(img_path).name} - {str(e)}")

            result_path = str(save_dir / f"storyboard_merge_{timestamp}.png")
            canvas.save(result_path, "PNG")
            return result_path

        # 分镜拆解模式
        img_path = (inputs.get("in_image") or [None])[0]
        if not img_path:
            raise Exception("分镜拆解缺少输入图片")
        source = Image.open(img_path)
        if source.mode not in ("RGB", "L"):
            source = source.convert("RGB")
        elif source.mode == "L":
            source = source.convert("RGB")
        width, height = source.size
        result_paths = []
        for row in range(rows):
            for col in range(cols):
                left = int(round(col * width / cols))
                top = int(round(row * height / rows))
                right = int(round((col + 1) * width / cols))
                bottom = int(round((row + 1) * height / rows))
                cropped = source.crop((left, top, right, bottom))
                part_index = row * cols + col + 1
                part_path = str(save_dir / f"storyboard_split_{timestamp}_{part_index}.png")
                cropped.save(part_path, "PNG")
                result_paths.append(part_path)
        return result_paths[0] if result_paths else ""

    async def _finalize_text(self, project_path: Path, node, inputs) -> Optional[str]:
        d = node["data"]
        name = d.get("name") or node["id"]
        upstream = (inputs.get("in_text") or [None])[0]
        if not isinstance(upstream, str):
            return None
        target = project_path / f"{name}.txt"
        target.write_text(upstream, encoding="utf-8")
        return str(target)

    async def _finalize_output(self, project_path: Path, node, inputs) -> Optional[str]:
        d = node["data"]
        name = d.get("name") or node["id"]
        upstream = (inputs.get("in") or [None])[0]
        if not upstream:
            return None
        if isinstance(upstream, str) and Path(upstream).exists():
            ext = Path(upstream).suffix.lower()
            target = project_path / f"{name}{ext}"
            if Path(upstream).resolve() != target.resolve():
                target.write_bytes(Path(upstream).read_bytes())
            if ext == ".mp4":
                thumb = target.with_name(target.stem + "_thumb.jpg")
                if not thumb.exists():
                    extract_video_thumbnail(str(target), str(thumb))
            return str(target)
        if isinstance(upstream, str):
            target = project_path / f"{name}.txt"
            target.write_text(upstream, encoding="utf-8")
            return str(target)
        return None

    async def _poll_video(self, query_fn, vendor_task_id: str, project_path: Path,
                           name: str, task) -> str:
        loop = asyncio.get_event_loop()
        for _ in range(2400):
            if task["status"] == "cancelled":
                raise asyncio.CancelledError()
            await asyncio.sleep(5)
            status, url = await loop.run_in_executor(None, query_fn, vendor_task_id)
            if status in ("succeed", "success", "done") and url:
                if url.startswith("base64:"):
                    target = project_path / f"{name}.mp4"
                    target.write_bytes(_b64.b64decode(url[7:]))
                    return str(target)
                ext = ".mp4"
                lower = url.lower().split("?")[0]
                for e in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
                    if lower.endswith(e):
                        ext = e
                        break
                target = project_path / f"{name}{ext}"
                return await loop.run_in_executor(None, _download, url, str(target))
            if status in ("failed", "expired", "not_found"):
                raise Exception(f"任务失败: {status}")
            task["progress"] = min(95, task.get("progress", 0) + 1)
            await ws_manager.broadcast({"type": "task_update", "task": task})
        raise Exception("等待结果超时")


def _download(url: str, target: str) -> str:
    Path(target).parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=(30, 600)) as r:
        r.raise_for_status()
        with open(target, "wb") as f:
            for chunk in r.iter_content(chunk_size=64 * 1024):
                if chunk:
                    f.write(chunk)
    return target


task_queue = TaskQueue()