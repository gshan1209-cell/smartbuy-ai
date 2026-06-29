# SmartBuy AI 開發規格入口

本專案的完整 MVP v1.1 規格位於：

`../SmartBuy_AI_便宜買AI_MVP完整開發規格書_v1.1_含任務中心與24節氣.md`

實作以該文件為準。MVP 先使用離線示範資料，所有對外資料呈現皆須標示「僅供參考」。

## 資料儲存層與雙層架構規格

### 1. Supabase PostgreSQL (App 資料庫)
- **表 `agri_price_daily`**:
  - 線上 App 專用即時查詢。
  - **資料保留政策**: 預設保留最近 **1 年 (365 天)** 的資料，天數由環境變數 `SMARTBUY_PRICE_RETENTION_DAYS` 配置。每日更新腳本執行後，會自動執行修剪指令：
    ```sql
    DELETE FROM agri_price_daily WHERE trans_date < CURRENT_DATE - (:retention_days * INTERVAL '1 day');
    ```
- **表 `prediction_results`** (新增預測寫回表):
  - **主鍵與約束**: 複合唯一約束 `UNIQUE (predict_date, crop_code, market_code)`。
  - **欄位**: `id`, `predict_date`, `crop_code`, `crop_name`, `market_code`, `market_name`, `predicted_price`, `predicted_status`, `created_at`。
- **表 `price_reports`** (買貴通報資料表):
  - **主鍵與約束**: `id` SERIAL PRIMARY KEY，且 `report_id` VARCHAR(50) NOT NULL UNIQUE。
  - **欄位**: `id`, `report_id`, `report_date`, `crop_name`, `product_name`, `market_name`, `user_price`, `unit`, `reference_price`, `price_gap`, `price_gap_percent`, `report_note`, `write_destination`, `created_at`。
- **統一價格存取層 (`price_repository.py`)**:
  - **Fallback 機制**: 僅在資料庫連線失敗、例外或初始加載無資料時 fallback 到 CSV。若查詢成功但為 0 筆結果，直接回傳空 DataFrame，前台顯示「查無資料」。
  - **資料來源一致性**: 藉由 pandas 的 `df.attrs["source"]` 回傳實際查詢來源，避開 Streamlit 重新整理所導致的狀態不一致。
  - **欄位對齊**: 標準化輸出 DataFrame，同時對齊 `crop_name` 與 `product_name`（資料一致），確保前台與預警系統相容。
  - **防範 SQL 注入**: 採用參數化 SQL 查詢。
- **統一通報存取層 (`report_repository.py`)**:
  - **Fallback 機制**: 優先寫入 Supabase `price_reports` 表，連線失敗或無資料表時自動 fallback 寫入本機 `data/reports/price_reports.csv`。
  - **空行情相容**: 若無對比行情，對比價差寫入 NULL，且頁面不崩潰、正常提交。
  - **防範 SQL 注入**: 採用 SQLAlchemy 參數化插入。
  - **欄位與狀態**: 回傳 dict 帶有 `write_destination`（`"Supabase"` 或 `"本機 CSV"`）以指示實際儲存目標。
- **統一預測存取層 (`prediction_repository.py`)**:
  - **Fallback 機制**: 優先自 Supabase `prediction_results` 表讀取，連線失敗或無該表時自動安全 fallback 讀取本機 `data/processed/prediction_results.csv`。
  - **過濾與排序**: 在 Supabase SQL 與 CSV 備援中皆強制套用 `predict_date >= today` 過濾，並以 `predict_date ASC` 排序，以保證只展示未來且按時間遞增的預測行情。
  - **前台精準對齊**: 搜尋頁展示預測結果時，優先使用目前查詢結果的 `crop_code + market_code` 進行精準匹配；若代碼不足或無資料，再 fallback 使用 `crop_name + market_name` 比對，防止不同產地或品項的預測資料混用。


### 2. Parquet 儲存層與 Cloudflare R2 資料湖
- **儲存與命名**: 本地 `data/history_parquet/` 下以 `agri_price_YYYY-MM.parquet` 命名規範（按年份與月份分區儲存）儲存歷史資料。
- **Cloudflare R2 同步**: 行情更新時，將自動與 Cloudflare R2 儲存桶進行下載、上傳與上傳後 `head_object` 檔案大小驗證。
- **嚴格模式與 Pruning 防禦**: 當在 GitHub Actions (GITHUB_ACTIONS=true) 或 R2_REQUIRED=true 時，Secrets 缺漏將直接拋出例外失敗退出。R2 上傳或驗證失敗時，中斷程式且不得執行 Supabase pruning 刪除歷史資料，防範資料流失。
- **去重邏輯**: 以 `['trans_date', 'crop_code', 'market_code']` 為主鍵進行 UPSERT 式覆寫去重。
- **ML 載入**: 訓練時應優先呼叫 `src/data/data_loader.py` 中的 `load_historical_prices_for_ml(start, end)` 載入數據湖資料，嚴禁在大範圍訓練時直接大量 Query Supabase。

