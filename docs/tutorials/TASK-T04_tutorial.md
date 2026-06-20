# TASK-T04 小白教學：建立任務篩選功能

## 1. 這個功能是做什麼的？

依關鍵字、狀態、優先度、負責人與模組組合篩選。

## 2. 這次完成了什麼？

完成關鍵字、狀態、優先度、負責人與模組的組合篩選

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

- `src/tasks/task_loader.py`
- `app/pages/99_task_dashboard.py`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## 6. 預期與實際結果

22 passed；任務中心 AppTest 0 exceptions

## 7. 下一步可以怎麼做？

資料量增大後可加入分頁
