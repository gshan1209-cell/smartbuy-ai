# TASK-T05 小白教學：建立任務詳情卡

## 1. 這個功能是做什麼的？

清楚呈現任務狀態、目標、負責人、完成標準與相關檔案。

## 2. 這次完成了什麼？

完成狀態標籤、任務摘要、完成標準與相關檔案存在檢查

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

- `app/components/task_card.py`
- `app/pages/99_task_dashboard.py`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## 6. 預期與實際結果

22 passed；任務中心 AppTest 0 exceptions

## 7. 下一步可以怎麼做？

進行不同手機尺寸的人工視覺抽查
