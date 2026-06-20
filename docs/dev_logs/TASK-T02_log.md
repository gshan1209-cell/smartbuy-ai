# TASK-T02 開發紀錄：建立任務中心頁面

## 1. 任務目標

讓人類與 AI Agent 能在同一頁掌握任務總量、狀態、負責人、完成標準、相關檔案與交接文件。

## 2. 開發前狀態

原頁面只有三個篩選條件、單一任務選單與唯讀詳情，不能看整體進度、搜尋、更新狀態或直接閱讀文件。

## 3. 本次修改內容

### 修改檔案

- `app/pages/99_task_dashboard.py`
- `app/components/task_card.py`
- `src/tasks/task_loader.py`
- `src/tasks/task_status.py`
- `data/tasks/tasks.json`
- `tests/test_task_loader.py`

### 新增能力

- 五項進度指標與完成率。
- 關鍵字、狀態、優先度、負責人、模組組合篩選。
- 狀態總覽、任務看板、表格清單、Agent 指引四個頁籤。
- 任務詳情、檔案存在檢查、Agent 讀取摘要。
- 有確認步驟的狀態更新；缺三份文件時禁止標記完成。
- Markdown 任務文件預覽與下載。
- JSON 錯誤時停止寫入並顯示可理解的錯誤。
- 補齊規格書中的 28 筆 MVP 任務。

## 4. 設計理由

任務中心應先回答「現在進度如何」，再讓使用者往下找到「我要處理哪一件」。狀態修改加入確認與文件門檻，可降低誤按完成及無文件交接的風險。

## 5. 測試方式

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_task_loader.py -q
.\.venv\Scripts\python.exe -m pytest -q
```

另使用 `streamlit.testing.v1.AppTest` 執行 `app/pages/99_task_dashboard.py` 並確認沒有頁面例外。

## 6. 測試結果

2026-06-20 測試結果：

- 完整測試：`18 passed`。
- 任務中心 AppTest：0 個例外、成功建立 7 個頁籤與 29 個操作按鈕。
- 執行中的 Streamlit：HTTP 200。

## 7. 下一步交接

多人同時在線修改任務時，可將 JSON 儲存升級為 SQLite，並增加操作歷程與登入權限。
