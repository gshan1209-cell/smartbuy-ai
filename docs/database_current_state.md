# 資料庫現況盤點說明書 (Database Current State)

更新日期：2026-07-13（整合 2026-07-12 初版盤點與 2026-07-13 D06 Supabase 實際驗證結果）

本文件盤點目前 SmartBuy AI 儲存庫中可確認的資料庫 Schema、程式實際使用的資料表，以及 Supabase 實際部署狀態。以下 Supabase 實際狀態以使用者在 Supabase SQL Editor 貼回的唯讀 SQL 結果為依據，不以儲存庫 SQL 檔案當成雲端已建立的證據。

## 1. 執行摘要

D06（下一交易日方向分類）在儲存庫定義與正式程式路徑上大致可執行：每日排程會在行情更新後執行 `scripts/generate_price_direction_predictions.py`，模型 payload 會寫入 `price_direction_predictions`，FastAPI 與 React 前端目前讀取方向分類 API，不讀取舊版 `prediction_results`。

已確認 `agri_price_daily` 實際存在 `uq_agri_price_daily` 唯一索引，涵蓋 `(trans_date, crop_code, market_code)`，因此目前程式的 `ON CONFLICT (trans_date, crop_code, market_code)` 有對應唯一索引。也已確認 `agri_price_daily` 無重複 key、無 NULL `crop_code` / `market_code`，`price_direction_predictions` 的主鍵、CHECK 約束、必要索引與 payload 品質統計均符合 D06 契約。RLS 已啟用且 `pg_policies` 無列，代表未開放 anon/authenticated 直連 policy，符合目前前端透過 FastAPI 存取的安全模式。部署環境的 `DATABASE_URL` 使用角色已由專案負責人確認具備後端 API 與 GitHub Actions 所需權限。

## 2. 盤點結論

| 資料表 | 儲存庫已定義 Schema | 程式已使用 | Supabase 實際部署狀態 | MVP 定位 |
|---|---|---|---|---|
| `agri_price_daily` | 由行情更新與 repository SQL 隱含使用 | 是，近期行情查詢與每日更新 | 已驗證存在，含唯一索引，無重複/NULL key | App 近期行情查詢資料表 |
| `price_direction_predictions` | `scripts/create_price_direction_predictions_table.sql` 與 `src/data/price_direction_prediction_store.py` | 是，每日方向分類寫入與前端 API 查詢 | 已驗證存在，欄位/約束/索引/資料品質均符合規格 | 正式 MVP 預測結果表 |
| `data_update_logs` | 部分批次腳本寫入 | 是，行情更新與舊 baseline 日誌 | 已確認存在（貼回結果四表皆存在） | 批次執行紀錄 |
| `prediction_results` | `scripts/create_prediction_results_table.sql` 與 deprecated store/repository | 僅 deprecated 舊版五日流程 | 未確認雲端表是否仍存在 | 非 MVP，舊版待停用 |

`dim_crop`、`dim_market`、`market_rest_days` 未出現在使用者貼回的查詢結果中，非 D06 硬性依賴，列為後續資料治理項目（詳見 [database_next_schema_plan.md](database_next_schema_plan.md)）。

## 3. 正式 MVP 預測表：`price_direction_predictions`

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

**Supabase 實際驗證結果**（2026-07-13 貼回）：

- 已確認 `PRIMARY KEY (upsert_key)`；重複 `upsert_key` 查詢 0 筆；格式錯誤 0 筆。
- 已確認 24 欄存在，型別與 NOT NULL 符合 SQL；`risk_note`、`market_name`、`crop_name` 可 NULL；`updated_at` 為 `timestamptz NOT NULL DEFAULT now()`。
- 已確認 staleness、label direction/name、prob down/flat/up、confidence、confidence_level、risk_level 的 CHECK 約束均存在。
- 已確認三個必要索引與 `price_direction_predictions_pkey` 均存在。
- 資料品質統計：目前 11,916 筆；`base_date` 範圍 2026-06-30 ~ 2026-07-10；`max_global_latest_trade_date` 為 2026-07-12；`bad_upsert_key_rows`、`bad_probability_sum_rows`、`bad_confidence_rows`、`stale_prediction_rows`、`invalid_prediction_target_rows` 均為 0。

## 4. 近期行情表：`agri_price_daily`

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

**Supabase 實際驗證結果**（2026-07-13 貼回）：

- 已確認存在 `uq_agri_price_daily` 唯一索引，涵蓋 `(trans_date, crop_code, market_code)`，對應程式 `ON CONFLICT` 子句；重複 key 查詢 0 筆。
- `crop_code`、`market_code` 欄位存在，型別 `text`，`is_nullable = YES`，但 NULL key 總數為 0（可列後續 hardening：評估改為 NOT NULL）。
- `updated_at` 為 `timestamptz`，default `now()`；資料量 917,840 筆，最新 `updated_at = 2026-07-12 07:43:38.581733+00`。

## 5. 模型 Payload 與資料庫契約

已確認儲存庫內 `src/ml/price_direction_predictor.py` 的 `BASE_PAYLOAD_COLUMNS` 與 `scripts/create_price_direction_predictions_table.sql` 的寫入欄位一致，差異只有資料表另含 `updated_at`，由資料庫預設值與 upsert 衝突更新維護。

已確認驗證邏輯包含：

- `upsert_key` 單次 payload 不可重複。
- 除 `risk_note` 外，必要欄位不可為空。
- `pred_label_direction` 限定 `-1, 0, 1`。
- `pred_label_name` 限定 `跌, 持平, 漲`。
- 三個分類機率介於 0 到 1，且加總接近 1。
- `pred_confidence` 等於三個機率最大值。
- `confidence_level` 限定 `低, 中, 高`。
- `risk_level` 限定 `normal, medium, high`。
- `data_staleness_days` 介於 0 到 7。
- `prediction_target` 由程式固定寫入 `next_trade_day`。
- 發布前會過濾 `data_staleness_days <= max_staleness_days`。
- pandas / NumPy scalar 會在 store 寫入前轉成 Python 原生值或 ISO 日期字串。

## 6. 索引評估

儲存庫已定義三個必要索引：

```sql
idx_price_direction_predictions_market_crop (market_id, crop_id)
idx_price_direction_predictions_base_date (base_date DESC)
idx_price_direction_predictions_direction (pred_label_direction)
```

目前 API 查詢條件為：

- `query_latest_prediction`: `data_staleness_days <= :staleness`，並依 `crop_id + market_id`、`crop_name + market_name`、單一 `crop_name` 或單一 `crop_id` 查詢，排序 `base_date DESC LIMIT 1`。
- `query_prediction_list`: `data_staleness_days <= :staleness`，可選 `market_id`、`pred_label_name`、`risk_level`，排序 `risk_level` 權重、`pred_confidence DESC`、`base_date DESC`。

因此可考慮的複合索引是 `(market_id, crop_id, data_staleness_days, base_date DESC)` 與 `(risk_level, pred_confidence DESC, base_date DESC)`，但只有在實際資料量與 `EXPLAIN` 顯示查詢瓶頸時才建議新增；目前不得只因「可能有幫助」新增索引。

## 7. RLS 與存取方式

目前程式屬於「僅透過 FastAPI 後端查詢」模式：

- React 前端使用 `VITE_API_URL` 呼叫後端 API。
- 搜尋結果頁呼叫 `/api/predictions/direction/latest`。
- 儲存庫未發現前端直接使用 `VITE_SUPABASE_URL` 或 `VITE_SUPABASE_ANON_KEY` 存取 `price_direction_predictions`。
- `frontend/.env.production` 只有 `VITE_API_URL=https://smartbuyai-react.onrender.com`，未包含 service role key。

使用者貼回 Supabase RLS 查詢結果如下：

| schema_name | table_name | rls_enabled | rls_forced |
| -- | -- | -- | -- |
| public | agri_price_daily | true | false |
| public | price_direction_predictions | true | false |

已確認兩張表均啟用 RLS，且未強制套用 force RLS。`pg_policies` 查詢結果為「Success. No rows returned」，代表目前沒有針對 `agri_price_daily` 或 `price_direction_predictions` 的公開 policy。以目前前端只透過 FastAPI 後端查詢的模式，這表示 anon/authenticated 直連不會取得讀寫權限，是安全面偏保守且可接受的狀態。

後端與 GitHub Actions 使用 `DATABASE_URL` 連線；此連線角色權限已由專案負責人確認 OK。若未來前端直連 Supabase，必須另案新增只讀 SELECT policy，且不得開放 anon INSERT、UPDATE、DELETE。

## 8. 舊版非 MVP 表：`prediction_results`

`prediction_results` 是舊版五日數值價格回歸 / Baseline 設計，欄位包含 `predicted_price` 與 `predicted_status`。它已退出正式 MVP 範圍：

- GitHub Actions `.github/workflows/daily_agri_price_update.yml` 不執行 `generate_baseline_predictions.py`。
- FastAPI 正式方向 API 使用 `query_latest_prediction` / `query_prediction_list`，不查 `prediction_results`。
- React 前端方向卡只呼叫 `/api/predictions/direction/latest`，查無資料時顯示尚無方向預測，不 fallback 舊版 CSV 或舊表。
- 保留的 `scripts/create_prediction_results_table.sql`、`src/data/prediction_store.py`、`src/data/prediction_repository.py`、`src/ml/baseline_predictor.py` 與相關測試均標示或歸類為 deprecated / 封存流程。

如果 Supabase 實體表仍存在，建議先人工確認沒有外部報表、舊前台或排程依賴，再另開 migration 討論停用或刪除；不得自動執行 `DROP TABLE`。

注意：`src/ml/baseline_predictor.py` 的模組 docstring 有一句「並寫入 `price_direction_predictions`」與檔案實際舊版 baseline 用途不一致，建議後續修正文案，避免誤解。

## 9. 本機與資料湖

- `data/history_parquet/`: 完整歷史行情資料湖，本機目錄可與 Cloudflare R2 同步。
- `data/processed/market_prices.csv`: 價格查詢離線 fallback。
- `data/processed/prediction_results.csv`: 舊版五日 baseline 測試/封存資料，不是正式 MVP fallback。

## 10. 阻擋問題

### P0：會使流程失敗或造成資料錯誤

目前未發現 P0 阻擋問題。已確認：

- `agri_price_daily` 有 `UNIQUE (trans_date, crop_code, market_code)`。
- `agri_price_daily` 無重複 key。
- `agri_price_daily` 無 NULL `crop_code` / `market_code`。
- `price_direction_predictions` 欄位、主鍵、CHECK 約束與必要索引符合規格。
- `price_direction_predictions` payload 品質檢查均為 0 筆異常。

### P1：不會立即失敗，但會影響安全、效能或維護

- RLS 已確認啟用且目前沒有公開 policy；這符合後端查詢模式。部署環境 `DATABASE_URL` 角色權限已確認 OK。
- `price_direction_prediction_store.py` 寫入函式會自動執行 `CREATE TABLE IF NOT EXISTS` 與 `CREATE INDEX IF NOT EXISTS`。這對初次部署方便，但正式環境建議改成 migration 管理，避免應用程式在執行期變更 schema。
- API 查詢可能需要複合索引，但需以實際資料量與查詢計畫判斷。

### P2：後續優化

- 修正 `src/ml/baseline_predictor.py` docstring 中容易誤導的 `price_direction_predictions` 描述。
- 後續建立 `dim_crop`、`dim_market`、`market_rest_days` 作資料治理，不作為阻擋項（見 [database_next_schema_plan.md](database_next_schema_plan.md)）。

## 11. 建議 Migration 草案與驗證 SQL

- `scripts/migrations/d06_schema_fix_draft.sql`：草案，包含重複資料與 NULL key 檢查，以及註解化的唯一索引、NOT NULL 與索引候選 SQL；未執行任何 migration。
- `scripts/verify_d06_schema.sql`：唯讀查詢，用於確認資料表存在性、欄位型別與 NOT NULL、主鍵/唯一約束/CHECK 約束、索引、RLS 與 policy、`agri_price_daily` 重複 key 與 NULL code、`price_direction_predictions` 筆數與資料品質。

## 12. 本次未執行事項

- 未執行任何 Supabase SQL。
- 未執行 migration。
- 未建立、刪除或修改雲端資料表。
- 未修改 RLS 或 policy。
- 未刪除舊版 `prediction_results` 或舊程式。
