# TASK-T13 小白教學：為所有程式加上中文註解

## 1. 這個功能是做什麼的？

為專案中所有的 Python 原始碼（主要為 app 與 src 目錄下的檔案）加上清楚的中文註解。

## 2. 這次完成了什麼？

更新為人類與 Agent 閱讀的詳盡 Docstrings，並動態解析出相依元件清單。

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

- `app/pages`
- `app/components`
- `src/tasks`
- `src/weather`
- `src/recommendation`
- `src/data`
- `src/calendar`
- `src/anomaly`

## 5. 怎麼測試？

```powershell
python -m pytest -q
```

## 6. 預期與實際結果

34 passed in 0.72s

## 7. 下一步可以怎麼做？

註解更新完畢，請人工確認。
