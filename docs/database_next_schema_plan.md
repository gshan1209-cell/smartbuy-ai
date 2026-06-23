# D06 前置資料表設計與規劃計畫書 (Database Schema Plan)

本文件針對 SmartBuy AI 專案下一階段 **TASK-D06 (ML 訓練與預測產生流程)** 以及後續資料庫擴充，提出最小必要資料表評估、新增維度表草案與優先順序。

---

## 1. D06 Baseline Prediction 最小必要資料表

在 TASK-D06 中，若我們先以 **Baseline 基準預測**（如：最近 7~14 天移動平均、前一週同期價格、基本漲跌幅）作為模型起步，則：

* **核心結論**：**D06 不需要一次性實作所有外部特徵表**。
* **最小必要資料表**：僅需目前已建妥的核心資料表即可運作：
  1. `agri_price_daily` / Parquet 歷史行情數據：作為模型訓練特徵與今日基準點的來源。
  2. `prediction_results`：存放模型產出的 5 日預測結果。
  3. `data_update_logs`：記錄預測生成任務的批次日誌。

### 預測寫入流程：
```
Parquet 歷史資料 (ML 離線特徵)
      ↓
ML Baseline 預測腳本 (計算 MA7, MA14, 漲跌)
      ↓
呼叫 save_predictions_to_supabase() 
      ↓
寫入 Supabase 'prediction_results'
      ↓
Streamlit 搜尋頁即時展示
```

---

## 2. 建議新增資料表與優先級 (P0 ~ P2)

為了解決作物與市場代碼、休市判定等典型資料混淆問題，我們規劃了以下擴充階層：

| 優先級 | 資料表名稱 | 資料來源 | 為什麼重要 / 解決什麼問題 |
| :--- | :--- | :--- | :--- |
| **P0**<br>(D06 前建議先規劃，可於 D06A 或後續任務逐步實作；**非 baseline prediction 硬性前置條件**) | `dim_crop` (作物維度表) | 農業部作物對照表 | 統一作物代號與別名，避免 `FL120` 與 `LA1` 這種代碼混淆。 |
| **P0**<br>(D06 前建議先規劃，可於 D06A 或後續任務逐步實作；**非 baseline prediction 硬性前置條件**) | `dim_market` (市場維度表) | 農業部市場對照表 | 統一市場代碼，區分市場類型（果菜/花卉），優化前台關聯。 |
| **P0**<br>(D06 前建議先規劃，可於 D06A 或後續任務逐步實作；**非 baseline prediction 硬性前置條件**) | `market_rest_days` (休市曆) | 農業部休市公告 API / CSV | 避免 ML 訓練與異常檢測將「休市」誤判為「缺值」或「價格歸零」。 |

| **P1** (D06後建議) | `weather_daily` (氣象觀測) | 氣象署氣象日報 API | 提供溫度、降雨量等特徵，支撐 ML 氣象預測模組。 |
| **P1** (D06後建議) | `product_origin_mapping` (產地對照)| 農業部種植產地分佈 | 建立作物與氣象觀測站的產地映射關聯。 |
| **P1** (D06後建議) | `seasonal_products` (當季盛產) | 專家定義 / 盛產量統計 | 供首頁節氣與當季主打品項推薦。 |
| **P1** (D06後建議) | `production_costs` (生產成本) | 農業部成本調查季報 | 作為批發行情合理利潤與價格下限之參考。 |
| **P2** (展示延伸) | `tap_products` (履歷商品資訊) | 產銷履歷公開 API | 增加系統具信譽之產線特色展示（與價格預測無關）。 |

---

## 3. P0 資料表欄位草案 (Schema Drafts)

### 3.1. `dim_crop` (農作物維度表)
* **設計目的**：建立作物的唯一代碼、官方名稱、分類與別名，提供前台快速搜尋對齊。
```sql
CREATE TABLE dim_crop (
    crop_code VARCHAR(50) PRIMARY KEY,
    crop_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),               -- e.g., '葉菜類', '根莖類', '花卉類'
    aliases TEXT,                       -- 用於模糊搜尋的別名/俗名，逗號分隔
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 索引優化名稱檢索
CREATE INDEX idx_dim_crop_name ON dim_crop (crop_name);
```

### 3.2. `dim_market` (市場維度表)
* **設計目的**：管理全台果菜、花卉批發市場的代碼、全名、城市與主營業務。
```sql
CREATE TABLE dim_market (
    market_code VARCHAR(50) PRIMARY KEY,
    market_name VARCHAR(100) NOT NULL,
    city VARCHAR(50),                   -- e.g., '台北市', '台中市'
    market_type VARCHAR(50),            -- e.g., 'fruit_veg' (果菜), 'flower' (花卉)
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.3. `market_rest_days` (休市日程表)
* **設計目的**：明確指出特定批發市場在特定日期是否休市。ML 特徵工程在計算「前日移動平均」或「前日價格」時，應自動忽略休市日以防特徵偏誤。
```sql
CREATE TABLE market_rest_days (
    id SERIAL PRIMARY KEY,
    rest_date DATE NOT NULL,
    market_code VARCHAR(50) NOT NULL,
    rest_reason VARCHAR(100),           -- e.g., '端午節休市', '例行整理'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (rest_date, market_code)     -- 聯合唯一約束
);
CREATE INDEX idx_market_rest_date ON market_rest_days (rest_date);
```

---

## 4. 不建議現在實作的資料表與原因

* **`weather_daily` (天氣觀測資料)** & **`product_origin_mapping` (產地對照)**
  * **原因**：雖然天氣與雨量對於農產品價格長期波動非常重要，但若是與 D06 Baseline 一起實作，會大幅增加 API 串接、空間對齊、產地比重加權計算的複雜度。建議在 D06 Baseline 跑通「預測結果寫回前台」後，在 D07 中以「機器學習特徵擴充」的定位引入。
* **`production_costs` (生產成本)**
  * **原因**：成本統計多為季報或年報，更新頻率極低，且與短期（5天內）批發價格波動無直接關聯，無須作為預測特徵。
* **P2 履歷與有機認證資料表 (`tap_products`, `organic_products`)**
  * **原因**：此類資料主要用於前台加值展示，不參與價格走勢與波動預測，不應佔用 ML 開發資源。

---

## 5. 後續 TASK-D06 銜接指引

1. **ML 離線訓練**：
   * 腳本直接從本機 `data/history_parquet/` 載入全量行情歷史，利用特徵工程產生滯後價格（Lag features：$t-1, t-2, \dots$）與滑動平均（Rolling statistics）。
2. **今日實時特徵準備**：
   * 腳本向 Supabase 查詢 `agri_price_daily` 取得最新 14 天的實際價格，拼接至特徵矩陣末端。
3. **休市日前處理**：
   * 計算移動平均時，應先向 `market_rest_days` 查詢，將休市日跳過或以前一日數值填補，避免產生大量的缺值與異常抖動。
4. **寫回 Supabase**：
   * ML 預測完成後，呼叫 `save_predictions_to_supabase`，將未來 5 天的預測資料 upsert 至 `prediction_results` 即可在前台實時渲染。
