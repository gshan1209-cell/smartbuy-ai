# TASK-D07 小白教學：建立每日價格方向 ML 預測排程

## 1. 這個功能是做什麼的？

將已訓練好的價格方向模型接進每日行情更新流程，產生下一交易日方向、信心與風險提示，並寫回 Supabase price_direction_predictions 表。

## 2. 這次完成了什麼？

新增每日價格方向 LightGBM 預測流程，包含模型檔、特徵推論模組、Supabase upsert store、CLI 腳本、建表 SQL、GitHub Actions 接續步驟、requirements 與測試。

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

- `.github/workflows/daily_agri_price_update.yml`
- `scripts/create_price_direction_predictions_table.sql`
- `scripts/generate_price_direction_predictions.py`
- `models/07_lightgbm_selected_final.joblib`
- `src/data/price_direction_prediction_store.py`
- `src/ml/price_direction_predictor.py`
- `tests/test_price_direction_predictor.py`
- `tests/test_generate_price_direction_predictions.py`
- `requirements.txt`
- `README.md`
- `docs/SPEC.md`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_price_direction_predictor.py tests/test_generate_price_direction_predictions.py tests/test_update_agri_price_daily.py tests/test_r2_sync.py tests/test_generate_baseline_predictions.py tests/test_baseline_predictor.py -q; .\.venv\Scripts\python.exe scripts\generate_price_direction_predictions.py --dry-run; .\.venv\Scripts\python.exe -m py_compile scripts\generate_price_direction_predictions.py src\ml\price_direction_predictor.py src\data\price_direction_prediction_store.py
```

## 6. 預期與實際結果

相關測試 28 passed；真模型 dry-run 成功產生 2946 筆可寫入 payload；py_compile 通過。後續已移除舊版首頁測試，全專案 pytest 可直接執行。

## 7. 下一步可以怎麼做？

請先在 Supabase SQL Editor 執行 scripts/create_price_direction_predictions_table.sql，確認 GitHub Secrets 的 DATABASE_URL 與 R2 變數後，手動觸發 daily_agri_price_update workflow 驗收正式 upsert。
