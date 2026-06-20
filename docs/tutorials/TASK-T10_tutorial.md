# TASK-T10 小白教學：任務中心測試

## 1. 這個功能是做什麼的？

驗證任務資料、篩選、狀態更新與頁面載入。

## 2. 這次完成了什麼？

完成任務資料、篩選、狀態更新與 Streamlit 任務中心頁面驗證

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

- `tests/test_task_loader.py`
- `app/pages/99_task_dashboard.py`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## 6. 預期與實際結果

22 passed；任務中心 AppTest 0 exceptions

## 7. 下一步可以怎麼做？

功能變更時持續執行完整 pytest 與 AppTest
