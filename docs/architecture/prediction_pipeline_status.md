# 預測流程現況

更新日期：2026-07-12

## 正式每日流程：下一交易日價格方向預測

目前正式運行的是 GitHub Actions `Daily Agri Price Update`：

1. 抓取農業部最新交易行情並更新 Supabase `agri_price_daily`。
2. 與 Cloudflare R2 同步及驗證 Parquet 歷史資料湖。
3. 載入 `models/07_lightgbm_selected_final.joblib`，使用截至 `base_date = t` 的歷史資料，預測下一個實際交易日的價格方向（跌、持平、漲）。
4. 將預測結果 UPSERT 至 Supabase `price_direction_predictions`。

前台透過後端 API 讀取 `price_direction_predictions`，只展示資料新鮮度不超過七天的結果。

## Deprecated 流程：舊版五日數值價格 Baseline

`scripts/generate_baseline_predictions.py` 與 `prediction_results` 資料表仍保留在專案中，但目前 **不在每日 GitHub Actions workflow 內執行**，也不得由前台作為查無方向分類結果時的 fallback。

因此，五日數值價格預測不應視為正式、持續產生的功能；目前可對外說明的預測能力只有「下一交易日跌、持平、漲方向分類」。
