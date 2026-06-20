"""
模組名稱: src.tasks.task_status
功能說明: 任務狀態更新邏輯，處理狀態寫入與修改要求紀錄。

【相關元件 (Related Components)】
- 依賴: src.tasks.task_loader.TASKS_PATH
- 依賴: src.tasks.task_loader.VALID_STATUSES
- 依賴: src.tasks.task_loader.load_tasks
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from datetime import datetime
from tempfile import NamedTemporaryFile

from src.tasks.task_loader import TASKS_PATH, VALID_STATUSES, load_tasks


def update_task_status(
    task_id: str, status: str, path: Path | None = None, requester: str = "", reason: str = ""
) -> dict:
    """
    更新指定任務的狀態，並將結果存回 tasks.json。
    如果狀態改為「需要修改」，則必須提供提出者 (requester) 與原因 (reason) 以供歷史追蹤。
    """
    if status not in VALID_STATUSES:
        raise ValueError(f"不支援的任務狀態：{status}")
    if status == "需要修改":
        if not requester.strip() or not reason.strip():
            raise ValueError("狀態設為「需要修改」時，必須提供提出者 (requester) 與修改要求 (reason)")
    target = path or TASKS_PATH
    tasks = load_tasks(target)
    for task in tasks:
        if task["task_id"] == task_id:
            if task["status"] == status and status != "需要修改":
                return task
            task["status"] = status
            if status == "需要修改":
                timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
                task.setdefault("revision_requests", []).append(
                    {"requester": requester.strip(), "timestamp": timestamp, "reason": reason.strip()}
                )
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary_path: str | None = None
            try:
                with NamedTemporaryFile(
                    "w", encoding="utf-8", dir=target.parent, delete=False, suffix=".tmp"
                ) as handle:
                    temporary_path = handle.name
                    json.dump(tasks, handle, ensure_ascii=False, indent=2)
                    handle.write("\n")
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary_path, target)
            finally:
                if temporary_path and Path(temporary_path).exists():
                    Path(temporary_path).unlink()
            return task
    raise KeyError(f"找不到任務：{task_id}")

