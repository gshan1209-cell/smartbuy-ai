# TASK-T02 交接摘要：任務中心

## 已完成

- 任務統計、完成率、四種檢視、五條件篩選與詳情操作。
- 任務狀態安全更新與完成前文件檢查。
- 文件預覽／下載與相關檔案存在檢查。
- 規格書 28 筆 MVP 任務已登錄。
- 資料層及 Streamlit 頁面自動測試。

## 尚未完成

- 使用者登入與角色權限。
- 狀態變更歷程、留言與通知。
- 多程序同時寫入的資料庫鎖定。

## 已知問題

MVP 使用 JSON 儲存，適合單機或透過 Git 協作；多人同時按下儲存仍可能發生後寫覆蓋前寫。

## 下一位建議接手者

F 測試／文件可執行人工手機版驗收；若要支援多人即時操作，交由 C 資料工程改用 SQLite。

## 接手前必讀

- `AGENT.md`
- `data/tasks/tasks.json`
- `src/tasks/task_loader.py`
- `src/tasks/task_status.py`
- `app/pages/99_task_dashboard.py`

## 測試指令

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

