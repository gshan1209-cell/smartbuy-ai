---
name: price-pages-architecture
description: 售價動態分析功能的完整技術與架構文件，涵蓋兩頁設計、API、元件樹、圖表實作、資料流
metadata:
  type: project
---

# 售價動態頁面架構文件

## 概覽

售價動態功能拆成兩個獨立頁面：

| 路由 | 元件 | 功能 |
|------|------|------|
| `/search` | `PriceSearch.jsx` | 市場選擇 + 本週情報 + 品項列表 |
| `/product/:name` | `ProductDetail.jsx` | 品項詳情 + 走勢圖 + AI 預測 |

---

## Tech Stack

| 層 | 技術 |
|----|------|
| 前端框架 | React 19 + Vite 6 |
| 路由 | React Router v6（`useNavigate`、`useSearchParams`、`useParams`） |
| 樣式 | Tailwind CSS + 自訂 CSS 變數（`var(--yz-*)`） |
| 圖表 | **Chart.js 4**（`chart.js/auto`）— 橫向 bar、混合線圖 + 交易量柱圖 |
| 後端框架 | FastAPI + Uvicorn |
| 資料庫 | Supabase PostgreSQL（SQLAlchemy 連線） |
| 部署 | 前端 Vercel / 後端 Render |

---

## URL 設計

```
/search?market=台北第一果菜市場&filter=便宜&sort=diff_asc
/product/甘藍?market=台北第一果菜市場&filter=便宜&sort=diff_asc
```

三個 query string 參數在列表頁與詳情頁之間完整傳遞，確保導航一致性：

| 參數 | 說明 | 預設 |
|------|------|------|
| `market` | 批發市場名稱 | 後端市場清單第一個 |
| `filter` | 狀態篩選（便宜/正常/偏貴） | 空（全部） |
| `sort` | 排序（`diff_desc` / `diff_asc`） | `default`（依狀態） |

---

## 後端 API

### 新增端點

#### `GET /api/market-intel`

計算來源：`agri_price_features_daily`（全台批發市場最新交易日）

```json
{
  "generated_at": "2026-07-14",
  "latest_trade_date": "2026-07-11",
  "market_stability": {
    "risk_index": 1.32,
    "risk_level": "中風險",
    "volatile_crops": ["青蔥", "菠菜"],
    "stable_crops": ["甘藍", "蘿蔔"]
  },
  "market_bias": {
    "bullish_count": 34,
    "bearish_count": 18,
    "bias": "偏多",
    "top_bullish": ["青蔥", "蘿蔔"],
    "top_bearish": ["甘藍", "菠菜"]
  },
  "gainers": [{ "crop_name": "青蔥", "price_return_7": 0.32, "today_price": 45.0 }],
  "losers":  [{ "crop_name": "甘藍", "price_return_7": -0.18, "today_price": 12.5 }],
  "alerts":  [{ "crop_name": "青蔥", "z_score": 2.1, "status": "偏貴", "severity": "high", "divergence": "量縮價漲" }]
}
```

**分析邏輯（`compute_market_intel()` in `backend/main.py`）：**

```python
z_score = price_vs_ma_7 / price_std_7
status  = "便宜" if z < -1.0 else "偏貴" if z > 1.0 else "正常"
is_alert = abs(z) > 1.5 and abs(price_return_7) > 0.15
severity = "high" if abs(z) > 2.0 else "medium"
divergence = "量縮價漲" if price_return_7 > 0.1 and volume_vs_ma_7 < -0.2
           = "量增價跌" if price_return_7 < -0.1 and volume_vs_ma_7 > 0.2
vol_ratio  = price_std_7 / price_std_14          # 短期波動 vs 中期波動
risk_index = AVG(abs(z_score))                   # 全市場
risk_level = "高風險" if risk_index > 1.5 else "中風險" if > 1.0 else "低風險"
bias = "偏多" if bullish > bearish * 1.5 else "偏空" if bearish > bullish * 1.5 else "中性"
bullish = price_ma_7 > price_ma_14               # MA7 > MA14 = 黃金交叉
volatile_crops = vol_ratio > 1.3, 排序取前 5
```

**快取策略：** 在 `lifespan()` 啟動時計算並存入 `_price_cache["market_intel"]`，重啟時重算。

---

#### `GET /api/products/{name}/history` — 擴充欄位

原本只回傳 `avg_price`，現在加入：

```json
{
  "history": [
    {
      "date": "2026-07-11",
      "price": 12.5,
      "upper_price": 15.0,
      "lower_price": 10.0,
      "volume": 5000.0
    }
  ]
}
```

`volume` 為當日各市場加總（`SUM`），`upper/lower_price` 為平均（`MEAN`）。

前端固定請求 `days=180`，再依切換器（7/30/90/自訂）在前端 slice，避免重複打 API。

---

### 沿用端點

| 端點 | 用途 |
|------|------|
| `GET /api/markets` | 市場選擇器下拉清單 |
| `GET /api/products?market=&filter=&sort=` | 品項列表（含 status、today_price） |
| `GET /api/products/{name}?market=` | 詳情（行情解析、拍賣明細） |
| `GET /api/predictions/direction/latest` | AI 方向預測（DirectionCard） |
| `GET /api/solar-term` | 節氣條 |

---

## 前端元件架構

### `PriceSearch.jsx`（列表頁）

```
PriceSearch
├── SolarTermStrip          — 節氣條（/api/solar-term）
├── MarketSelector          — 全寬市場下拉（模糊搜尋，前8+顯示更多）
├── MarketIntelPanel        — 本週情報（/api/market-intel）
│   ├── RiskGauge           — SVG 半圓儀表板
│   ├── 風險指數卡
│   ├── 多空偏向卡（MA7 > MA14 → bullish）
│   ├── Chart.js 橫向 bar（gainers 紅 / losers 綠，7日漲跌）
│   └── 異常警報卡（有警報時→列表；無警報時→VolatilityBarChart）
│       └── VolatilityBarChart — SVG 純手寫柱狀圖（閾值15% 虛線）
└── 品項列表
    ├── 控制列（搜尋 input、狀態篩選 tabs、排序 select、價格 range dual-slider）
    └── 品項 rows（6 欄 grid：品名/今日均價/上價/下價/交易量/7日漲跌）
        └── 點擊→navigate /product/:name?{params}
```

**狀態管理：**
- `market` / `filter` / `sort` 全部透過 `useSearchParams` 讀寫 URL
- `query`（搜尋）和 `priceRange` 為 local state（不進 URL）
- MarketSelector 不受 filter/sort 影響，只影響 `market` param
- `showAll`：false 時只顯示前 `FEATURED_COUNT=20` 筆

**品項排序邏輯（前端）：**
```js
STATUS_RANK = { '便宜': 0, '正常': 1, '偏貴': 2, '資料不足': 3 }
diffPct = (today_price - recent_average) / recent_average * 100
sort=default → STATUS_RANK 排序
sort=diff_desc → 漲幅最高優先
sort=diff_asc  → 跌幅最大優先
```

**Chart.js 初始化模式（MarketIntelPanel）：**
```jsx
const chartRef = useRef(null);
const chartInstance = useRef(null);

useEffect(() => {
  if (chartInstance.current) chartInstance.current.destroy();
  chartInstance.current = new Chart(chartRef.current, { ... });
  return () => chartInstance.current?.destroy();
}, [data]);
```

---

### `ProductDetail.jsx`（詳情頁）

```
ProductDetail
├── 回到列表按鈕（← /search?{params}）
├── 左側品項切換欄（240px sticky，可收合 ◀/▶）
│   ├── 搜尋 input（sidebarQuery，local state）
│   ├── /api/products?market&filter → 排序後列表
│   │   每項：品名 + 狀態 badge + 價格 + Sparkline（SVG 迷你折線）
│   └── 批次 sparkline 載入（前40品項，各打 /history?days=14）
└── 右側 DetailContent
    ├── 品名 + status badge + 股票風格大數字（含今日漲跌 ▲▼ + %）
    ├── 日期切換器（7/30/90/自訂日期範圍）
    ├── 四格 metric 卡（今日均價+上下價+交易量 / MA7 / MA30 / MA90）
    ├── 走勢圖卡（Chart.js，固定抓 180 天，前端 slice）
    │   ├── MA toggle 按鈕（MA7橘 / MA30藍 / MA90紫）
    │   ├── datasets[0]: 正常上界（fill '+1'，綠色透明色帶）
    │   ├── datasets[1]: 正常下界
    │   ├── datasets[2]: 均價（crosshairPlugin 讀此 index）
    │   ├── datasets[3]: MA7（可切換顯示）
    │   ├── datasets[4]: MA30（可切換顯示）
    │   └── datasets[5]: MA90（可切換顯示）
    ├── 成交量卡（獨立，Chart.js bar，灰色，height 90px）
    ├── PriceInsightCard（reason + advice + BollingerGauge）
    ├── DirectionCard（/api/predictions/direction/latest）
    └── （拍賣行情明細已移除，由 API detail 內嵌欄位取代）
```

---

### 子元件詳情

#### `Sparkline`（SVG 迷你折線）
```jsx
// sidebar 每個品項右側，48×18px SVG
// 用 polyline 手繪，最小值在底、最大值在頂
// sparkColor: 便宜→綠 / 偏貴→紅 / 其他→灰
```

#### `RiskGauge`（SVG 半圓儀表板）
```jsx
// 80×44 viewBox，半圓 path，circumference=PI*r
// 填充比例 = min(max(value, 0), 1) * circumference
// 顏色隨 risk_level：高風險紅 / 中風險橘 / 低風險綠
```

#### `VolatilityBarChart`（SVG 純手寫）
```jsx
// 只在 alerts.length === 0 時顯示（本週無異常警報）
// 100 viewBox 寬，閾值15%畫黃色虛線
// 異常（is_anomaly）→橘，正常→灰
// 標籤取品名前2字
```

#### `BollingerGauge`（布林帶 SVG）
```jsx
// 520×90 viewBox，MA30 ± 1σ 正常區間色帶
// 今日價格位置以圓點 + 垂直虛線標示
// posLabel：
//   rawPos < 0  → "正常區間下方（偏低）"  綠
//   rawPos > 1  → "正常區間上方（偏高）"  紅
//   pct < 20    → "區間下緣"             綠
//   pct > 80    → "區間上緣"             紅
//   else        → "區間中段"             灰
// 內嵌在 PriceInsightCard 底部
```

#### `crosshairPlugin`（Chart.js 自訂 Plugin）
```js
// id: 'crosshair'，在 priceChartRef 上啟用
// afterEvent: mousemove → 記錄 chart._crosshairX, chart._activeDataIndex
//             mouseout  → 清除並 chart.draw()
// afterDraw:  畫金黃虛線（#FFD700）垂直 + 水平
//   水平線讀 datasets[2]（均價）的 Y 值
//   右側 Y 軸浮動標籤 "XX.X 元"
//   底部 X 軸日期標籤
```

---

## MA 計算（前端即時）

```js
function calcMA(prices, n) {
  return prices.map((_, i) => i < n - 1 ? null : avg(prices.slice(i - n + 1, i + 1)));
}
function calcStd(prices) {                // 樣本標準差（n-1）
  const mean = avg(prices);
  return Math.sqrt(prices.reduce((s, v) => s + (v - mean) ** 2, 0) / (prices.length - 1));
}
const std   = calcStd(prices.slice(-30));
const upper = ma30.map(v => v != null ? v + std : null);  // 正常區間上界
const lower = ma30.map(v => v != null ? v - std : null);  // 正常區間下界

// Bollinger（詳情頁 bollinger state，同樣取 slice(-30)）
const mean    = avg(slice);
const sigma   = sqrt(sumSquares / 30);   // 母體標準差
bollinger = { upper: mean + sigma, lower: mean - sigma, mean }
```

**Chart.js 色帶 fill 語法：**
```js
{ data: upper, fill: '+1', backgroundColor: 'rgba(22,163,74,0.08)', borderColor: 'transparent' },
{ data: lower, fill: false, borderColor: 'transparent' },
```

---

## AI 預測正規化（DirectionCard）

```js
function _normalizeBatchPrediction(d) {
  const dirMap = { 漲: 'up', 跌: 'down', 持平: 'flat' };
  return {
    direction: dirMap[d.pred_label_name] || 'flat',
    confidence: d.pred_confidence,
    prob_down / prob_flat / prob_up,
    trade_date: d.base_date,
    note: d.display_message,
    risk_level: d.risk_level,   // 'normal' | 'medium' | 'high'
    risk_note: d.risk_note,
    data_staleness_days: d.data_staleness_days,
  };
}
// risk_level !== 'normal' 時顯示警示框
// data_staleness_days > 0 時顯示資料新鮮度說明
```

---

## 資料來源

| 資料 | 來源 | 說明 |
|------|------|------|
| 價格歷史 | `agri_price_daily`（Supabase） | `load_price_history()` via SQLAlchemy |
| 市場情報特徵 | `agri_price_features_daily`（Supabase） | 每日 `refresh_agri_price_features()` 更新 |
| AI 預測 | `agri_price_direction_predictions`（Supabase） | 每日批次 LightGBM 預測寫入 |
| 節氣 | 本地計算 | `src/calendar/solar_terms.py` |

---

## 已移除功能

| 項目 | 原因 |
|------|------|
| `weather_impact` 天氣影響區塊 | 規格明確要求移除 |
| `AgriFeatureCard`（技術特徵） | 不在新版 spec 範圍 |
| `AuctionDetailModal`（彈窗） | 改為 API detail 欄位，不再獨立顯示 |
| 右側詳情面板（原 PriceSearch 分欄） | 獨立為 `/product/:name` 頁面 |

---

## 本地開發啟動

```bash
# 後端（需 backend/.env 含 DATABASE_URL）
C:\ProgramData\anaconda3\python.exe -m uvicorn backend.main:app --reload --port 8000

# 前端
cd frontend && npm start
```

或透過 `.claude/launch.json` 設定直接用 Claude Code Preview 啟動。

**Python 環境：** Anaconda3（Python 3.13）位於 `C:\ProgramData\anaconda3\`
