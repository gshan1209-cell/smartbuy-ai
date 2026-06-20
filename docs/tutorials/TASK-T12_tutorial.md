# TASK-T12 小白教學：建立任務修改要求與交接內容

## 1. 這個功能是做什麼的？

任務標記需要修改時保存具體要求，讓接手 Agent 清楚知道修改內容。

## 2. 這次完成了什麼？

修正任務詳情無法顯示修改要求的問題，並為 task_loader 加上內部結構驗證與相關單元測試。

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

- `app/pages/99_task_dashboard.py`
- `app/components/task_card.py`
- `src/tasks/task_loader.py`
- `src/tasks/task_status.py`
- `src/tasks/agent_workflow.py`
- `tests/test_task_loader.py`
- `tests/test_agent_workflow.py`

## 5. 怎麼測試？

```powershell
python -m pytest -q
```

## 6. 預期與實際結果

34 passed in 2.15s

## 7. 下一步可以怎麼做？

已修復 dashboard UI 問題與驗證功能，請進行人工驗收與測試
