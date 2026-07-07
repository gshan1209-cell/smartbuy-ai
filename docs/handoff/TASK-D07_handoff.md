# TASK-D07 交接摘要：建立每日價格方向 ML 預測排程

## 執行資訊

- 執行者：Codex
- 產生時間：2026-07-07T13:21:58+08:00
- 任務狀態：等待測試

## 已完成

新增每日價格方向 LightGBM 預測流程，包含模型檔、特徵推論模組、Supabase upsert store、CLI 腳本、建表 SQL、GitHub Actions 接續步驟、requirements 與測試。

## 修改檔案

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
- `data/tasks/tasks.json`

## 完成標準

- [ ] 建立 price_direction_predictions 資料表 SQL
- [ ] 建立可載入 joblib 模型並產生方向預測的 ML 模組
- [ ] 建立 CLI 腳本支援 dry-run 與正式 upsert
- [ ] 每日 GitHub Actions 行情更新後會執行價格方向預測
- [ ] 預測 payload 欄位符合 Supabase table schema 並通過基本驗證
- [ ] 新增單元測試覆蓋特徵工程、payload 驗證與 dry-run 流程
- [ ] 更新 README 與 docs/SPEC 說明每日價格方向預測流程

## 測試指令

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_price_direction_predictor.py tests/test_generate_price_direction_predictions.py tests/test_update_agri_price_daily.py tests/test_r2_sync.py tests/test_generate_baseline_predictions.py tests/test_baseline_predictor.py -q; .\.venv\Scripts\python.exe scripts\generate_price_direction_predictions.py --dry-run; .\.venv\Scripts\python.exe -m py_compile scripts\generate_price_direction_predictions.py src\ml\price_direction_predictor.py src\data\price_direction_prediction_store.py
```

## 測試結果

相關測試 28 passed；真模型 dry-run 成功產生 2946 筆可寫入 payload；py_compile 通過。全專案 pytest 目前因既有 tests/test_home_view.py 匯入不存在的 app.home_view 於 collection 階段失敗，非本次 D07 變更造成。

## 尚未完成／下一步

請先在 Supabase SQL Editor 執行 scripts/create_price_direction_predictions_table.sql，確認 GitHub Secrets 的 DATABASE_URL 與 R2 變數後，手動觸發 daily_agri_price_update workflow 驗收正式 upsert。

## 已知問題

若交付結果為 `failed`，請優先依測試結果修正；其他情況目前無自動登錄的已知問題。
