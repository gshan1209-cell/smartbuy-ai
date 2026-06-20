"""
模組名稱: app.pages.99_task_dashboard
功能說明: 任務中心儀表板，提供 Agent 與人類協作的看板。

【相關元件 (Related Components)】
- 依賴: app.common.ROOT
- 依賴: app.common.configure_page
- 依賴: app.components.task_card.render_task_card
- 依賴: app.components.task_card.status_badge
- 依賴: src.tasks.task_loader.TaskDataError
- 依賴: src.tasks.task_loader.VALID_PRIORITIES
- 依賴: src.tasks.task_loader.VALID_STATUSES
- 依賴: src.tasks.task_loader.filter_tasks
- 依賴: src.tasks.task_loader.load_tasks
- 依賴: src.tasks.task_loader.sort_tasks
- 依賴: src.tasks.task_loader.summarize_tasks
- 依賴: src.tasks.task_status.update_task_status
"""
from __future__ import annotations

from pathlib import Path

import streamlit as st

from app.common import ROOT, configure_page
from app.components.task_card import render_task_card, status_badge
from src.tasks.task_loader import (
    VALID_PRIORITIES,
    VALID_STATUSES,
    TaskDataError,
    filter_tasks,
    load_tasks,
    sort_tasks,
    summarize_tasks,
)
from src.tasks.task_status import update_task_status


def project_file(relative: str) -> Path | None:
    """Resolve a task file without allowing paths outside this repository."""
    root = Path(ROOT).resolve()
    target = (root / relative).resolve()
    if target != root and root not in target.parents:
        return None
    return target


def missing_task_documents(task: dict) -> list[str]:
    fields = ("dev_log", "tutorial_doc", "handoff_note")
    return [task[field] for field in fields if not project_file(task[field]) or not project_file(task[field]).is_file()]


def render_document(label: str, relative: str) -> None:
    target = project_file(relative)
    if target is None:
        st.error(f"{label}路徑不安全：`{relative}`")
        return
    if not target.is_file():
        st.warning(f"尚未建立{label}：`{relative}`")
        return
    content = target.read_text(encoding="utf-8")
    st.caption(relative)
    st.markdown(content)
    st.download_button(
        f"下載{label}",
        data=content,
        file_name=target.name,
        mime="text/markdown",
        key=f"download-{label}-{relative}",
    )


configure_page("任務中心")
st.title("🧩 任務中心｜Human–Agent Dashboard")
st.write("用同一份任務資料協調人類與 AI Agent，查看範圍、進度、完成標準與交接文件。")
st.markdown("[📚 開啟任務文件預覽](/task_documents)")

try:
    tasks = load_tasks()
except TaskDataError as exc:
    st.error(f"任務資料無法讀取：{exc}")
    st.info("請先修正 `data/tasks/tasks.json`，任務中心不會在資料有誤時繼續操作。")
    st.stop()

summary = summarize_tasks(tasks)
metric_columns = st.columns(5)
metric_columns[0].metric("全部任務", summary["total"])
metric_columns[1].metric("待認領", summary["unclaimed"])
metric_columns[2].metric("執行／驗證中", summary["active"])
metric_columns[3].metric("已完成", summary["completed"])
metric_columns[4].metric("整體完成率", f"{summary['completion_rate']}%")
st.progress(summary["completion_rate"] / 100, text=f"已完成或封存 {summary['completion_rate']}%")

with st.expander("🔎 搜尋與篩選", expanded=True):
    query = st.text_input("搜尋", placeholder="輸入任務 ID、名稱、目標、負責人或模組")
    filter_columns = st.columns(4)
    selected_status = filter_columns[0].selectbox("狀態", ["全部", *VALID_STATUSES])
    selected_priority = filter_columns[1].selectbox("優先度", ["全部", *VALID_PRIORITIES])
    owners = sorted({task["owner"] for task in tasks})
    modules = sorted({task["module"] for task in tasks})
    selected_owner = filter_columns[2].selectbox("負責人", ["全部", *owners])
    selected_module = filter_columns[3].selectbox("模組", ["全部", *modules])

filtered = sort_tasks(
    filter_tasks(
        tasks,
        status=None if selected_status == "全部" else selected_status,
        owner=None if selected_owner == "全部" else selected_owner,
        module=None if selected_module == "全部" else selected_module,
        priority=None if selected_priority == "全部" else selected_priority,
        query=query,
    )
)
st.caption(f"目前顯示 {len(filtered)}／{len(tasks)} 個任務")

overview_tab, board_tab, list_tab, guide_tab = st.tabs(["📊 狀態總覽", "🗂️ 任務看板", "📋 清單", "🤖 Agent 指引"])

with overview_tab:
    status_columns = st.columns(3)
    for index, status in enumerate(VALID_STATUSES):
        with status_columns[index % 3]:
            st.markdown(status_badge(status), unsafe_allow_html=True)
            st.metric("任務數", summary["by_status"][status], label_visibility="collapsed")

with board_tab:
    if not filtered:
        st.info("目前沒有符合篩選條件的任務。")
    else:
        board_columns = st.columns(3)
        for index, status in enumerate(VALID_STATUSES):
            status_tasks = [task for task in filtered if task["status"] == status]
            with board_columns[index % 3]:
                st.subheader(f"{status}（{len(status_tasks)}）")
                if not status_tasks:
                    st.caption("目前沒有任務")
                for task in status_tasks:
                    render_task_card(task, compact=True)
                    if st.button("查看詳情", key=f"board-open-{task['task_id']}", width="stretch"):
                        st.session_state["task_dashboard_selected"] = task["task_id"]

with list_tab:
    table_rows = [
        {
            "任務 ID": task["task_id"],
            "任務名稱": task["title"],
            "狀態": task["status"],
            "優先度": task["priority"],
            "負責人": task["owner"],
            "模組": task["module"],
        }
        for task in filtered
    ]
    st.dataframe(table_rows, width="stretch", hide_index=True)

with guide_tab:
    st.markdown(
        """
        1. Agent 開工前先讀 `AGENT.md`、`README.md`、`docs/SPEC.md` 與 `tasks.json`。
        2. Agent 可執行 `agent_workflow list` 列出候選任務，但不得自行認領。
        3. 由人類指定任務後，使用 `start --approved-by` 記錄核准者並更新為進行中。
        4. 只修改任務範圍；完成後留下開發紀錄、教學文件與交接摘要。
        5. 未實際驗證不可宣稱測試通過，也不可把任務設成「已完成」。
        """
    )
    st.code(
        '.\\.venv\\Scripts\\python.exe -m src.tasks.agent_workflow list\n'
        '.\\.venv\\Scripts\\python.exe -m src.tasks.agent_workflow start TASK-ID --actor "Codex" --approved-by "人類負責人"',
        language="powershell",
    )

if filtered:
    st.divider()
    st.header("任務詳情與操作")
    labels = {task["task_id"]: f"{task['task_id']}｜{task['title']}" for task in filtered}
    selected_id = st.session_state.get("task_dashboard_selected")
    if selected_id not in labels:
        selected_id = filtered[0]["task_id"]
    task_ids = list(labels)
    selected_id = st.selectbox(
        "選擇任務",
        task_ids,
        index=task_ids.index(selected_id),
        format_func=lambda task_id: labels[task_id],
    )
    st.session_state["task_dashboard_selected"] = selected_id
    selected = next(task for task in filtered if task["task_id"] == selected_id)
    render_task_card(selected)

    detail_left, detail_right = st.columns([1.15, 0.85])
    with detail_left:
        st.subheader("完成標準")
        for index, item in enumerate(selected["done_definition"], start=1):
            checked = selected["status"] in {"已完成", "已封存"}
            st.checkbox(
                f"{index}. {item}",
                value=checked,
                disabled=True,
                key=f"done-{selected_id}-{index}",
            )

        st.subheader("相關檔案")
        for relative in selected["related_files"]:
            target = project_file(relative)
            exists = bool(target and target.exists())
            st.write(f"{'✅' if exists else '⬜'} `{relative}`")

        if selected.get("revision_requests"):
            st.subheader("修改要求歷史")
            for req in selected["revision_requests"]:
                st.info(f"**{req['timestamp']}｜{req['requester']}**\n\n{req['reason']}")

    with detail_right:
        st.subheader("更新任務狀態")
        status_index = list(VALID_STATUSES).index(selected["status"])
        with st.form(f"status-form-{selected_id}"):
            new_status = st.selectbox("新狀態", VALID_STATUSES, index=status_index)
            requester = st.text_input("提出者（僅標記為需要修改時必填）")
            reason = st.text_area("修改要求（僅標記為需要修改時必填）")
            confirmed = st.checkbox("我已確認任務內容與文件狀態")
            submitted = st.form_submit_button("儲存狀態", type="primary", use_container_width=True)
        if submitted:
            missing_docs = missing_task_documents(selected) if new_status == "已完成" else []
            if not confirmed:
                st.error("請先勾選確認。")
            elif new_status == "需要修改" and (not requester.strip() or not reason.strip()):
                st.error("狀態設為「需要修改」時，必須填寫提出者與修改要求。")
            elif missing_docs:
                st.error("標記完成前仍缺少：" + "、".join(missing_docs))
            else:
                try:
                    update_task_status(selected_id, new_status, requester=requester, reason=reason)
                except (TaskDataError, ValueError, KeyError, OSError) as exc:
                    st.error(f"狀態更新失敗：{exc}")
                else:
                    st.success(f"{selected_id} 已更新為「{new_status}」")
                    st.rerun()

        st.subheader("Agent 讀取摘要")
        receipt_lines = [
            "任務讀取成功",
            f"- 任務：{selected['task_id']}｜{selected['title']}",
            f"- 狀態：{selected['status']}",
            f"- 目標：{selected['goal']}",
            f"- 完成標準：共 {len(selected['done_definition'])} 項",
        ]
        if selected["status"] == "需要修改" and selected.get("revision_requests"):
            latest = selected["revision_requests"][-1]
            receipt_lines.append(f"- 最新修改要求 ({latest['requester']})：{latest['reason']}")
            
        st.code("\n".join(receipt_lines))

    st.subheader("任務文件")
    document_tabs = st.tabs(["開發紀錄", "小白教學", "交接摘要"])
    document_specs = [
        ("開發紀錄", "dev_log"),
        ("小白教學", "tutorial_doc"),
        ("交接摘要", "handoff_note"),
    ]
    for tab, (label, field) in zip(document_tabs, document_specs):
        with tab:
            render_document(label, selected[field])
