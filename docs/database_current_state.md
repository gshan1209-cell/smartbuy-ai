# 資料庫現況盤點說明書 (Database Current State)

更新日期：2026-07-12

本文件盤點目前 SmartBuy AI 儲存庫中可確認的資料庫 Schema、程式實際使用的資料表，以及 Supabase 實際部署狀態的可驗證程度。本次未連線 Supabase，因此不把任何未驗證事項寫成「雲端已建立」。

## 1. 盤點結論

| 資料表 | 儲存庫已定義 Schema | 程式已使用 | Supabase 實際部署狀態 | MVP 定位 |
|---|---|---|---|---|
| `agri_price_daily` | 由行情更新與 repository SQL 隱含使用 | 是，近期行情查詢與每日更新 | 本次未連線驗證 | App 近期行情查詢資料表 |
| `price_direction_predictions` | `scripts/create_price_direction_predictions_table.sql` 與 `src/data/price_direction_prediction_store.py` | 是，每日方向分類寫入與前端 API 查詢 | 本次未連線驗證 | 正式 MVP 預測結果表 |
| `data_update_logs` | 部分批次腳本寫入 | 是，行情更新與舊 baseline 日誌 | 本次未連線驗證 | 批次執行紀錄 |
| `prediction_results` | `scripts/create_prediction_results_table.sql` 與 deprecated store/repository | 僅 deprecated 舊版五日流程 | 本次未連線驗證 | 非 MVP，舊版待停用 |

## 2. 正式 MVP 預測表：`price_direction_predictions`

用途：存放 LightGBM 下一交易日方向分類結果，供後端 API 與前端顯示。

主要欄位：

- `upsert_key` (`TEXT PRIMARY KEY`): `market_id__crop_id__base_date`。
- `market_id`, `market_name`, `crop_id`, `crop_name`: 市場與作物識別。
- `base_date` (`DATE`): 此市場與作物可取得的最新有效交易日。
- `global_latest_trade_date` (`DATE`): 全域最新交易日。
- `data_staleness_days` (`INTEGER`): `base_date` 距全域最新交易日的天數，Schema 限制 0 到 7。
- `prediction_target` (`TEXT`): 目前為 `next_trade_day`。
- `pred_label_direction` (`INTEGER`): -1、0、1。
- `pred_label_name` (`TEXT`): 跌、持平、漲。
- `prob_down`, `prob_flat`, `prob_up`: 三類機率。
- `pred_confidence`: 三類機率最大值。
- `confidence_level`: 低、中、高。
- `risk_level`: normal、medium、high。
- `risk_note`, `display_message`: 前端提示文字。
- `model_type`, `payload_version`, `created_by_stage`, `prepared_at`, `updated_at`: 模型與批次中繼資料。

已定義索引：

- `idx_price_direction_predictions_market_crop` on (`market_id`, `crop_id`)
- `idx_price_direction_predictions_base_date` on (`base_date DESC`)
- `idx_price_direction_predictions_direction` on (`pred_label_direction`)

程式路徑：

- 建表 SQL：`scripts/create_price_direction_predictions_table.sql`
- 寫入與查詢：`src/data/price_direction_prediction_store.py`
- 產生批次：`scripts/generate_price_direction_predictions.py`
- 前端 API：`backend/main.py` 的 `/api/predictions/direction/latest` 與 `/api/predictions/direction`

## 3. 近期行情表：`agri_price_daily`

用途：App 近期行情查詢、價格搜尋、採買建議、趨勢圖與每日更新。

程式實際使用欄位：

- `trans_date`
- `crop_code`, `crop_name`
- `market_code`, `market_name`
- `upper_price`, `middle_price`, `lower_price`, `avg_price`
- `volume`

資料邊界：

- 近期線上查詢可讀 Supabase `agri_price_daily`。
- 完整歷史行情與 ML 訓練/正式方向推論應優先讀 Parquet 資料湖，不得大量查詢 `agri_price_daily`。

## 5. 舊版非 MVP 表：`prediction_results`

`prediction_results` 是舊版五日數值價格回歸 / Baseline 設計，欄位包含 `predicted_price` 與 `predicted_status`。它已退出正式 MVP 範圍：

- 目前正式 workflow 未呼叫 `scripts/generate_baseline_predictions.py`。
- 目前 React 搜尋頁已查詢 `price_direction_predictions`，查無資料時不 fallback 至 `prediction_results` 或 CSV。
- 保留的 `scripts/create_prediction_results_table.sql`、`src/data/prediction_store.py`、`src/data/prediction_repository.py`、`src/ml/baseline_predictor.py` 與相關測試均標示或歸類為 deprecated / 封存流程。

如果 Supabase 實體表仍存在，建議先人工確認沒有外部報表、舊前台或排程依賴，再另開 migration 討論停用或刪除；本次不得自動執行 `DROP TABLE`。

## 6. 本機與資料湖

- `data/history_parquet/`: 完整歷史行情資料湖，本機目錄可與 Cloudflare R2 同步。
- `data/processed/market_prices.csv`: 價格查詢離線 fallback。
- `data/processed/prediction_results.csv`: 舊版五日 baseline 測試/封存資料，不是正式 MVP fallback。
