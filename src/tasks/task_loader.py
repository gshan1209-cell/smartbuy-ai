"""
模組名稱: src.tasks.task_loader
功能說明: 任務載入器，負責解析、驗證與篩選 tasks.json 的資料。

【相關元件 (Related Components)】
- 無內部相依模組
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable


TASKS_PATH = Path(__file__).resolve().parents[2] / "data/tasks/tasks.json"
VALID_STATUSES = ("待認領", "進行中", "等待測試", "需要修改", "已完成", "已封存")
VALID_PRIORITIES = ("高", "中", "低")
PRIORITY_ORDER = {"高": 0, "中": 1, "低": 2}
STATUS_ORDER = {status: index for index, status in enumerate(VALID_STATUSES)}
REQUIRED_FIELDS = {
    "task_id",
    "title",
    "status",
    "owner",
    "worker_type",
    "priority",
    "module",
    "related_files",
    "goal",
    "done_definition",
    "dev_log",
    "tutorial_doc",
    "handoff_note",
}


class TaskDataError(ValueError):
    """Raised when tasks.json cannot safely drive the task dashboard."""


def _validate_path(task_id: str, field: str, value: object) -> None:
    if not isinstance(value, str) or not value.strip():
        raise TaskDataError(f"{task_id} 的 {field} 必須是非空字串")
    path = Path(value)
    if path.is_absolute() or ".." in path.parts:
        raise TaskDataError(f"{task_id} 的 {field} 必須是專案內相對路徑")


def validate_tasks(tasks: object) -> list[dict]:
    if not isinstance(tasks, list):
        raise TaskDataError("tasks.json 最外層必須是陣列")
    seen_ids: set[str] = set()
    for index, task in enumerate(tasks, start=1):
        if not isinstance(task, dict):
            raise TaskDataError(f"第 {index} 筆任務必須是物件")
        missing = REQUIRED_FIELDS - task.keys()
        if missing:
            raise TaskDataError(f"{task.get('task_id', '未知任務')} 缺少欄位：{sorted(missing)}")
        task_id = task["task_id"]
        if not isinstance(task_id, str) or not task_id.strip():
            raise TaskDataError(f"第 {index} 筆任務的 task_id 不可為空")
        if task_id in seen_ids:
            raise TaskDataError(f"task_id 重複：{task_id}")
        seen_ids.add(task_id)
        if task["status"] not in VALID_STATUSES:
            raise TaskDataError(f"{task_id} 的狀態無效：{task['status']}")
        if task["priority"] not in VALID_PRIORITIES:
            raise TaskDataError(f"{task_id} 的優先度無效：{task['priority']}")
        for field in ("title", "owner", "worker_type", "module", "goal"):
            if not isinstance(task[field], str) or not task[field].strip():
                raise TaskDataError(f"{task_id} 的 {field} 必須是非空字串")
        for field in ("related_files", "done_definition"):
            if not isinstance(task[field], list) or not task[field]:
                raise TaskDataError(f"{task_id} 的 {field} 必須是非空陣列")
            if not all(isinstance(item, str) and item.strip() for item in task[field]):
                raise TaskDataError(f"{task_id} 的 {field} 只能包含非空字串")
        for field in ("dev_log", "tutorial_doc", "handoff_note"):
            _validate_path(task_id, field, task[field])
            
        if "revision_requests" in task:
            if not isinstance(task["revision_requests"], list):
                raise TaskDataError(f"{task_id} 的 revision_requests 必須是陣列")
            for index, req in enumerate(task["revision_requests"], start=1):
                if not isinstance(req, dict):
                    raise TaskDataError(f"{task_id} 的第 {index} 筆修改要求必須是物件")
                if "requester" not in req or not isinstance(req.get("requester"), str) or not req["requester"].strip():
                    raise TaskDataError(f"{task_id} 的第 {index} 筆修改要求必須有非空 requester")
                if "reason" not in req or not isinstance(req.get("reason"), str) or not req["reason"].strip():
                    raise TaskDataError(f"{task_id} 的第 {index} 筆修改要求必須有非空 reason")
                if "timestamp" not in req or not isinstance(req.get("timestamp"), str) or not req["timestamp"].strip():
                    raise TaskDataError(f"{task_id} 的第 {index} 筆修改要求必須有非空 timestamp")
    return tasks


def load_tasks(path: Path | None = None) -> list[dict]:
    """
    從指定的路徑（預設為 tasks.json）載入並驗證任務資料。
    如果檔案不存在或 JSON 格式錯誤，會拋出 TaskDataError。
    """
    target = path or TASKS_PATH
    try:
        tasks = json.loads(target.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise TaskDataError(f"找不到任務資料：{target}") from exc
    except json.JSONDecodeError as exc:
        raise TaskDataError(f"tasks.json 格式錯誤（第 {exc.lineno} 行）：{exc.msg}") from exc
    return validate_tasks(tasks)


def filter_tasks(
    tasks: Iterable[dict],
    status: str | None = None,
    owner: str | None = None,
    module: str | None = None,
    priority: str | None = None,
    query: str | None = None,
) -> list[dict]:
    """
    根據狀態、負責人、模組、優先度與關鍵字 (query) 篩選任務列表。
    關鍵字會比對任務 ID、標題、目標等欄位。
    """
    keyword = (query or "").strip().casefold()
    return [
        task
        for task in tasks
        if (not status or task["status"] == status)
        and (not owner or task["owner"] == owner)
        and (not module or task["module"] == module)
        and (not priority or task["priority"] == priority)
        and (
            not keyword
            or keyword
            in " ".join(
                [task["task_id"], task["title"], task["goal"], task["owner"], task["module"]]
            ).casefold()
        )
    ]


def sort_tasks(tasks: Iterable[dict]) -> list[dict]:
    return sorted(
        tasks,
        key=lambda task: (
            PRIORITY_ORDER.get(task["priority"], 99),
            STATUS_ORDER.get(task["status"], 99),
            task["task_id"],
        ),
    )


def get_task(task_id: str, tasks: Iterable[dict] | None = None) -> dict:
    source = load_tasks() if tasks is None else tasks
    for task in source:
        if task["task_id"] == task_id:
            return task
    raise KeyError(f"找不到任務：{task_id}")


def summarize_tasks(tasks: Iterable[dict]) -> dict:
    items = list(tasks)
    by_status = {status: 0 for status in VALID_STATUSES}
    for task in items:
        by_status[task["status"]] += 1
    closed = by_status["已完成"] + by_status["已封存"]
    return {
        "total": len(items),
        "active": by_status["進行中"] + by_status["等待測試"] + by_status["需要修改"],
        "unclaimed": by_status["待認領"],
        "completed": by_status["已完成"],
        "completion_rate": round(closed / len(items) * 100) if items else 0,
        "by_status": by_status,
    }
