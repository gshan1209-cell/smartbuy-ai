# Codex 任務｜PR-4 Dashboard Overview 與共用 Dashboard 元件

Repository：

```text
https://github.com/gshan1209-cell/smartbuy-ai.git
```

建議分支：

```text
feat/dashboard-overview-components
```

建議 PR 標題：

```text
feat(dashboard): build live overview and reusable dashboard components
```

---

## 1. 開始前必讀

請依序完整閱讀：

1. `AGENT.md`
2. `docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md`
3. `docs/uiux/SMARTBUY_UIUX_TASKS.md`
4. 本文件
5. `frontend/src/layouts/DashboardLayout.jsx`
6. `frontend/src/pages/dashboard/DashboardOverview.jsx`
7. `frontend/src/data/dashboardMock.js`
8. `frontend/src/styles/dashboard-layout.css`
9. `frontend/src/components/shared/`
10. `frontend/src/components/dashboard/`
11. `backend/routers/market.py`
12. `backend/routers/product.py`
13. `backend/routers/prediction.py`
14. `backend/routers/mutual_aid.py`

開始修改前，必須先盤點目前 Dashboard 骨架、共用元件與正式 API。

### 最高優先規則

- 禁止為了重新設計 Dashboard 而任意刪除既有前台、後台、路由或共用元件。
- 不得用看似真實的固定數字冒充正式營運數據。
- 已有正式 API 的資料，必須優先使用正式 API。
- 沒有管理 API 的指標，必須顯示「尚未接入管理 API」或「資料不可用」，不得自行編造。
- 不得把 API 請求失敗顯示成 `0`，因為 `0` 與「無法取得」是不同狀態。
- `npm run build` 成功不代表驗收完成，必須驗證 Partial Error、Empty、Loading 與三尺寸版型。
- 大量刪除 `dashboardMock.js` 或原有 Dashboard 程式碼前，必須確認所有引用已移除，並在 PR 說明替代位置。

---

## 2. 本次任務目標

完成 Phase 3：

1. Dashboard Overview 真實資料整合
2. `DashboardMetricCard`
3. `DashboardChartCard`
4. `ResponsiveDataTable`
5. `DashboardFilterBar`
6. Dashboard 專用 loading／empty／error／partial error 狀態
7. Mobile／Tablet／Desktop 三尺寸 Dashboard

本次不建立完整後台 CRUD，不修改角色權限後端，不重做前台。

---

# 3. Dashboard 資料原則

## 3.1 正式 API 優先

目前可使用的正式 API：

```text
GET /api/products
GET /api/market-intel
GET /api/predictions/direction?limit=100
GET /api/mutual-aid/posts?limit=100&offset=0
GET /api/markets
```

請建立集中式 adapter，例如：

```text
frontend/src/lib/dashboardOverviewAdapter.js
```

禁止將 API 整合邏輯散落在多個卡片 JSX 中。

Adapter 應使用 `Promise.allSettled()` 或等價設計，允許單一來源失敗時其他區塊仍正常顯示。

## 3.2 可由正式 API 計算的資訊

### 行情資料

由 `GET /api/products` 計算：

- 可用品項數
- 便宜品項數
- 正常品項數
- 偏貴品項數
- 資料不足品項數
- 最新交易日：取 `trans_date`／`latest_trade_date`／`updated_at` 的最大值
- 最近資料市場數：由 `market_name` 去重

注意：

- `/api/products` 回傳的是品項狀態清單，不一定等於資料庫原始行情筆數。
- 卡片名稱應使用「可用行情品項」或「目前品項數」，不得標成「資料庫總筆數」。

### 市場情報

由 `GET /api/market-intel` 顯示：

- `latest_trade_date`
- 市場風險指數與等級
- 多空偏向
- 異常警報數
- 漲幅排行
- 跌幅排行
- 波動品項
- 穩定品項

不得把市場情報 API 失敗視為低風險或零警報。

### AI 預測

由 `GET /api/predictions/direction?limit=100` 計算：

- 目前取得的預測筆數
- 漲／持平／跌分布
- normal／medium／high 風險分布
- 最新預測基準日
- 平均信心值
- 高風險預測清單

注意：

- API 上限為 100 筆，因此卡片要標示「本次取得預測筆數」或「最近預測樣本」。
- 不得直接宣稱是全站預測總數。
- 不得直接顯示「AI 預測完成率 96%」等固定值。
- 若要計算 coverage，只能以清楚說明的分母與分子計算，並標示為「估算覆蓋率」。

### 互助網

由 `GET /api/mutual-aid/posts?limit=100&offset=0` 顯示：

- 最近取得貼文數
- 最近貼文類型分布
- 最近資料中的 open／dealing／closed 狀態分布
- 最近待處理貼文清單

注意：

- 此 API 沒有 total，因此不得將前 100 筆統計宣稱為全站總數。
- 標題應使用「最近貼文」或「最近 100 筆中的未結案貼文」。

## 3.3 目前沒有正式管理 API 的資訊

目前不可直接取得：

- 全站會員總數
- 今日新增會員
- 全站收藏排行
- 真實資料任務執行紀錄
- GitHub Actions 執行狀態
- Render／Vercel 系統錯誤總數
- 後台待審核內容總數

這些卡片不可顯示虛構數字。

可採以下其中一種方式：

1. 顯示「尚未接入管理 API」
2. 顯示 `—`
3. 顯示模組說明與下一步
4. 不放入第一版 KPI，改放「待接資料來源」區塊

若保留 Demo 開關，只能用於開發狀態展示，必須清楚標示 `Demo`，且正式 ready 狀態不得混用 Demo 數字。

---

# 4. Dashboard Overview 版型

路由：

```text
/dashboard
/dashboard/overview
```

兩個路由應進入同一個 Overview。

## 4.1 頁首

顯示：

- 頁面名稱：營運總覽
- 最後重新整理時間
- 資料來源狀態摘要
- 手動重新整理按鈕
- 若使用 development mock role，清楚顯示角色或 Demo 標籤

## 4.2 KPI 區

第一版建議 8 張卡：

1. 可用行情品項
2. 最新交易日
3. 偏貴／便宜異常品項
4. 市場風險等級
5. 本次取得預測筆數
6. 高風險預測數
7. 最近未結案互助貼文
8. 尚未接管理 API 的模組數或資料來源健康狀態

每張卡必須顯示：

- label
- value 或 `—`
- status badge
- 資料日期或 fetched time
- 資料來源
- loading／error／unavailable 狀態
- 可選的趨勢或補充說明

禁止所有卡片統一顯示「資料日期：今日」。

## 4.3 市場情報區

建立：

- 市場風險摘要卡
- 漲跌排行圖表
- 異常警報清單
- 波動／穩定品項標籤

使用正式 `/api/market-intel`。

若 API 空物件或失敗：

- 顯示 Empty 或 Error
- 不得顯示零風險
- 其他 Dashboard 區塊仍可使用

## 4.4 AI 預測區

建立：

- 漲／持平／跌分布圖
- 風險等級分布
- 最近高風險預測表格

欄位建議：

```text
品項
市場
方向
信心
風險
基準日
資料新鮮度
```

## 4.5 互助網區

建立最近未結案貼文清單：

```text
類型
內容摘要
縣市
狀態
按讚數
建立時間
```

點擊可前往：

```text
/mutual-aid?post=<postId>
```

資料只代表本次 API 取得範圍，畫面需說明。

## 4.6 資料來源健康狀態

建立資料來源狀態區，不要虛構資料任務紀錄。

至少列出：

```text
行情 API
市場情報 API
AI 預測 API
互助網 API
會員管理 API
收藏分析 API
任務監控 API
```

狀態：

- 正常
- 空資料
- 載入失敗
- 尚未接入

並顯示本次檢查時間。

---

# 5. 共用 Dashboard 元件

## 5.1 DashboardMetricCard

建議位置：

```text
frontend/src/components/dashboard/DashboardMetricCard.jsx
```

Props 至少包含：

```text
label
value
icon
tone
status
source
updatedAt
description
loading
error
unavailable
```

要求：

- 不將 `0` 與 unavailable 混為一談
- 支援 className
- 支援深色模式
- 狀態不可只靠顏色
- Mobile 不截斷重要數字

## 5.2 DashboardChartCard

建議位置：

```text
frontend/src/components/dashboard/DashboardChartCard.jsx
```

統一提供：

- 標題
- 說明
- 資料日期
- 來源標籤
- loading
- empty
- error
- children chart container

Chart.js 要求：

- responsive
- `maintainAspectRatio: false`
- 資料更新與 unmount 時 `destroy()`
- 深色模式文字與格線可讀
- Mobile 減少 labels，不可讓圖表溢出

## 5.3 ResponsiveDataTable

建議位置：

```text
frontend/src/components/dashboard/ResponsiveDataTable.jsx
```

至少支援：

```text
columns
rows
rowKey
loading
emptyTitle
error
sort
onSort
page
pageSize
total
onPageChange
mobileCardRenderer
onRowClick
```

RWD：

- Desktop：完整表格
- Tablet：隱藏次要欄位或縮短文字
- Mobile：改成卡片，不要硬塞完整表格

要求：

- 表頭排序按鈕可鍵盤操作
- Row click 需支援 Enter／Space，或使用明確連結／按鈕
- Empty／Error 不得顯示成空白表格

## 5.4 DashboardFilterBar

建議位置：

```text
frontend/src/components/dashboard/DashboardFilterBar.jsx
```

支援：

- 關鍵字
- 市場
- 品項
- 狀態
- 日期範圍
- 清除篩選
- Mobile Drawer

本 PR 可先在 AI 預測或互助網表格實際使用至少一次，避免建立未使用元件。

---

# 6. 狀態與錯誤處理

Dashboard 必須支援：

- Initial loading
- Refresh loading
- Full error
- Partial error
- Empty data
- Unavailable API
- Stale data

## Partial Error 規則

例如市場情報 API 失敗，但行情與預測成功：

- 行情 KPI 正常顯示
- AI 預測正常顯示
- 市場情報區顯示錯誤
- 頁首顯示「部分資料來源異常」
- 不得整頁白屏

## Refresh 規則

- 使用者點重新整理後，保留上一版成功資料直到新資料回來
- 不要讓整頁突然清空
- 顯示 refreshing 狀態
- 單一來源失敗時保留其他來源

---

# 7. RWD 規格

必須驗證：

```text
360 × 800
390 × 844
768 × 1024
834 × 1112
1200 × 800
1440 × 900
```

## Mobile

- KPI 單欄
- Chart 單欄
- 表格轉卡片
- Filter 使用 Drawer
- Sidebar 使用既有 Dashboard Drawer
- 不得產生全頁水平捲軸

## Tablet

- KPI 兩欄
- 圖表可一欄或兩欄，依可讀性決定
- Sidebar 維持圖示模式
- 表格隱藏次要欄位

## Desktop

- KPI 四欄
- 主要圖表兩欄
- 警示與資料來源可並排
- Dashboard 內容最大寬度與 Sidebar 對齊

---

# 8. Accessibility

- 圖示按鈕有 `aria-label`
- 圖表需有文字摘要
- 表格排序狀態使用 `aria-sort`
- 顏色不可作為唯一的風險判斷
- 所有可點擊卡片可用鍵盤操作
- focus 樣式清楚
- 按鈕觸控區至少 44 × 44px
- Loading 使用可理解文字，不只 spinner

---

# 9. 樣式與程式碼規則

- 新元件優先使用 `tokens.css`
- 不新增第三套色彩系統
- 不以大量 inline style 建立 Dashboard
- 將 Dashboard CSS 拆分為可維護檔案，例如：

```text
frontend/src/styles/dashboard-layout.css
frontend/src/styles/dashboard-overview.css
frontend/src/styles/dashboard-components.css
```

- 不得將所有 JSX 壓成單行
- Adapter、格式化與計算函式要有清楚命名
- 不要把所有邏輯塞在 `DashboardOverview.jsx`

建議結構：

```text
frontend/src/
├─ components/dashboard/
│  ├─ DashboardMetricCard.jsx
│  ├─ DashboardChartCard.jsx
│  ├─ ResponsiveDataTable.jsx
│  ├─ DashboardFilterBar.jsx
│  └─ DataSourceStatusList.jsx
├─ lib/
│  └─ dashboardOverviewAdapter.js
├─ pages/dashboard/
│  └─ DashboardOverview.jsx
└─ styles/
   ├─ dashboard-overview.css
   └─ dashboard-components.css
```

---

# 10. 禁止事項

本次禁止：

- 新增虛構會員數、收藏數、錯誤數或任務執行數
- 將 API error 顯示為 0
- 使用 `dashboardMock` 的固定值作為正式 Overview
- 任意修改 FastAPI contract
- 新增沒有實際使用的共用元件
- 重做整個 Dashboard Layout
- 修改前台商品、菜籃、提醒、節氣功能
- 大量刪除既有程式碼卻沒有替代對照
- 將後台權限當成已正式完成
- 在 README 放 Codex 指令或開發 TODO

---

# 11. 驗證

完成後執行：

```bash
cd frontend
npm install
npm run build
git diff --check
```

人工驗證：

```text
/dashboard
/dashboard/overview
/dashboard/prices
/dashboard/predictions
/dashboard/mutual-aid
/
/search
/product/高麗菜
/basket
/alerts
/season
```

資料狀態至少驗證：

1. 所有正式 API 正常
2. `/api/market-intel` 失敗
3. `/api/predictions/direction` 空陣列
4. `/api/products` 失敗
5. 互助網空資料
6. 多來源同時部分失敗
7. 重新整理中仍保留舊資料

---

# 12. 文件更新

完成後更新：

```text
docs/uiux/SMARTBUY_UIUX_TASKS.md
```

只勾選實際完成項目。

若沒有完成桌機表格／卡片切換、Filter Drawer、分頁或排序，不得提前標示完成。

如實際架構有重大改變，再更新：

```text
AGENT.md
```

README 只保留系統功能與高階技術架構摘要。

---

# 13. PR 回報格式

PR 說明必須包含：

## 本次完成

- Dashboard Overview
- 真實 API 整合
- 共用 Dashboard 元件
- 三尺寸 RWD

## 正式資料來源

逐項列出使用的 API 與計算方式。

## 尚未接入資料

列出會員、收藏、任務、系統錯誤等尚無正式管理 API 的項目。

## Partial Error

說明單一 API 失敗時畫面如何處理。

## 共用元件

列出每個元件的實際使用位置。

## 驗證結果

- Build
- diff check
- 路由
- 360／390／768／834／1200／1440
- Loading／Empty／Error／Partial Error

## 程式碼刪除說明

如刪除 `dashboardMock.js` 或舊 Demo 控制，說明替代位置與驗證結果。

## 已知限制

不可把尚無 API 的功能描述成已完成。

## 下一階段

建議：

```text
PR-5｜後台角色權限與行情管理模組
```

---

請直接開發，不要只回傳分析或重新建立規格書。

完成後建立 Pull Request，不要自行合併到 `main`，並將 PR 連結交回驗收。
