# D06 資料庫盤點與前置 Schema 驗證

更新日期：2026-07-13

## 1. 執行摘要

D06 在儲存庫定義與正式程式路徑上大致可執行：每日排程會在行情更新後執行 `scripts/generate_price_direction_predictions.py`，模型 payload 會寫入 `price_direction_predictions`，FastAPI 與 React 前端目前讀取方向分類 API，不讀取舊版 `prediction_results`。

本次 Codex 本機無法直接連線 Supabase，因為本機環境沒有 `DATABASE_URL`、Supabase anon key 或 service role key。後續由使用者在 Supabase SQL Editor 執行唯讀 SQL，已補回資料表存在性、`agri_price_daily` 欄位與索引、重複與 NULL 檢查、`price_direction_predictions` 欄位/約束/索引/資料品質、RLS 與 policy 查詢結果。以下 Supabase 實際狀態以使用者貼回的 SQL 結果為依據，不以儲存庫 SQL 檔案當成雲端已建立的證據。

已確認 `agri_price_daily` 實際存在 `uq_agri_price_daily` 唯一索引，涵蓋 `(trans_date, crop_code, market_code)`，因此目前程式的 `ON CONFLICT (trans_date, crop_code, market_code)` 有對應唯一索引。也已確認 `agri_price_daily` 無重複 key、無 NULL `crop_code` / `market_code`，`price_direction_predictions` 的主鍵、CHECK 約束、必要索引與 payload 品質統計均符合 D06 契約。RLS 已啟用且 `pg_policies` 無列，代表未開放 anon/authenticated 直連 policy，符合目前前端透過 FastAPI 存取的安全模式。部署環境的 `DATABASE_URL` 使用角色已由專案負責人確認具備後端 API 與 GitHub Actions 所需權限。

## 2. Schema 對照表

| 項目 | 儲存庫規格 | Supabase 實際狀態 | 判定 | 處理建議 |
| -- | ----- | ------------- | -- | ---- |
| 必要資料表 | D06 核心表為 `agri_price_daily`, `data_update_logs`, `price_direction_predictions`；舊表 `prediction_results` 可保留 | 已確認四張表皆存在；`dim_crop`, `dim_market`, `market_rest_days` 未出現在貼回結果中 | 符合 D06 硬性必要 | 維度表非阻擋，列後續治理。 |
| `agri_price_daily` upsert key | 程式使用 `ON CONFLICT (trans_date, crop_code, market_code)` | 已確認存在 `uq_agri_price_daily`：`CREATE UNIQUE INDEX ... (trans_date, crop_code, market_code)`；重複 key 查詢 0 筆 | 符合 | 無需 D06 migration。 |
| `agri_price_daily.crop_code` | upsert key 必要欄位，模型正規化會丟棄缺值 | 欄位存在，型別 `text`，`is_nullable = YES`；`crop_code IS NULL OR market_code IS NULL` 總數為 0 | 符合 D06 執行需求 | 可列後續 hardening：評估改為 NOT NULL。 |
| `agri_price_daily.market_code` | upsert key 必要欄位，模型正規化會丟棄缺值 | 欄位存在，型別 `text`，`is_nullable = YES`；NULL key 總數為 0 | 符合 D06 執行需求 | 可列後續 hardening：評估改為 NOT NULL。 |
| `agri_price_daily.updated_at` | upsert insert/update 均寫 `NOW()` | 欄位存在，`timestamptz`，default `now()`；資料量 917,840，最新 `updated_at = 2026-07-12 07:43:38.581733+00` | 符合 | 持續由每日更新流程維護。 |
| `price_direction_predictions.upsert_key` | `TEXT PRIMARY KEY`，格式 `market_id__crop_id__base_date` | 已確認 `PRIMARY KEY (upsert_key)`；重複 `upsert_key` 查詢 0 筆；格式錯誤 0 筆 | 符合 | 無需 D06 migration。 |
| `price_direction_predictions` 欄位 | SQL 與 `BASE_PAYLOAD_COLUMNS` 一致；DB 另有 `updated_at` | 已確認 24 欄存在，型別與 NOT NULL 符合 SQL；`risk_note`, `market_name`, `crop_name` 可 NULL；`updated_at` 為 `timestamptz NOT NULL DEFAULT now()` | 符合 | 無需 D06 migration。 |
| CHECK 約束 | staleness、label、機率、信心、風險皆有 CHECK | 已確認 staleness、label direction/name、prob down/flat/up、confidence、confidence_level、risk_level CHECK 均存在 | 符合 | 無需 D06 migration。 |
| 必要索引 | market/crop、base_date DESC、direction | 已確認三個必要索引與 `price_direction_predictions_pkey` 均存在 | 符合 | 暫不新增複合索引；需實際效能問題再評估。 |
| Upsert 更新欄位 | 機率、分類、信心、風險、訊息、模型資訊、`prepared_at`、`updated_at` 皆更新 | 未確認 | 儲存庫符合 | 不需改程式；需確認雲端唯一鍵存在。 |
| RLS / policy | 前端透過 FastAPI，不直接查 Supabase | 已貼回 RLS 結果：`agri_price_daily` 與 `price_direction_predictions` 均 `rls_enabled = true`、`rls_forced = false`；`pg_policies` 查無資料 | B 路徑成立，RLS 已啟用且無 anon/authenticated 直連 policy | 維持後端查詢模式；不要新增 anon 寫入 policy。 |
| 舊版 `prediction_results` | 標示 deprecated，不在正式 workflow/API/frontend | 未確認雲端表是否存在 | 儲存庫符合 | 保留封存，不刪表；確認無外部依賴後再另案處理。 |
| `dim_crop`, `dim_market`, `market_rest_days` | 規劃文件建議，非 D06 目前硬性依賴 | 未確認 | 非阻擋 | 列為後續資料治理項目。 |

## 3. 模型 Payload 與資料庫契約

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

使用者貼回的 Supabase 實際資料品質統計也符合：

- `price_direction_predictions` 目前 11,916 筆。
- `base_date` 範圍為 2026-06-30 到 2026-07-10。
- `max_global_latest_trade_date` 為 2026-07-12。
- `bad_upsert_key_rows = 0`。
- 重複 `upsert_key` 查詢 0 筆。
- `bad_probability_sum_rows = 0`。
- `bad_confidence_rows = 0`。
- `stale_prediction_rows = 0`。
- `invalid_prediction_target_rows = 0`。

## 4. 索引評估

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

## 5. RLS 與存取方式

目前程式屬於 B：僅透過 FastAPI 後端查詢。

- React 前端使用 `VITE_API_URL` 呼叫後端 API。
- 搜尋結果頁呼叫 `/api/predictions/direction/latest`。
- 儲存庫未發現前端直接使用 `VITE_SUPABASE_URL` 或 `VITE_SUPABASE_ANON_KEY` 存取 `price_direction_predictions`。
- `frontend/.env.production` 只有 `VITE_API_URL=https://smartbuyai-react.onrender.com`，未包含 service role key。

使用者貼回 Supabase RLS 查詢結果如下：

| schema_name | table_name | rls_enabled | rls_forced |
| -- | -- | -- | -- |
| public | agri_price_daily | true | false |
| public | price_direction_predictions | true | false |

因此已確認兩張 D06 相關表均啟用 RLS，且未強制套用 force RLS。使用者後續貼回 `pg_policies` 查詢結果為「Success. No rows returned」，代表目前沒有針對 `agri_price_daily` 或 `price_direction_predictions` 的公開 policy。以目前前端只透過 FastAPI 後端查詢的模式，這表示 anon/authenticated 直連不會取得讀寫權限，是安全面偏保守且可接受的狀態。

後端與 GitHub Actions 使用 `DATABASE_URL` 連線；此連線角色權限已由專案負責人確認 OK。這不是前端 anon policy 問題，而是部署環境的資料庫連線角色設定。

## 6. 舊版流程退出狀態

已搜尋儲存庫中的 `prediction_results`、`generate_baseline_predictions.py`、`prediction_repository.py`、`prediction_store.py`、`baseline_predictor.py`、`predicted_price`、`predicted_status`。

確認結果：

- GitHub Actions `.github/workflows/daily_agri_price_update.yml` 不執行 `generate_baseline_predictions.py`。
- FastAPI 正式方向 API 使用 `query_latest_prediction` / `query_prediction_list`，不查 `prediction_results`。
- React 前端方向卡只呼叫 `/api/predictions/direction/latest`，查無資料時顯示尚無方向預測，不 fallback 舊版 CSV 或舊表。
- 舊版檔案多處已標示 deprecated 或封存用途。

注意：`src/ml/baseline_predictor.py` 的模組 docstring 有一句「並寫入 `price_direction_predictions`」與檔案實際舊版 baseline 用途不一致，建議後續修正文案，避免誤解。

## 7. 維度表定位

| 分類 | 資料表 | 判定 |
| -- | -- | -- |
| D06 硬性必要 | `agri_price_daily`, `data_update_logs`, `price_direction_predictions` | 目前正式流程所需。 |
| D06 建議但非必要 | `dim_crop`, `dim_market`, `market_rest_days` | 可改善代碼治理與交易日判讀，但目前程式未硬依賴。 |
| 後續資料治理項目 | 作物別名、市場主檔、休市資料、氣象/產地映射 | 建議另案設計，不在本任務建立。 |

## 8. 阻擋問題

### P0：會使流程失敗或造成資料錯誤

目前未發現 D06 P0 阻擋問題。

已確認：

- `agri_price_daily` 有 `UNIQUE (trans_date, crop_code, market_code)`。
- `agri_price_daily` 無重複 key。
- `agri_price_daily` 無 NULL `crop_code` / `market_code`。
- `price_direction_predictions` 欄位、主鍵、CHECK 約束與必要索引符合 D06 規格。
- `price_direction_predictions` payload 品質檢查均為 0 筆異常。

### P1：不會立即失敗，但會影響安全、效能或維護

- RLS 已確認啟用且目前沒有公開 policy；這符合後端查詢模式。部署環境 `DATABASE_URL` 角色權限已確認 OK。若未來前端直連 Supabase，必須另案新增只讀 SELECT policy，且不得開放 anon INSERT、UPDATE、DELETE。
- `price_direction_prediction_store.py` 寫入函式會自動執行 `CREATE TABLE IF NOT EXISTS` 與 `CREATE INDEX IF NOT EXISTS`。這對初次部署方便，但正式環境建議改成 migration 管理，避免應用程式在執行期變更 schema。
- API 查詢可能需要複合索引，但需以實際資料量與查詢計畫判斷。

### P2：後續優化

- 修正 `src/ml/baseline_predictor.py` docstring 中容易誤導的 `price_direction_predictions` 描述。
- 後續建立 `dim_crop`、`dim_market`、`market_rest_days` 作資料治理，不作為 D06 阻擋項。

## 9. 建議 Migration 草案

已建立 `scripts/migrations/d06_schema_fix_draft.sql`。該檔案僅為草案，包含重複資料與 NULL key 檢查，以及註解化的唯一索引、NOT NULL 與索引候選 SQL；未執行任何 migration。

## 10. 驗證 SQL

已建立 `scripts/verify_d06_schema.sql`。此檔只包含唯讀查詢，用於確認：

- 資料表存在。
- 欄位型別與 NOT NULL。
- 主鍵、唯一約束與 CHECK 約束。
- 索引。
- RLS 與 policy。
- `agri_price_daily` 重複 key 與 NULL code。
- `price_direction_predictions` 筆數、最新日期、upsert key 格式、機率加總、信心值與資料新鮮度。

## 11. 本次未執行事項

- 未執行任何 Supabase SQL。
- 未執行 migration。
- 未建立、刪除或修改雲端資料表。
- 未修改 RLS 或 policy。
- 未刪除舊版 `prediction_results` 或舊程式。
