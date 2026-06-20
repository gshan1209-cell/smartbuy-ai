# TASK-T09 小白教學：建立 Agent 任務提示與讀取規則

## 1. 這個功能是做什麼的？

確保不同 Agent 能用一致方式讀取、回報與交付任務。

## 2. 這次完成了什麼？

Agent 只能列出待認領候選任務，由人類指定並透過 approved-by 核准後才能開始

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

- `AGENT.md`
- `AGENTS.md`
- `README.md`
- `src/tasks/agent_workflow.py`
- `tests/test_agent_workflow.py`
- `docs/templates/dev_log_template.md`
- `docs/templates/tutorial_template.md`
- `docs/templates/handoff_template.md`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## 6. 預期與實際結果

24 passed；CLI list 成功列出 18 個候選任務

## 7. 下一步可以怎麼做？

由人類從待認領清單指定下一個 task_id
