from __future__ import annotations

import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from src.tasks.task_loader import TASKS_PATH, VALID_STATUSES, load_tasks


def update_task_status(task_id: str, status: str, path: Path | None = None) -> dict:
    if status not in VALID_STATUSES:
        raise ValueError(f"不支援的任務狀態：{status}")
    target = path or TASKS_PATH
    tasks = load_tasks(target)
    for task in tasks:
        if task["task_id"] == task_id:
            if task["status"] == status:
                return task
            task["status"] = status
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
