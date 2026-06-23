# TASK-D01 小白教學：建立 Parquet 歷史資料儲存層

## 1. 這個功能是做什麼的？

建立本機 Parquet 歷史資料儲存層，降低 Supabase 容量負擔，並支援 ML 離線訓練與預測結果寫回。

## 2. 這次完成了什麼？

已建立 Parquet 歷史儲存層，降低 Supabase 容量負擔，並支援 ML 訓練資料載入與預測寫回功能。

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

- `scripts/backfill_agri_price_history.py`
- `scripts/update_agri_price_daily.py`
- `src/data/data_loader.py`
- `README.md`
- `docs/SPEC.md`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_parquet_storage.py
```

## 6. 預期與實際結果

單元測試 4 passed，專案全體測試 38 passed；手動回補與 daily update 腳本成功產生 parquet 檔案，且可用 pandas 正常讀回。

## 7. 下一步可以怎麼做？

無
