# TASK-T07 小白教學：建立教學文件模板

## 1. 這個功能是做什麼的？

建立適合程式初學者閱讀的功能教學模板。

## 2. 這次完成了什麼？

建立初學者友善的教學文件模板

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

- `docs/templates/tutorial_template.md`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## 6. 預期與實際結果

22 passed

## 7. 下一步可以怎麼做？

由後續 Agent 透過 workflow 自動套用
