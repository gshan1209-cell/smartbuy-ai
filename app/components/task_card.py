"""
模組名稱: app.components.task_card
功能說明: 任務卡片元件，用於任務中心顯示單一任務摘要。

【相關元件 (Related Components)】
- 無內部相依模組
"""
from __future__ import annotations

import html

import streamlit as st


STATUS_COLORS = {
    "待認領": ("#6b7280", "#f3f4f6"),
    "進行中": ("#1d4ed8", "#dbeafe"),
    "等待測試": ("#7c3aed", "#ede9fe"),
    "需要修改": ("#b45309", "#fef3c7"),
    "已完成": ("#047857", "#d1fae5"),
    "已封存": ("#475569", "#e2e8f0"),
}


def status_badge(status: str) -> str:
    foreground, background = STATUS_COLORS.get(status, ("#374151", "#f3f4f6"))
    return (
        f'<span style="display:inline-block;padding:.2rem .65rem;border-radius:999px;'
        f'font-weight:700;color:{foreground};background:{background}">{html.escape(status)}</span>'
    )


def render_task_card(task: dict, compact: bool = False) -> None:
    with st.container(border=True):
        st.markdown(
            f"**{html.escape(task['task_id'])}｜{html.escape(task['title'])}**　{status_badge(task['status'])}",
            unsafe_allow_html=True,
        )
        if task["status"] == "需要修改" and task.get("revision_requests"):
            latest = task["revision_requests"][-1]
            st.warning(f"**修改要求 ({html.escape(latest['requester'])})**：{html.escape(latest['reason'])}")
        if compact:
            st.caption(f"{task['priority']}優先｜{task['module']}｜{task['owner']}")
            return
        cols = st.columns(3)
        cols[0].metric("優先度", task["priority"])
        cols[1].metric("模組", task["module"])
        cols[2].metric("完成標準", f"{len(task['done_definition'])} 項")
        st.write(task["goal"])
        st.caption(f"負責人：{task['owner']}｜協作：{task['worker_type']}")
