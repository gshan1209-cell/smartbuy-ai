"""
模組名稱: tests.test_task_loader
功能說明: 測試模組，確保系統各項功能正常運作。

【相關元件 (Related Components)】
- 依賴: src.tasks.task_loader.TaskDataError
- 依賴: src.tasks.task_loader.filter_tasks
- 依賴: src.tasks.task_loader.get_task
- 依賴: src.tasks.task_loader.load_tasks
- 依賴: src.tasks.task_loader.sort_tasks
- 依賴: src.tasks.task_loader.summarize_tasks
- 依賴: src.tasks.task_loader.validate_tasks
- 依賴: src.tasks.task_status.update_task_status
"""
import json

import pytest

from src.tasks.task_loader import (
    TaskDataError,
    filter_tasks,
    get_task,
    load_tasks,
    sort_tasks,
    summarize_tasks,
    validate_tasks,
)
from src.tasks.task_status import update_task_status


def test_project_tasks_are_valid():
    tasks = load_tasks()
    assert tasks
    assert filter_tasks(tasks, status="待認領")
    assert get_task("TASK-T02", tasks)["module"] == "tasks"


def test_filter_supports_query_and_priority():
    tasks = load_tasks()
    result = filter_tasks(tasks, priority="高", query="建立任務中心頁面")
    assert [task["task_id"] for task in result] == ["TASK-T02"]


def test_sort_and_summary():
    tasks = load_tasks()
    ordered = sort_tasks(reversed(tasks))
    assert ordered[0]["priority"] == "高"
    summary = summarize_tasks(tasks)
    assert summary["total"] == len(tasks)
    assert sum(summary["by_status"].values()) == len(tasks)


def test_update_task_status(tmp_path):
    source = load_tasks()[0]
    path = tmp_path / "tasks.json"
    path.write_text(json.dumps([source], ensure_ascii=False), encoding="utf-8")
    update_task_status(source["task_id"], "進行中", path)
    assert load_tasks(path)[0]["status"] == "進行中"


def test_update_task_status_needs_revision_requires_reason(tmp_path):
    source = load_tasks()[0]
    path = tmp_path / "tasks.json"
    path.write_text(json.dumps([source], ensure_ascii=False), encoding="utf-8")
    with pytest.raises(ValueError, match="必須提供提出者"):
        update_task_status(source["task_id"], "需要修改", path)


def test_update_task_status_needs_revision_saves_history(tmp_path):
    source = load_tasks()[0]
    path = tmp_path / "tasks.json"
    path.write_text(json.dumps([source], ensure_ascii=False), encoding="utf-8")
    result = update_task_status(source["task_id"], "需要修改", path, requester="PM", reason="Fix UI")
    assert result["status"] == "需要修改"
    assert "revision_requests" in result
    assert result["revision_requests"][0]["requester"] == "PM"
    assert result["revision_requests"][0]["reason"] == "Fix UI"


def test_invalid_status_is_rejected(tmp_path):
    with pytest.raises(ValueError):
        update_task_status("TASK-X", "亂碼", tmp_path / "tasks.json")


def test_duplicate_task_id_is_rejected():
    task = load_tasks()[0]
    with pytest.raises(TaskDataError, match="重複"):
        validate_tasks([task, task.copy()])


def test_document_path_cannot_escape_project():
    task = load_tasks()[0].copy()
    task["dev_log"] = "../outside.md"
    with pytest.raises(TaskDataError, match="相對路徑"):
        validate_tasks([task])


def test_validate_tasks_rejects_invalid_revision_requests():
    task = load_tasks()[0].copy()
    task["revision_requests"] = [{"requester": "", "reason": "Fix", "timestamp": "2024"}]
    with pytest.raises(TaskDataError, match="必須有非空 requester"):
        validate_tasks([task])
    
    task["revision_requests"] = [{"requester": "Me", "reason": "Fix"}]
    with pytest.raises(TaskDataError, match="必須有非空 timestamp"):
        validate_tasks([task])
