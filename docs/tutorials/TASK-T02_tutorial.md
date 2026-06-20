# TASK-T02 小白教學：任務中心

## 1. 這個功能是做什麼的？

任務中心是一張會自己整理的工作白板。它把 `tasks.json` 的內容分成統計、看板、清單與詳情，讓組員不用直接閱讀 JSON。

## 2. 功能流程

```text
tasks.json
  ↓ 讀取與安全檢查
task_loader.py
  ↓ 搜尋、篩選、排序、統計
99_task_dashboard.py
  ↓
看板／清單／任務詳情／文件預覽
```

更新狀態時：

```text
選擇新狀態
  ↓ 勾選確認
若要完成，檢查三份任務文件
  ↓
先寫暫存檔，再安全取代 tasks.json
```

## 3. 主要檔案

- `data/tasks/tasks.json`：任務本體。
- `src/tasks/task_loader.py`：讀取、驗證、搜尋、排序與統計。
- `src/tasks/task_status.py`：安全更新狀態。
- `app/pages/99_task_dashboard.py`：任務中心畫面。
- `app/components/task_card.py`：任務卡與狀態顏色。

## 4. 怎麼使用？

1. 從 Streamlit 左側選單開啟 `Task Dashboard`。
2. 先看頂端數字了解整體進度。
3. 用搜尋與篩選縮小任務範圍。
4. 在看板或清單找到任務，再於下方查看詳情。
5. 確認工作與文件後才更新狀態。

## 5. 怎麼測試？

執行 `.\.venv\Scripts\python.exe -m pytest tests/test_task_loader.py -q`，再開啟 `http://localhost:8501` 實際操作任務中心。

## 6. 預期結果

錯誤 JSON 不會被畫面忽略；合法資料可以搜尋、篩選、預覽文件與安全更新狀態。缺開發紀錄、教學或交接摘要的任務不能直接標記完成。

