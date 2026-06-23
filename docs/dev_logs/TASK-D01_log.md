# TASK-D01 開發紀錄：建立 Parquet 歷史資料儲存層

## 1. 任務目標

建立本機 Parquet 歷史資料儲存層，降低 Supabase 容量負擔，並支援 ML 離線訓練與預測結果寫回。

## 2. 執行資訊

- 執行者：Antigravity
- 產生時間：2026-06-23T10:29:31+08:00
- 交付結果：success
- 下一狀態：已完成

## 3. 本次修改內容

已建立 Parquet 歷史儲存層，降低 Supabase 容量負擔，並支援 ML 訓練資料載入與預測寫回功能。

### 修改檔案

- `scripts/backfill_agri_price_history.py`
- `scripts/update_agri_price_daily.py`
- `src/data/data_loader.py`
- `src/data/parquet_store.py`
- `src/data/prediction_store.py`
- `tests/test_parquet_storage.py`
- `README.md`
- `docs/SPEC.md`

## 4. 完成標準

- [ ] 新增 data/history_parquet/ 目錄
- [ ] 歷史回補腳本支援將資料存入分月 Parquet 檔案
- [ ] 每日更新腳本支援同步更新 Parquet 並定期清理 Supabase 舊資料
- [ ] 提供 pandas 載入 Parquet 作為 ML 訓練資料來源的工具函式
- [ ] 設計預測結果寫入 Supabase prediction_results 表的介面與結構
- [ ] 更新 README 與 docs 說明雙層資料儲存架構

## 5. 測試方式

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_parquet_storage.py
```

## 6. 測試結果

單元測試 4 passed，專案全體測試 38 passed；手動回補與 daily update 腳本成功產生 parquet 檔案，且可用 pandas 正常讀回。

## 7. 下一步

無
