"""项目管理：在所有可用磁盘的 AIVIDEO 文件夹下扫描/创建/读取。"""
from __future__ import annotations

import json
import string
from pathlib import Path

from config import PROJECTS_INDEX_PATH, ROOT_FOLDER_NAME


def list_disks() -> list[str]:
    disks: list[str] = []
    for letter in string.ascii_uppercase:
        root = Path(f"{letter}:/")
        if root.exists():
            disks.append(letter)
    return disks


def project_root(disk: str, name: str) -> Path:
    return Path(f"{disk.upper()}:/") / ROOT_FOLDER_NAME / name


def _load_hidden_projects() -> set[str]:
    if not PROJECTS_INDEX_PATH.exists():
        return set()
    try:
        hidden = json.loads(PROJECTS_INDEX_PATH.read_text(encoding="utf-8"))
    except Exception:
        return set()
    if not isinstance(hidden, list):
        return set()
    return {str(name) for name in hidden}


def _save_hidden_projects(hidden: set[str]) -> None:
    PROJECTS_INDEX_PATH.write_text(
        json.dumps(sorted(hidden), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def list_projects() -> list[dict]:
    projects: list[dict] = []
    seen: set[str] = set()
    hidden = _load_hidden_projects()
    for letter in list_disks():
        base = Path(f"{letter}:/") / ROOT_FOLDER_NAME
        if not base.exists():
            continue
        for child in base.iterdir():
            if child.is_dir() and child.name not in seen and child.name not in hidden:
                projects.append({
                    "name": child.name,
                    "path": str(child),
                    "disk": letter,
                })
                seen.add(child.name)
    return projects


def create_project(disk: str, name: str) -> dict:
    root = project_root(disk, name)
    if root.exists():
        raise FileExistsError(f"项目已存在: {root}")
    (root / "素材库").mkdir(parents=True, exist_ok=True)
    (root / "workflows").mkdir(parents=True, exist_ok=True)
    workflow_path = root / "workflow.json"
    if not workflow_path.exists():
        workflow_path.write_text(json.dumps({
            "version": 2,
            "viewport": {"x": 0, "y": 0, "zoom": 1},
            "nodes": [],
            "edges": []
        }, ensure_ascii=False, indent=2), encoding="utf-8")
    hidden = _load_hidden_projects()
    if name in hidden:
        hidden.remove(name)
        _save_hidden_projects(hidden)
    return {"name": name, "path": str(root), "disk": disk}


def find_project(name: str) -> Path:
    for letter in list_disks():
        candidate = Path(f"{letter}:/") / ROOT_FOLDER_NAME / name
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"项目不存在: {name}")


def remove_from_index(name: str) -> None:
    hidden = _load_hidden_projects()
    hidden.add(name)
    _save_hidden_projects(hidden)


def load_workflow(name: str) -> dict:
    root = find_project(name)
    wf_path = root / "workflow.json"
    if not wf_path.exists():
        return {"version": 2, "viewport": {"x": 0, "y": 0, "zoom": 1}, "nodes": [], "edges": []}
    try:
        return json.loads(wf_path.read_text(encoding="utf-8"))
    except Exception:
        return {"version": 2, "viewport": {"x": 0, "y": 0, "zoom": 1}, "nodes": [], "edges": []}


def save_workflow(name: str, workflow: dict) -> None:
    root = find_project(name)
    wf_path = root / "workflow.json"
    wf_path.write_text(json.dumps(workflow, ensure_ascii=False, indent=2), encoding="utf-8")
