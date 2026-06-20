"""
模組名稱: src.tasks.agent_workflow
功能說明: Agent 工作流管理，包含任務認領、狀態流轉與交接文件產出。

【相關元件 (Related Components)】
- 依賴: src.tasks.task_loader.TASKS_PATH
- 依賴: src.tasks.task_loader.filter_tasks
- 依賴: src.tasks.task_loader.get_task
- 依賴: src.tasks.task_loader.load_tasks
- 依賴: src.tasks.task_loader.sort_tasks
- 依賴: src.tasks.task_status.update_task_status
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Iterable

from src.tasks.task_loader import TASKS_PATH, filter_tasks, get_task, load_tasks, sort_tasks
from src.tasks.task_status import update_task_status


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTCOME_STATUS = {
    "needs-test": "等待測試",
    "failed": "需要修改",
    "success": "已完成",
}
DOCUMENT_FIELDS = {
    "dev_log": "dev_log_template.md",
    "tutorial_doc": "tutorial_template.md",
    "handoff_note": "handoff_template.md",
}


def _project_path(root: Path, relative: str) -> Path:
    resolved_root = root.resolve()
    target = (resolved_root / relative).resolve()
    if target != resolved_root and resolved_root not in target.parents:
        raise ValueError(f"路徑超出專案範圍：{relative}")
    return target


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: str | None = None
    try:
        with NamedTemporaryFile(
            "w", encoding="utf-8", dir=path.parent, delete=False, suffix=".tmp"
        ) as handle:
            temporary_path = handle.name
            handle.write(content.rstrip() + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path and Path(temporary_path).exists():
            Path(temporary_path).unlink()


def _lines(items: Iterable[str], empty_text: str = "- 無") -> str:
    values = [str(item).strip() for item in items if str(item).strip()]
    return "\n".join(f"- `{item}`" for item in values) if values else empty_text


def _render(template: str, values: dict[str, str]) -> str:
    rendered = template
    for key, value in values.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", value)
    return rendered


def list_available_tasks(*, tasks_path: Path | None = None) -> list[dict]:
    """Return tasks an Agent may propose to a human, without claiming them."""
    target = tasks_path or TASKS_PATH
    return sort_tasks([t for t in load_tasks(target) if t["status"] in ("待認領", "需要修改")])


def task_receipt(task: dict, actor: str, role: str, approved_by: str) -> str:
    files = "、".join(task["related_files"])
    lines = [
        "任務讀取成功",
        f"- 任務：{task['task_id']}｜{task['title']}",
        f"- 狀態：{task['status']}",
        f"- 目標：{task['goal']}",
        f"- 相關檔案：{files}",
        f"- 完成標準：共 {len(task['done_definition'])} 項",
        f"- 執行者：{actor}",
        f"- 本次角色：{role}",
        f"- 人類核准：{approved_by}",
    ]
    if task["status"] == "需要修改" and task.get("revision_requests"):
        latest = task["revision_requests"][-1]
        lines.append(f"- 最新修改要求 ({latest['requester']})：{latest['reason']}")
    return "\n".join(lines)


def start_task(
    task_id: str,
    actor: str,
    approved_by: str,
    role: str = "開發",
    *,
    tasks_path: Path | None = None,
    allow_reopen: bool = False,
) -> dict:
    """
    讓 Agent 認領任務，並將任務狀態更新為「進行中」。
    認領任務必須提供人類核准者 (approved_by) 的名稱。
    """
    if not approved_by.strip():
        raise ValueError("認領任務前必須提供人類核准者 approved_by")
    target = tasks_path or TASKS_PATH
    task = get_task(task_id, load_tasks(target))
    if task["status"] not in ("待認領", "需要修改") and not allow_reopen:
        raise ValueError(
            f"{task_id} 目前是「{task['status']}」，只有待認領或需要修改的任務可開始；如為人類明確重開請使用 allow_reopen"
        )
    return update_task_status(task_id, "進行中", target)


def generate_task_documents(
    task_id: str,
    actor: str,
    summary: str,
    test_command: str,
    test_result: str,
    changed_files: Iterable[str] = (),
    next_step: str = "無",
    outcome: str = "needs-test",
    *,
    tasks_path: Path | None = None,
    project_root: Path | None = None,
    force: bool = False,
) -> dict:
    if outcome not in OUTCOME_STATUS:
        raise ValueError(f"不支援的交付結果：{outcome}")
    target_tasks = tasks_path or TASKS_PATH
    root = project_root or PROJECT_ROOT
    task = get_task(task_id, load_tasks(target_tasks))
    files = list(changed_files) or list(task["related_files"])
    timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
    values = {
        "TASK_ID": task["task_id"],
        "TITLE": task["title"],
        "GOAL": task["goal"],
        "ACTOR": actor,
        "TIMESTAMP": timestamp,
        "SUMMARY": summary.strip() or "未提供摘要",
        "CHANGED_FILES": _lines(files),
        "RELATED_FILES": _lines(task["related_files"]),
        "DONE_DEFINITION": "\n".join(f"- [ ] {item}" for item in task["done_definition"]),
        "TEST_COMMAND": test_command.strip() or "未執行",
        "TEST_RESULT": test_result.strip() or "未執行",
        "NEXT_STEP": next_step.strip() or "無",
        "OUTCOME": outcome,
        "NEXT_STATUS": OUTCOME_STATUS[outcome],
    }

    created: list[str] = []
    skipped: list[str] = []
    for field, template_name in DOCUMENT_FIELDS.items():
        output_relative = task[field]
        output_path = _project_path(root, output_relative)
        if output_path.exists() and not force:
            skipped.append(output_relative)
            continue
        template_path = _project_path(root, f"docs/templates/{template_name}")
        if not template_path.is_file():
            raise FileNotFoundError(f"找不到文件模板：{template_path}")
        content = _render(template_path.read_text(encoding="utf-8"), values)
        _atomic_write(output_path, content)
        created.append(output_relative)
    return {"task": task, "created": created, "skipped": skipped}


def finish_task(
    task_id: str,
    actor: str,
    summary: str,
    outcome: str,
    test_command: str,
    test_result: str,
    changed_files: Iterable[str] = (),
    next_step: str = "無",
    *,
    tasks_path: Path | None = None,
    project_root: Path | None = None,
    force_documents: bool = False,
) -> dict:
    if outcome == "success" and (not test_result.strip() or test_result.strip() == "未執行"):
        raise ValueError("標記 success 前必須提供實際測試結果")
    target = tasks_path or TASKS_PATH
    documents = generate_task_documents(
        task_id,
        actor,
        summary,
        test_command,
        test_result,
        changed_files,
        next_step,
        outcome,
        tasks_path=target,
        project_root=project_root,
        force=force_documents,
    )
    task = update_task_status(
        task_id, 
        OUTCOME_STATUS[outcome], 
        target,
        requester=actor if outcome == "failed" else "",
        reason=summary if outcome == "failed" else "",
    )
    return {"task": task, "documents": documents}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="SmartBuy AI Agent 任務自動化")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list", help="列出待認領候選任務；不會變更任何狀態")

    start = subparsers.add_parser("start", help="認領任務並更新為進行中")
    start.add_argument("task_id")
    start.add_argument("--actor", required=True)
    start.add_argument("--approved-by", required=True, help="指定此任務的人類核准者")
    start.add_argument("--role", default="開發")
    start.add_argument("--allow-reopen", action="store_true")

    finish = subparsers.add_parser("finish", help="產生三份文件並依結果更新狀態")
    finish.add_argument("task_id")
    finish.add_argument("--actor", required=True)
    finish.add_argument("--summary", required=True)
    finish.add_argument("--outcome", choices=OUTCOME_STATUS, required=True)
    finish.add_argument("--test-command", default="未執行")
    finish.add_argument("--test-result", default="未執行")
    finish.add_argument("--changed-file", action="append", default=[])
    finish.add_argument("--next-step", default="無")
    finish.add_argument("--force-documents", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "list":
        tasks = list_available_tasks()
        if not tasks:
            print("目前沒有待認領任務。")
            return 0
        print(f"可提請人類選擇的任務：{len(tasks)}")
        for task in tasks:
            print(f"- {task['task_id']}｜{task['priority']}｜{task['title']}｜{task['owner']}")
        print("Agent 不得自行認領；請等待人類指定 task_id。")
        return 0
    if args.command == "start":
        task = start_task(
            args.task_id,
            args.actor,
            args.approved_by,
            args.role,
            allow_reopen=args.allow_reopen,
        )
        print(task_receipt(task, args.actor, args.role, args.approved_by))
        return 0
    result = finish_task(
        args.task_id,
        args.actor,
        args.summary,
        args.outcome,
        args.test_command,
        args.test_result,
        args.changed_file,
        args.next_step,
        force_documents=args.force_documents,
    )
    print(
        json.dumps(
            {
                "task_id": result["task"]["task_id"],
                "status": result["task"]["status"],
                "created_documents": result["documents"]["created"],
                "skipped_documents": result["documents"]["skipped"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
