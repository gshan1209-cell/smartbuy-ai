# TASK-T08 小白教學：建立交接摘要模板

## 1. 這個功能是做什麼的？

讓下一位開發者快速理解已完成、未完成與已知問題。

## 2. 這次完成了什麼？

建立包含測試與下一步的交接摘要模板

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

- `docs/templates/handoff_template.md`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## 6. 預期與實際結果

22 passed

## 7. 下一步可以怎麼做？

由後續 Agent 透過 workflow 自動套用
