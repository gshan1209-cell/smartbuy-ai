# TASK-T06 小白教學：建立開發紀錄模板

## 1. 這個功能是做什麼的？

提供所有任務共用且可交接的開發紀錄模板。

## 2. 這次完成了什麼？

建立可供所有任務使用的開發紀錄模板

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

- `docs/templates/dev_log_template.md`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## 6. 預期與實際結果

22 passed

## 7. 下一步可以怎麼做？

由後續 Agent 透過 workflow 自動套用
