# TASK-T11 小白教學：建立任務文件預覽頁面

## 1. 這個功能是做什麼的？

提供任務文件搜尋、完整度檢查、Markdown 預覽與下載頁面。

## 2. 這次完成了什麼？

新增任務文件獨立預覽頁，支援搜尋、完整度篩選、三類 Markdown 預覽、下載與安全路徑檢查

## 3. 功能流程

```text
讀取任務
  ↓
修改相關檔案
  ↓
執行測試
  ↓
產生文件並更新任務狀態
```

## 4. 相關檔案

- `app/pages/98_task_documents.py`
- `app/pages/99_task_dashboard.py`
- `src/tasks/task_documents.py`
- `tests/test_task_documents.py`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## 6. 預期與實際結果

28 passed；預覽頁與任務中心 AppTest 皆為 0 exceptions

## 7. 下一步可以怎麼做？

從任務中心開啟 /task_documents，進行實際瀏覽器閱讀驗收
