# TASK-T11 開發紀錄：建立任務文件預覽頁面

## 1. 任務目標

提供任務文件搜尋、完整度檢查、Markdown 預覽與下載頁面。

## 2. 執行資訊

- 執行者：Codex
- 產生時間：2026-06-20T16:35:02+08:00
- 交付結果：success
- 下一狀態：已完成

## 3. 本次修改內容

新增任務文件獨立預覽頁，支援搜尋、完整度篩選、三類 Markdown 預覽、下載與安全路徑檢查

### 修改檔案

- `app/pages/98_task_documents.py`
- `app/pages/99_task_dashboard.py`
- `src/tasks/task_documents.py`
- `tests/test_task_documents.py`

## 4. 完成標準

- [ ] 可選擇任務並預覽三類文件
- [ ] 可篩選文件完整度
- [ ] 缺少或不安全路徑有清楚提示
- [ ] 可從任務中心前往預覽頁

## 5. 測試方式

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## 6. 測試結果

28 passed；預覽頁與任務中心 AppTest 皆為 0 exceptions

## 7. 下一步

從任務中心開啟 /task_documents，進行實際瀏覽器閱讀驗收
