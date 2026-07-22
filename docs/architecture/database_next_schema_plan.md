# D06 下一交易日方向分類：資料庫盤點與前置 Schema

本文件描述 SmartBuy AI 目前 D06 的資料庫盤點與前置 Schema 規劃。D06 不再是未來五日數值價格 Baseline，也不寫入 `prediction_results`。

## 1. D06 正式定位

D06 是下一交易日三分類預測流程：

```text
Parquet 歷史行情
    ↓
Lag / Rolling / 類別特徵工程
    ↓
LightGBM 下一交易日方向分類
    ↓
price_direction_predictions
    ↓
後端 API 與前端方向預測卡
```

預測單位為 `market_id × crop_id × base_date`。`base_date` 是該市場與作物在預測當下可取得的最新有效交易日；目標是下一個實際交易日的平均價格方向：跌、持平、漲。

## 2. 最小必要資料表

- `agri_price_daily`: App 近期行情查詢資料表，不作為大範圍模型訓練來源。
- `price_direction_predictions`: 正式 MVP 預測結果表，供每日批次 upsert 與前端讀取。
- `data_update_logs`: 可記錄批次任務狀態，依既有流程使用。

完整歷史行情優先來自 `data/history_parquet/` 或 Cloudflare R2 Parquet 資料湖，不得為了模型訓練大量查詢 Supabase 的 `agri_price_daily`。

## 3. 舊版表定位

`prediction_results` 是舊版五日價格回歸 / Baseline 設計，已退出 MVP 範圍，不得由目前前台或每日排程使用。若實體表仍在 Supabase，僅代表歷史部署或封存用途；本文件不建議也不執行 `DROP TABLE`。

## 4. 建議維度表與治理用途

| 優先級 | 資料表名稱 | 資料來源 | 用途 |
| :--- | :--- | :--- | :--- |
| P0 | `dim_crop` | 農業部作物對照表 | 統一作物代號、官方名稱、別名與分類。 |
| P0 | `dim_market` | 農業部市場對照表 | 統一市場代碼、名稱、縣市與市場類型。 |
| P0 | `market_rest_days` | 農業部休市公告 API / CSV | 協助辨識交易日、休市與資料缺漏。 |
| P1 | `weather_daily` | 氣象署氣象日報 API | 後續氣象特徵擴充。 |
| P1 | `product_origin_mapping` | 農業部種植產地分佈 | 建立作物與氣象觀測站或產地風險的關聯。 |
| P1 | `seasonal_products` | 專家定義 / 盛產量統計 | 首頁節氣與當季推薦。 |
| P2 | `tap_products` | 產銷履歷公開 API | 前台加值展示，與 MVP 方向預測無直接依賴。 |

`dim_crop`、`dim_market`、`market_rest_days` 可繼續保留為資料治理規劃。這三張維度表不是目前模型執行的硬性前置條件，除非現有程式已實際依賴。

`market_rest_days` 的用途是協助辨識交易日、休市與資料缺漏，不是用前一日價格製造虛構的休市日行情。Lag 與 Rolling 特徵應依實際有效交易紀錄計算，不得把休市日直接視為價格為 0。

## 5. P0 Schema 草案

### `dim_crop`

```sql
CREATE TABLE dim_crop (
    crop_code VARCHAR(50) PRIMARY KEY,
    crop_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    aliases TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dim_crop_name ON dim_crop (crop_name);
```

### `dim_market`

```sql
CREATE TABLE dim_market (
    market_code VARCHAR(50) PRIMARY KEY,
    market_name VARCHAR(100) NOT NULL,
    city VARCHAR(50),
    market_type VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `market_rest_days`

```sql
CREATE TABLE market_rest_days (
    id SERIAL PRIMARY KEY,
    rest_date DATE NOT NULL,
    market_code VARCHAR(50) NOT NULL,
    rest_reason VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (rest_date, market_code)
);

CREATE INDEX idx_market_rest_date ON market_rest_days (rest_date);
```

## 6. D06 完成條件

- 已確認行情資料鍵值與型別。
- 已確認 `price_direction_predictions` Schema。
- 已確認唯一鍵與 upsert 行為。
- 已確認模型輸出欄位與資料表欄位一致。
- 已確認前端只讀取方向分類結果。
- 已確認舊版五日回歸流程不再被正式排程或前台使用。
- 已更新相關文件、測試與交接紀錄。
