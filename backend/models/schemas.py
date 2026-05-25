"""Pydantic 数据契约，与前端共享同一份 JSON。"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class XY(BaseModel):
    x: float = 0.0
    y: float = 0.0


class Viewport(BaseModel):
    x: float = 0.0
    y: float = 0.0
    zoom: float = 1.0


class FlowNode(BaseModel):
    id: str
    type: str
    position: XY
    data: dict[str, Any] = Field(default_factory=dict)


class FlowEdge(BaseModel):
    id: str
    source: str
    sourceHandle: Optional[str] = None
    target: str
    targetHandle: Optional[str] = None


class Workflow(BaseModel):
    version: int = 2
    viewport: Viewport = Field(default_factory=Viewport)
    nodes: list[FlowNode] = Field(default_factory=list)
    edges: list[FlowEdge] = Field(default_factory=list)


class CreateProject(BaseModel):
    disk: str
    name: str


class ProjectInfo(BaseModel):
    name: str
    path: str
    disk: str


class RunRequest(BaseModel):
    project: str
    workflow: Workflow
    output_node_ids: list[str]


class TaskInfo(BaseModel):
    id: str
    project: str
    output_node_id: str
    name: str
    kind: str
    status: str
    progress: int = 0
    message: str = ""
    result_path: Optional[str] = None
    thumbnail_path: Optional[str] = None


class ApiKeyEntry(BaseModel):
    provider: str
    fields: dict[str, str] = Field(default_factory=dict)


class ApiKeysPayload(BaseModel):
    keys: list[ApiKeyEntry]


class TestConnectionRequest(BaseModel):
    provider: str


class FilesOpenRequest(BaseModel):
    path: str


class SaveMaskRequest(BaseModel):
    project: str
    image_name: str
    png_base64: str
