"""
模組名稱: tests.test_task_documents
功能說明: 測試模組，確保系統各項功能正常運作。

【相關元件 (Related Components)】
- 依賴: src.tasks.task_documents.TaskDocumentError
- 依賴: src.tasks.task_documents.document_completion
- 依賴: src.tasks.task_documents.document_state
- 依賴: src.tasks.task_documents.inspect_task_documents
- 依賴: src.tasks.task_documents.read_task_document
"""
from pathlib import Path

import pytest

from src.tasks.task_documents import (
    TaskDocumentError,
    document_completion,
    document_state,
    inspect_task_documents,
    read_task_document,
)


def _task() -> dict:
    return {
        "dev_log": "docs/dev_logs/task.md",
        "tutorial_doc": "docs/tutorials/task.md",
        "handoff_note": "docs/handoff/task.md",
    }


def test_complete_documents_can_be_previewed(tmp_path: Path):
    task = _task()
    for relative in task.values():
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f"# {target.stem}", encoding="utf-8")
    assert document_completion(task, tmp_path) == (3, 3)
    assert document_state(task, tmp_path) == "完整"
    target, content = read_task_document(task, "tutorial_doc", tmp_path)
    assert target.name == "task.md"
    assert content.startswith("#")


def test_missing_documents_are_reported(tmp_path: Path):
    task = _task()
    documents = inspect_task_documents(task, tmp_path)
    assert not any(document["exists"] for document in documents)
    assert document_state(task, tmp_path) == "尚無文件"
    with pytest.raises(FileNotFoundError):
        read_task_document(task, "dev_log", tmp_path)


def test_empty_document_is_not_counted_as_ready(tmp_path: Path):
    task = _task()
    target = tmp_path / task["dev_log"]
    target.parent.mkdir(parents=True)
    target.write_text("", encoding="utf-8")
    assert document_completion(task, tmp_path) == (0, 3)
    with pytest.raises(TaskDocumentError, match="空的"):
        read_task_document(task, "dev_log", tmp_path)


def test_unsafe_path_is_rejected(tmp_path: Path):
    task = _task()
    task["dev_log"] = "../outside.md"
    documents = inspect_task_documents(task, tmp_path)
    assert documents[0]["error"]
    with pytest.raises(TaskDocumentError, match="超出"):
        read_task_document(task, "dev_log", tmp_path)

