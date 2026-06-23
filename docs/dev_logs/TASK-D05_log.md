# TASK-D05 開發紀錄：建立 prediction_results 預測結果表與展示流程

## 1. 任務目標

建立價格預測讀取層 prediction_repository.py 與前台 02_price_search.py 展示，展示未來 5 天的預測行情與走勢。

## 2. 執行資訊

- 執行者：Antigravity
- 產生時間：2026-06-23T12:52:49+08:00
- 交付結果：success
- 下一狀態：已完成

## 3. 本次修改內容

完成行情預測表與前台展示流程，支援 Supabase 優先與 CSV 備援，並套用 predict_date >= today 過濾與 ASC 排序

### 修改檔案

- `src/data/prediction_repository.py`
- `app/pages/02_price_search.py`
- `tests/test_prediction_repository.py`

## 4. 完成標準

- [ ] 建立 src/data/prediction_repository.py 實作未來預測資料加載與備援 CSV 流程
- [ ] 修改 app/pages/02_price_search.py 來取得預測結果並使用 Metric 小字卡展示未來走勢
- [ ] 確保 load_predictions 在資料庫與 CSV 中都只加載 predict_date >= today 且遞增排序
- [ ] 搜尋頁面展示優先使用 crop_code + market_code 精準查詢，否則降級使用 crop_name + market_name
- [ ] 編寫 tests/test_prediction_repository.py 並通過全部單元測試
- [ ] 更新 README.md 與 docs/SPEC.md 說明預測存取與展示邏輯

## 5. 測試方式

```powershell
.\.venv\Scripts\python.exe -m pytest tests/ -q
```

## 6. 測試結果

52 passed

## 7. 下一步

準備預測測試資料並手動驗證
