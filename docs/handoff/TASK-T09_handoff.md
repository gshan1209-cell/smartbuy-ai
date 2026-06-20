# TASK-T09 交接摘要：建立 Agent 任務提示與讀取規則

## 執行資訊

- 執行者：Codex
- 產生時間：2026-06-20T16:30:53+08:00
- 任務狀態：已完成

## 已完成

Agent 只能列出待認領候選任務，由人類指定並透過 approved-by 核准後才能開始

## 修改檔案

- `src/tasks/agent_workflow.py`
- `tests/test_agent_workflow.py`
- `tests/test_task_loader.py`
- `AGENT.md`
- `README.md`
- `app/pages/99_task_dashboard.py`

## 完成標準

- [ ] 列出必讀文件
- [ ] 提供兩種任務讀取方式
- [ ] 定義讀取成功回報
- [ ] 定義完成與異常處理

## 測試指令

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## 測試結果

24 passed；CLI list 成功列出 18 個候選任務

## 尚未完成／下一步

由人類從待認領清單指定下一個 task_id

## 已知問題

若交付結果為 `failed`，請優先依測試結果修正；其他情況目前無自動登錄的已知問題。
