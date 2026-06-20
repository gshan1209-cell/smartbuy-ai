from __future__ import annotations

import streamlit as st

from app.common import configure_page
from app.components.task_card import render_task_card
from src.tasks.task_documents import (
    DOCUMENT_FIELDS,
    TaskDocumentError,
    document_completion,
    document_state,
    inspect_task_documents,
    read_task_document,
)
from src.tasks.task_loader import TaskDataError, load_tasks


configure_page("任務文件預覽")
st.title("📚 任務文件預覽")
st.write("集中搜尋、閱讀與下載每個任務的開發紀錄、小白教學及交接摘要。")
st.markdown("[🧩 返回任務中心](/task_dashboard)")

try:
    tasks = load_tasks()
except TaskDataError as exc:
    st.error(f"任務資料無法讀取：{exc}")
    st.stop()

states = {task["task_id"]: document_state(task) for task in tasks}
complete_count = sum(state == "完整" for state in states.values())
partial_count = sum(state == "部分完成" for state in states.values())
empty_count = sum(state == "尚無文件" for state in states.values())

metrics = st.columns(4)
metrics[0].metric("全部任務", len(tasks))
metrics[1].metric("文件完整", complete_count)
metrics[2].metric("部分完成", partial_count)
metrics[3].metric("尚無文件", empty_count)

search_column, state_column = st.columns([2, 1])
query = search_column.text_input("搜尋任務", placeholder="輸入任務 ID、名稱、負責人或模組")
selected_state = state_column.selectbox("文件狀態", ["全部", "完整", "部分完成", "尚無文件"])
keyword = query.strip().casefold()

filtered = [
    task
    for task in tasks
    if (selected_state == "全部" or states[task["task_id"]] == selected_state)
    and (
        not keyword
        or keyword
        in " ".join([task["task_id"], task["title"], task["owner"], task["module"]]).casefold()
    )
]
state_order = {"完整": 0, "部分完成": 1, "尚無文件": 2}
filtered.sort(key=lambda task: (state_order[states[task["task_id"]]], task["task_id"]))
st.caption(f"目前顯示 {len(filtered)}／{len(tasks)} 個任務")

if not filtered:
    st.info("目前沒有符合搜尋條件的任務。")
    st.stop()

labels = {
    task["task_id"]: (
        f"{task['task_id']}｜{task['title']}｜文件 {document_completion(task)[0]}/3"
    )
    for task in filtered
}
selected_id = st.selectbox(
    "選擇要預覽的任務",
    list(labels),
    format_func=lambda task_id: labels[task_id],
)
selected = next(task for task in filtered if task["task_id"] == selected_id)
render_task_card(selected)

documents = inspect_task_documents(selected)
ready, total = document_completion(selected)
st.progress(ready / total, text=f"任務文件完整度：{ready}/{total}")

tabs = st.tabs([label for _, label in DOCUMENT_FIELDS])
for tab, document in zip(tabs, documents):
    with tab:
        st.caption(document["relative_path"])
        if document["error"]:
            st.error(document["error"])
            continue
        if not document["exists"]:
            st.warning(f"尚未建立{document['label']}。")
            continue
        if document["empty"]:
            st.warning(f"{document['label']}目前是空檔案。")
            continue
        try:
            target, content = read_task_document(selected, document["field"])
        except (TaskDocumentError, FileNotFoundError, OSError, UnicodeError) as exc:
            st.error(f"無法預覽：{exc}")
            continue
        st.markdown(content)
        st.download_button(
            f"下載{document['label']}",
            data=content,
            file_name=target.name,
            mime="text/markdown",
            key=f"preview-download-{selected_id}-{document['field']}",
        )
