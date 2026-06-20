from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOCUMENT_FIELDS = (
    ("dev_log", "開發紀錄"),
    ("tutorial_doc", "小白教學"),
    ("handoff_note", "交接摘要"),
)


class TaskDocumentError(ValueError):
    """Raised when a task document cannot be safely previewed."""


def resolve_document_path(relative: str, project_root: Path | None = None) -> Path:
    root = (project_root or PROJECT_ROOT).resolve()
    target = (root / relative).resolve()
    if target != root and root not in target.parents:
        raise TaskDocumentError(f"文件路徑超出專案範圍：{relative}")
    return target


def inspect_task_documents(task: dict, project_root: Path | None = None) -> list[dict]:
    documents: list[dict] = []
    for field, label in DOCUMENT_FIELDS:
        relative = task[field]
        try:
            target = resolve_document_path(relative, project_root)
        except TaskDocumentError as exc:
            documents.append(
                {
                    "field": field,
                    "label": label,
                    "relative_path": relative,
                    "path": None,
                    "exists": False,
                    "empty": False,
                    "error": str(exc),
                }
            )
            continue
        exists = target.is_file()
        size = target.stat().st_size if exists else 0
        documents.append(
            {
                "field": field,
                "label": label,
                "relative_path": relative,
                "path": target,
                "exists": exists,
                "empty": exists and size == 0,
                "size": size,
                "error": None,
            }
        )
    return documents


def document_completion(task: dict, project_root: Path | None = None) -> tuple[int, int]:
    documents = inspect_task_documents(task, project_root)
    ready = sum(document["exists"] and not document["empty"] for document in documents)
    return ready, len(documents)


def document_state(task: dict, project_root: Path | None = None) -> str:
    ready, total = document_completion(task, project_root)
    if ready == total:
        return "完整"
    if ready == 0:
        return "尚無文件"
    return "部分完成"


def read_task_document(task: dict, field: str, project_root: Path | None = None) -> tuple[Path, str]:
    valid_fields = {name for name, _ in DOCUMENT_FIELDS}
    if field not in valid_fields:
        raise TaskDocumentError(f"不支援的任務文件欄位：{field}")
    target = resolve_document_path(task[field], project_root)
    if not target.is_file():
        raise FileNotFoundError(f"尚未建立文件：{task[field]}")
    content = target.read_text(encoding="utf-8")
    if not content.strip():
        raise TaskDocumentError(f"文件是空的：{task[field]}")
    return target, content

