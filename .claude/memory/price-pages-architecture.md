---
name: price-pages-architecture
description: 售價動態分析功能的架構文件，涵蓋雙頁設計、API、元件樹、資料流
metadata:
  type: project
---

# 售價動態頁面架構

## 設計定調

- 售價功能拆成兩個獨立頁面：列表（`/search`）與詳情（`/product/:name`）
- 三個 query params（`market` / `filter` / `sort`）在兩頁之間完整傳遞，確保導航一致性
- 所有圖表用 Chart.js 4；SVG 元件（RiskGauge、Sparkline、BollingerGauge、VolatilityBarChart）手寫不依賴外部庫

**Why:** 原本列表+詳情同頁造成狀態複雜，拆頁後各自職責清晰，URL 也可分享。

**How to apply:** 新增功能時，列表頁只做「選擇與瀏覽」，詳情頁才做「深度分析」，不要把詳情資訊塞回列表。

---

## Tech Stack

| 層 | 技術 |
|----|------|
| 前端框架 | React 19 + Vite 6 |
| 路由 | React Router v6（useNavigate、useSearchParams、useParams） |
| 樣式 | Tailwind CSS + 自訂 CSS 變數（`var(--yz-*)`） |
| 圖表 | Chart.js 4（`chart.js/auto`）— 橫向 bar、混合線圖 + 成交量柱圖 |
| 後端 | FastAPI + Uvicorn |
| 資料庫 | Supabase PostgreSQL（SQLAlchemy） |
| 部署 | 前端 Vercel / 後端 Render |

---

## 路由設計

| 路由 | 元件 | 功能 |
|------|------|------|
| `/search?market=&filter=&sort=` | `PriceSearch.jsx` | 市場選擇 + 本週情報 + 品項列表 |
| `/product/:name?market=&filter=&sort=` | `ProductDetail.jsx` | 品項詳情 + 走勢圖 + AI 預測 |

---

## 後端 API

### 新增端點

| 端點 | 功能 |
|------|------|
| `GET /api/market-intel` | 本週市場情報（風險指數、多空偏向、漲跌幅排行、異常警報） |
| `GET /api/products/{name}/history` | 擴充 `upper_price`、`lower_price`、`volume` 欄位 |

**`/api/market-intel` 分析邏輯：**
- z_score = `price_vs_ma_7 / price_std_7`（偏離程度）
- status：z < -1.0 → 便宜 / z > 1.0 → 偏貴 / 其他 → 正常
- alert 條件：`|z| > 1.5` 且 `|price_return_7| > 15%`
- divergence：量縮價漲 / 量增價跌（成交量 vs 均量各差 20%+）
- risk_index = 全市場 `AVG(|z_score|)`；> 1.5 → 高風險 / > 1.0 → 中風險
- bullish = MA7 > MA14（黃金交叉）；偏多需 bullish > bearish × 1.5

**快取策略：** 啟動 `lifespan()` 時計算存入 `_price_cache["market_intel"]`，重啟重算。

**`/history` 資料：** 前端固定抓 180 天，依日期切換器（7/30/90/自訂）在前端 slice，不重複打 API。

### 沿用端點

| 端點 | 用途 |
|------|------|
| `GET /api/markets` | 市場下拉清單 |
| `GET /api/products?market=&filter=&sort=` | 品項列表（含 status、today_price） |
| `GET /api/products/{name}?market=` | 品項詳情（行情解析） |
| `GET /api/predictions/direction/latest` | AI 方向預測 |
| `GET /api/solar-term` | 節氣條 |

---

## 前端元件架構

### `PriceSearch.jsx`（列表頁）

```
PriceSearch
├── SolarTermStrip          — 節氣條
├── MarketSelector          — 全寬市場下拉（模糊搜尋，前8+顯示更多）
├── MarketIntelPanel        — 本週情報
│   ├── RiskGauge           — SVG 半圓儀表板（風險指數）
│   ├── 風險指數卡 + 多空偏向卡
│   ├── Chart.js 橫向 bar   — 漲跌幅排行（紅漲/綠跌）
│   └── 異常警報列表 或 VolatilityBarChart（無警報時）
└── 品項列表
    ├── 控制列（搜尋、狀態篩選 tabs、排序、價格 dual-slider）
    └── 品項 rows（品名/今日均價/上價/下價/交易量/7日漲跌）
```

**狀態管理：**
- `market` / `filter` / `sort` → `useSearchParams`（進 URL）
- `query` / `priceRange` → local state（不進 URL）
- 排序邏輯：default → 狀態排序（便宜 > 正常 > 偏貴）；diff_desc/asc → 漲跌幅

---

### `ProductDetail.jsx`（詳情頁）

```
ProductDetail
├── 回到列表按鈕（← /search?{params}）
├── 左側品項切換欄（240px sticky，可收合）
│   ├── 搜尋 input（local state）
│   ├── 品項列表（各附 Sparkline + 狀態 badge + 價格）
│   └── 批次 sparkline 載入（前40品項，各打 /history?days=14）
└── 右側 DetailContent
    ├── 品名 + 股票風格大數字（今日漲跌 ▲▼ + %）
    ├── 日期切換器（7/30/90/自訂）
    ├── 四格 metric 卡（今日均價+上下價+交易量 / MA7 / MA30 / MA90）
    ├── 走勢圖（Chart.js：正常區間色帶 + 均價線 + MA toggle）
    ├── 成交量卡（Chart.js bar，height 90px）
    ├── PriceInsightCard（reason + advice + BollingerGauge）
    └── DirectionCard（AI 方向預測）
```

---

## SVG 子元件

| 元件 | 說明 |
|------|------|
| `Sparkline` | 48×18px 迷你折線，便宜→綠 / 偏貴→紅 / 其他→灰 |
| `RiskGauge` | 80×44 半圓儀表板，填充比例 = risk_index / 上限；顏色隨風險等級 |
| `VolatilityBarChart` | 無警報時顯示；閾值15% 黃色虛線；異常品項橘色 |
| `BollingerGauge` | 520×90 布林帶色帶；今日價格位置以圓點標示；posLabel 判斷區間位置 |

**Chart.js 初始化模式：** useRef 存 instance，effect 內先 destroy 再 new，cleanup return destroy。

---

## 走勢圖 datasets 結構

| index | 資料 | 說明 |
|-------|------|------|
| 0 | upper（MA30 + σ） | fill '+1'，綠色透明色帶 |
| 1 | lower（MA30 - σ） | fill false，透明邊線 |
| 2 | 均價 | crosshairPlugin 讀此 index 取 Y 值 |
| 3 | MA7 | toggle 顯示，橘色 |
| 4 | MA30 | toggle 顯示，藍色 |
| 5 | MA90 | toggle 顯示，紫色 |

**crosshairPlugin：** 自訂 Chart.js plugin，mousemove 畫金黃垂直線 + 水平線；右側浮動 Y 軸標籤；底部 X 軸日期標籤。

---

## 資料來源

| 資料 | 來源表 | 更新方式 |
|------|--------|----------|
| 價格歷史 | `agri_price_daily` | 每日爬蟲寫入 |
| 市場情報特徵 | `agri_price_features_daily` | 每日 `refresh_agri_price_features()` |
| AI 預測 | `agri_price_direction_predictions` | 每日批次 LightGBM |
| 節氣 | 本地計算 | `src/calendar/solar_terms.py` |

---

## 已移除功能

| 項目 | 原因 |
|------|------|
| 天氣影響區塊 | 規格要求移除；2026-07-21 已確認整條產地天氣程式碼鏈（`src/weather/*`、`weather_loader.py`、相關 CSV）一併清除 |
| 替代品推薦（`alternative_recommender.py`） | 前端從未渲染 `alternatives` 欄位，2026-07-21 一併移除 |
| AgriFeatureCard（技術特徵） | 不在新版 spec 範圍 |
| AuctionDetailModal（彈窗） | 改為 API detail 欄位內嵌 |
| 右側詳情面板（原 PriceSearch 分欄） | 獨立為 `/product/:name` 頁面 |

---

## 驗證狀態

- [x] 列表頁品項列表 + 排序篩選
- [x] MarketIntelPanel 顯示（含 RiskGauge、漲跌排行）
- [x] ProductDetail 走勢圖 + MA toggle
- [x] crosshairPlugin 十字線 + 浮動標籤
- [x] 左側 sidebar 收合 + Sparkline
- [x] BollingerGauge 布林帶位置判斷
- [ ] DirectionCard AI 預測（需後端連線）
- [ ] market-intel 實際資料（需後端連線）
