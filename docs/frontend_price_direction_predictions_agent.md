# 前端 Agent 交接：每日價格方向預測資料串接

本文給負責前端的 Agent 使用，說明如何把每日 ML 預測結果呈現在 SmartBuy AI 前端。

## 1. 目前有兩種方向預測來源

### A. 既有即時單品預測 API

目前前端 `frontend/src/pages/PriceSearch.jsx` 已有 `DirectionCard`，它呼叫：

```text
GET /api/products/{productName}/direction?market={marketName}
```

這個 API 會由後端即時載入最近歷史資料，再呼叫 `src/ml/direction_predictor.py` 產生單一品項方向預測。

適合用途：

- 使用者搜尋單一品項時，即時顯示一張方向預測卡。
- 不需要先查 Supabase `price_direction_predictions` 表。

### B. 新增每日批次預測表

GitHub Actions 每日已會執行：

```text
scripts/generate_price_direction_predictions.py
```

並把全量市場 × 作物的方向預測 upsert 到 Supabase：

```text
price_direction_predictions
```

這張表是本文件主要要串接的資料來源。

適合用途：

- 預測清單頁
- Dashboard
- 市場/作物篩選
- 前端快速讀取已算好的每日預測，不在使用者操作時重新跑模型

## 2. 建議前端不要直接用 service key 查 Supabase

前端不可使用：

```text
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

建議做法是：

```text
React 前端
  -> 呼叫 FastAPI 後端 API
  -> 後端用 DATABASE_URL 查 price_direction_predictions
  -> 回傳前端需要的欄位
```

只有在 Supabase 已設定只讀 RLS policy 且使用 anon key 時，前端才可以直接查 Supabase REST API。

## 3. 建議新增的後端 API 契約

請後端 Agent 優先提供以下 API，前端再串接。

### 查詢單一市場作物最新方向預測

```text
GET /api/predictions/direction/latest?crop_id={crop_id}&market_id={market_id}
```

名稱 fallback：

```text
GET /api/predictions/direction/latest?crop_name={crop_name}&market_name={market_name}
```

後端查詢條件：

```sql
SELECT
    market_id,
    market_name,
    crop_id,
    crop_name,
    base_date,
    global_latest_trade_date,
    data_staleness_days,
    prediction_target,
    pred_label_direction,
    pred_label_name,
    prob_down,
    prob_flat,
    prob_up,
    pred_confidence,
    confidence_level,
    risk_level,
    risk_note,
    display_message,
    model_type,
    payload_version,
    prepared_at
FROM price_direction_predictions
WHERE data_staleness_days <= 7
  AND crop_id = :crop_id
  AND market_id = :market_id
ORDER BY base_date DESC
LIMIT 1;
```

### 查詢多筆方向預測列表

```text
GET /api/predictions/direction?market_id={market_id}&direction={pred_label_name}&risk={risk_level}&limit=100
```

後端固定條件：

```text
data_staleness_days <= 7
```

建議排序：

```text
risk_level desc, pred_confidence desc, base_date desc
```

## 4. 前端應使用的欄位

最小顯示欄位：

| 欄位 | 用途 |
|---|---|
| `market_name` | 市場名稱 |
| `crop_name` | 作物名稱 |
| `base_date` | 模型依據的最新交易日 |
| `pred_label_name` | 預測方向：跌、持平、漲 |
| `prob_down` | 預測為跌的機率 |
| `prob_flat` | 預測為持平的機率 |
| `prob_up` | 預測為漲的機率 |
| `pred_confidence` | 模型最高機率 |
| `confidence_level` | 低、中、高 |
| `risk_level` | normal、medium、high |
| `risk_note` | 風險提醒文字 |
| `display_message` | 後端已整理好的白話訊息 |
| `data_staleness_days` | 資料距離全域最新交易日的天數 |

不要在前端重新計算：

- `pred_label_name`
- `pred_confidence`
- `confidence_level`
- `risk_level`
- `risk_note`

這些語意由模型 pipeline 決定，前端只負責呈現。

## 5. 前端渲染規則

方向顏色建議：

```js
const DIRECTION_META = {
  漲: { color: '#DC2626', bg: '#FEF2F2', arrow: '↑', label: '預測看漲' },
  跌: { color: '#16A34A', bg: '#F0FDF4', arrow: '↓', label: '預測看跌' },
  持平: { color: '#6B7280', bg: '#F9FAFB', arrow: '→', label: '預測持平' },
};
```

風險呈現規則：

- `risk_level === "high"`：必須顯示 `risk_note`，不要只顯示方向。
- `risk_level === "medium"`：顯示提醒樣式，建議搭配趨勢圖。
- `risk_level === "normal"`：可用一般樣式。
- `confidence_level === "低"`：仍可顯示，但要標示信心偏低。
- `data_staleness_days > 0`：顯示「依據 N 天前交易資料」。

不要做的事：

- 不要隱藏高風險提醒。
- 不要把低信心資料偽裝成高可信建議。
- 不要把 `漲` 直接寫成「建議立刻購買」。
- 不要在前端改寫模型方向。

## 6. React 串接範例

目前專案已有：

```js
import { get } from '../hooks/useApi';
```

建議新增一個使用每日批次表的卡片，例如：

```jsx
function DailyDirectionPredictionCard({ cropId, marketId, cropName, marketName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    const params = cropId && marketId
      ? `crop_id=${encodeURIComponent(cropId)}&market_id=${encodeURIComponent(marketId)}`
      : `crop_name=${encodeURIComponent(cropName)}&market_name=${encodeURIComponent(marketName || '')}`;

    get(`/api/predictions/direction/latest?${params}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [cropId, marketId, cropName, marketName]);

  if (loading) return <div>載入 AI 預測中...</div>;
  if (!data) return <div>目前尚無此品項的每日方向預測</div>;

  const meta = DIRECTION_META[data.pred_label_name] || DIRECTION_META['持平'];
  const confidencePct = Math.round((data.pred_confidence || 0) * 100);

  return (
    <section style={{ background: meta.bg, borderRadius: 8, padding: 16 }}>
      <div style={{ color: meta.color, fontWeight: 800 }}>
        {meta.arrow} {meta.label}
      </div>
      <div>{data.display_message}</div>
      <div>信心：{data.confidence_level}（{confidencePct}%）</div>
      <div>基準日：{data.base_date}</div>

      {data.risk_level !== 'normal' && (
        <div style={{ marginTop: 8, color: '#92400E' }}>
          {data.risk_note}
        </div>
      )}
    </section>
  );
}
```

## 7. 直接查 Supabase 的備用方案

只有在 Supabase 已開啟安全的只讀 RLS policy 時才使用。

環境變數只能放 anon key：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

不可放：

```text
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

REST 查詢範例：

```js
const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/price_direction_predictions`
  + `?select=market_id,market_name,crop_id,crop_name,base_date,pred_label_name,prob_down,prob_flat,prob_up,pred_confidence,confidence_level,risk_level,risk_note,display_message,data_staleness_days`
  + `&market_id=eq.${encodeURIComponent(marketId)}`
  + `&crop_id=eq.${encodeURIComponent(cropId)}`
  + `&data_staleness_days=lte.7`
  + `&order=base_date.desc`
  + `&limit=1`;

const res = await fetch(url, {
  headers: {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  },
});
```

## 8. 與現有 `DirectionCard` 的關係

目前 `PriceSearch.jsx` 已有：

```text
DirectionCard -> GET /api/products/{name}/direction
```

這張卡是即時單品模型推論。

若要切到每日批次表，可採以下任一做法：

1. 保留現有 `DirectionCard`，另新增 `DailyDirectionPredictionCard`。
2. 將 `DirectionCard` 改成先查 `/api/predictions/direction/latest`，查不到時 fallback 到 `/api/products/{name}/direction`。
3. Dashboard 或列表頁只使用每日批次表，不使用即時推論 API。

建議第一階段採用第 2 種，使用者體驗較穩：

```text
先查每日批次表
  -> 有資料：顯示批次預測
  -> 無資料：fallback 即時單品方向預測
```

## 9. 驗收方式

前端 Agent 完成後請驗證：

- 搜尋頁可顯示每日方向預測。
- 高風險與低信心時有明確提醒。
- 機率條顯示 `prob_down/prob_flat/prob_up`。
- 查不到資料時不崩潰，顯示「目前尚無此品項的每日方向預測」。
- 不在前端出現 service role key 或 database URL。
- `npm run build` 通過。

後端 API 尚未完成時，前端 Agent 應先開 issue 或交接給後端 Agent，不要把 service role key 放進前端。
