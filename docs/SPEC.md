# SmartBuy AI 開發規格入口

本專案的完整 MVP v1.1 規格位於：

`../SmartBuy_AI_便宜買AI_MVP完整開發規格書_v1.1_含任務中心與24節氣.md`

目前正式 MVP 預測定義以本文件與現行方向分類程式為準：使用截至 `base_date = t` 已知的歷史資料，預測同一市場、同一作物「下一個實際交易日」的平均價格方向：跌、持平、漲。所有對外資料呈現皆須標示「僅供參考」。

## 正式 MVP 預測資料流

```text
Parquet 歷史行情
    ↓
特徵工程
    ↓
LightGBM 下一交易日方向分類
    ↓
price_direction_predictions
    ↓
前端查詢與顯示
```

MVP 不提供未來五日數值價格預測、不提供 `predicted_price`，也不以 `prediction_results` 作為正式預測資料表。

## 資料儲存層與雙層架構規格

### 1. Supabase PostgreSQL (App 資料庫)

- **表 `agri_price_daily`**:
  - 線上 App 近期行情查詢資料表。
  - **資料保留政策**: 預設保留最近 **1 年 (365 天)** 的資料，天數由環境變數 `SMARTBUY_PRICE_RETENTION_DAYS` 配置。
  - 不作為大範圍模型訓練的主要來源；完整歷史行情應優先使用 `data/history_parquet/` 或 Cloudflare R2 Parquet 資料湖。
- **表 `price_direction_predictions`** (正式 MVP 預測結果表):
  - **主鍵與約束**: `upsert_key` 作為主鍵，格式為 `market_id__crop_id__base_date`。
  - **欄位**: `upsert_key`, `market_id`, `market_name`, `crop_id`, `crop_name`, `base_date`, `global_latest_trade_date`, `data_staleness_days`, `prediction_target`, `pred_label_direction`, `pred_label_name`, `prob_down`, `prob_flat`, `prob_up`, `pred_confidence`, `confidence_level`, `risk_level`, `risk_note`, `display_message`, `model_type`, `payload_version`, `created_by_stage`, `prepared_at`, `updated_at`。
  - **寫入流程**: GitHub Actions 每日行情更新成功後執行 `scripts/generate_price_direction_predictions.py`，從 Parquet 資料湖建立 lag/rolling 與類別特徵、載入 `models/07_lightgbm_selected_final.joblib` 並 upsert 至此表。
  - **資料範圍**: 只寫入 `data_staleness_days <= 7` 的近期預測，避免前端展示過舊交易日的方向判斷。
  - **安全限制**: 初次部署需先執行 `scripts/create_price_direction_predictions_table.sql`。若前端需直接讀取此表，必須另行設定只讀 RLS policy；否則建議透過後端 API 查詢。
- **表 `prediction_results`**:
  - 舊版五日價格回歸 / Baseline 設計，已退出 MVP 範圍，不得由目前前台或每日排程使用。
  - 對應程式與測試若保留，僅作為 deprecated 封存流程與歷史回歸保護，不代表正式產品能力。

### 2. 存取層規格

- **統一價格存取層 (`price_repository.py`)**:
  - 服務近期行情查詢，優先讀取 Supabase `agri_price_daily`，資料庫連線失敗時 fallback 到 CSV。
  - 防範 SQL 注入，採用參數化 SQL 查詢。
- **方向分類預測存取層 (`price_direction_prediction_store.py`)**:
  - 正式 MVP 預測資料存取層，負責 `price_direction_predictions` 的 upsert 與 API 查詢。
  - 前端應顯示：預測目標、預測方向、三類機率、信心程度、資料基準日、資料新鮮度、風險提示、展示訊息與「僅供參考」聲明。
  - 查無資料時應回傳/顯示尚無方向預測，不得 fallback 舊版五日價格 CSV。
- **舊版預測存取層 (`prediction_repository.py`, `prediction_store.py`)**:
  - deprecated。只服務舊版 `prediction_results` / `predicted_price` 流程，不是正式 MVP 路徑。

### 3. Parquet 儲存層與 Cloudflare R2 資料湖

- **儲存與命名**: 本地 `data/history_parquet/` 下以 `agri_price_YYYY-MM.parquet` 命名規範儲存歷史資料。
- **Cloudflare R2 同步**: 行情更新時，將自動與 Cloudflare R2 儲存桶進行下載、上傳與上傳後 `head_object` 檔案大小驗證。
- **嚴格模式與 Pruning 防禦**: 當在 GitHub Actions (`GITHUB_ACTIONS=true`) 或 `R2_REQUIRED=true` 時，Secrets 缺漏將直接拋出例外失敗退出。R2 上傳或驗證失敗時，中斷程式且不得執行 Supabase pruning 刪除歷史資料。
- **去重邏輯**: 以 `['trans_date', 'crop_code', 'market_code']` 為主鍵進行 UPSERT 式覆寫去重。
- **ML 載入**: 訓練與正式方向預測應優先呼叫 `load_historical_prices_for_ml()` 載入資料湖資料，嚴禁在大範圍訓練時直接大量查詢 Supabase。
