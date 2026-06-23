# TASK-D05 小白教學：建立 prediction_results 預測結果表與展示流程

## 1. 這個功能是做什麼的？

建立價格預測讀取層 prediction_repository.py 與前台 02_price_search.py 展示，展示未來 5 天的預測行情與走勢。

## 2. 這次完成了什麼？

完成行情預測表與前台展示流程，支援 Supabase 優先與 CSV 備援，並套用 predict_date >= today 過濾與 ASC 排序

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

- `src/data/prediction_repository.py`
- `app/pages/02_price_search.py`
- `tests/test_prediction_repository.py`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest tests/ -q
```

## 6. 預期與實際結果

52 passed

## 7. 下一步可以怎麼做？

準備預測測試資料並手動驗證
