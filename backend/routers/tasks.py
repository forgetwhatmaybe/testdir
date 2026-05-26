"""任务接口：提交执行 / 列表 / 取消 / 批量提交。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.schemas import RunRequest
from services.task_queue import task_queue

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _iter_output_runs(req: RunRequest):
    seen: set[str] = set()
    for output_id in req.output_node_ids:
        if output_id in seen:
            continue
        seen.add(output_id)
        try:
            count = int(req.output_counts.get(output_id, 1))
        except (TypeError, ValueError):
            count = 1
        count = max(1, min(10, count))
        for batch_index in range(count):
            yield output_id, batch_index, count


@router.post("/run")
async def run(req: RunRequest) -> dict:
    if not req.output_node_ids:
        raise HTTPException(status_code=400, detail="output_node_ids 不能为空")
    submitted = []
    for output_id, batch_index, batch_total in _iter_output_runs(req):
        tid = await task_queue.submit(
            req.project,
            req.workflow.model_dump(),
            output_id,
            batch_index=batch_index,
            batch_total=batch_total,
        )
        submitted.append(tid)
    return {"ok": True, "data": {"task_ids": submitted}}


@router.post("/run-batch")
async def run_batch(req: RunRequest) -> dict:
    """批量提交多个输出节点为同一批次任务。返回批次 ID 与各子任务 ID。"""
    if not req.output_node_ids:
        raise HTTPException(status_code=400, detail="output_node_ids 不能为空")
    submitted = []
    for output_id, batch_index, batch_total in _iter_output_runs(req):
        tid = await task_queue.submit(
            req.project,
            req.workflow.model_dump(),
            output_id,
            batch_index=batch_index,
            batch_total=batch_total,
        )
        submitted.append(tid)
    # 将这批 task_id 打包成 batch
    batch_id = task_queue.create_batch(submitted)
    return {
        "ok": True,
        "data": {
            "batch_id": batch_id,
            "task_ids": submitted,
            "total": len(submitted),
        },
    }


@router.get("")
def list_tasks() -> dict:
    return {"ok": True, "data": task_queue.snapshot()}


@router.post("/{task_id}/cancel")
def cancel(task_id: str) -> dict:
    task_queue.cancel(task_id)
    return {"ok": True}


@router.post("/cancel-all")
def cancel_all() -> dict:
    task_queue.cancel_all()
    return {"ok": True}


@router.post("/clear-finished")
def clear_finished() -> dict:
    task_queue.clear_finished()
    return {"ok": True, "data": task_queue.snapshot()}
