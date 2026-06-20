import json
from pathlib import Path

import pytest

from src.tasks.agent_workflow import finish_task, generate_task_documents, list_available_tasks, start_task
from src.tasks.task_loader import load_tasks


def _workspace(tmp_path: Path) -> tuple[Path, Path, dict]:
    root = tmp_path / "project"
    tasks_path = root / "data/tasks/tasks.json"
    templates = root / "docs/templates"
    templates.mkdir(parents=True)
    source = load_tasks()[0].copy()
    source["status"] = "待認領"
    source["dev_log"] = "docs/dev_logs/task.md"
    source["tutorial_doc"] = "docs/tutorials/task.md"
    source["handoff_note"] = "docs/handoff/task.md"
    tasks_path.parent.mkdir(parents=True)
    tasks_path.write_text(json.dumps([source], ensure_ascii=False), encoding="utf-8")
    for name in ("dev_log_template.md", "tutorial_template.md", "handoff_template.md"):
        (templates / name).write_text("# {{TASK_ID}} {{TITLE}}\n{{SUMMARY}}\n{{TEST_RESULT}}", encoding="utf-8")
    return root, tasks_path, source


def test_start_task_updates_status(tmp_path):
    _, tasks_path, source = _workspace(tmp_path)
    result = start_task(source["task_id"], "Codex", "產品負責人", tasks_path=tasks_path)
    assert result["status"] == "進行中"
    assert load_tasks(tasks_path)[0]["status"] == "進行中"


def test_agent_can_list_but_not_claim_without_human_approval(tmp_path):
    _, tasks_path, source = _workspace(tmp_path)
    assert [task["task_id"] for task in list_available_tasks(tasks_path=tasks_path)] == [source["task_id"]]
    with pytest.raises(ValueError, match="人類核准"):
        start_task(source["task_id"], "Codex", "", tasks_path=tasks_path)
    assert load_tasks(tasks_path)[0]["status"] == "待認領"


def test_only_unclaimed_task_can_start_without_explicit_reopen(tmp_path):
    _, tasks_path, source = _workspace(tmp_path)
    data = load_tasks(tasks_path)
    data[0]["status"] = "等待測試"
    tasks_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(ValueError, match="只有待認領"):
        start_task(source["task_id"], "Codex", "產品負責人", tasks_path=tasks_path)


def test_finish_generates_three_documents_and_updates_status(tmp_path):
    root, tasks_path, source = _workspace(tmp_path)
    result = finish_task(
        source["task_id"],
        "Codex",
        "完成自動化",
        "success",
        "pytest -q",
        "3 passed",
        ["src/example.py"],
        "無",
        tasks_path=tasks_path,
        project_root=root,
    )
    assert result["task"]["status"] == "已完成"
    assert len(result["documents"]["created"]) == 3
    for field in ("dev_log", "tutorial_doc", "handoff_note"):
        content = (root / source[field]).read_text(encoding="utf-8")
        assert source["task_id"] in content
        assert "3 passed" in content


def test_existing_document_is_not_overwritten_without_force(tmp_path):
    root, tasks_path, source = _workspace(tmp_path)
    existing = root / source["dev_log"]
    existing.parent.mkdir(parents=True)
    existing.write_text("manual notes", encoding="utf-8")
    result = generate_task_documents(
        source["task_id"], "Codex", "摘要", "pytest", "passed", tasks_path=tasks_path, project_root=root
    )
    assert source["dev_log"] in result["skipped"]
    assert existing.read_text(encoding="utf-8") == "manual notes"


def test_success_requires_real_test_result(tmp_path):
    root, tasks_path, source = _workspace(tmp_path)
    with pytest.raises(ValueError, match="測試結果"):
        finish_task(
            source["task_id"],
            "Codex",
            "摘要",
            "success",
            "",
            "未執行",
            tasks_path=tasks_path,
            project_root=root,
        )
