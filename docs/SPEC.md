# SmartBuy AI 開發規格入口

本專案的完整 MVP v1.1 規格位於：

`../SmartBuy_AI_便宜買AI_MVP完整開發規格書_v1.1_含任務中心與24節氣.md`

實作以該文件為準。MVP 先使用離線示範資料，所有對外資料呈現皆須標示「僅供參考」。

## 資料儲存層與雙層架構規格

### 1. Supabase PostgreSQL (App 資料庫)
- **表 `agri_price_daily`**:
  - 線上 App 專用即時查詢。
  - **資料保留政策**: 僅保留最新 **1～3 個月** 的資料。每日更新腳本執行後，會自動執行修剪指令刪除超過 90 天前之資料：
    ```sql
    DELETE FROM agri_price_daily WHERE trans_date < CURRENT_DATE - INTERVAL '90 days';
    ```
- **表 `prediction_results`** (新增預測寫回表):
  - **主鍵與約束**: 複合唯一約束 `UNIQUE (predict_date, crop_code, market_code)`。
  - **欄位**: `id`, `predict_date`, `crop_code`, `crop_name`, `market_code`, `market_name`, `predicted_price`, `predicted_status`, `created_at`。

### 2. Parquet 本機儲存層 (ML 數據湖)
- **儲存目錄**: `data/history_parquet/`。
- **命名規範**: `agri_price_YYYY-MM.parquet`（按年份與月份分區儲存）。
- **去重邏輯**: 以 `['trans_date', 'crop_code', 'market_code']` 為主鍵進行 UPSERT 式覆寫去重。
- **ML 載入**: 訓練時應優先呼叫 `src/data/data_loader.py` 中的 `load_historical_prices_for_ml(start, end)` 載入數據湖資料，嚴禁在大範圍訓練時直接大量 Query Supabase。

