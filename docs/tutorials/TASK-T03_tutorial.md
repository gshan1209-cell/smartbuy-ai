# TASK-T03 小白教學：建立任務讀取函式

## 1. 這個功能是做什麼的？

安全解析、驗證、查找與排序任務資料。

## 2. 這次完成了什麼？

完成任務 JSON 解析、欄位驗證、重複 ID 防護、查找、排序與統計

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
- `tests/test_task_loader.py`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## 6. 預期與實際結果

22 passed；任務中心 AppTest 0 exceptions

## 7. 下一步可以怎麼做？

維持 tasks.json 欄位相容性
