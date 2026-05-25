"""路由：项目 CRUD 与工作流。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.schemas import CreateProject, ProjectInfo, Workflow
from services import project_manager as pm

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
def list_projects() -> dict:
    return {"ok": True, "data": pm.list_projects(), "disks": pm.list_disks()}


@router.post("")
def create_project(payload: CreateProject) -> dict:
    try:
        info = pm.create_project(payload.disk, payload.name.strip())
        return {"ok": True, "data": info}
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.delete("/{name}")
def delete_project(name: str) -> dict:
    pm.remove_from_index(name)
    return {"ok": True}


@router.get("/{name}/workflow")
def get_workflow(name: str) -> dict:
    try:
        return {"ok": True, "data": pm.load_workflow(name)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{name}/workflow")
def put_workflow(name: str, workflow: Workflow) -> dict:
    try:
        pm.save_workflow(name, workflow.model_dump())
        return {"ok": True}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
