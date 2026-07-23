# Codex 待辦任務｜消費者首頁農產探索升級

> 本任務已建立，但不要混入 PR-6 後台 AI／天氣／節氣開發。  
> 建議在 PR-6 完成後，另開獨立 PR 執行。

Repository：

```text
https://github.com/gshan1209-cell/smartbuy-ai.git
```

建議分支：

```text
feat/public-home-agri-explorer
```

建議 PR 標題：

```text
feat(home): add local seasonal and produce-origin explorer
```

---

## 1. 開始前必讀

1. `AGENT.md`
2. `docs/uiux/PUBLIC_HOME_VISUAL_STYLE_REFERENCE.md`
3. `docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md`
4. `frontend/src/pages/Home.jsx`
5. `frontend/src/pages/Home.css`
6. `frontend/src/lib/consumerHomeAdapter.js`
7. `frontend/src/pages/Season.jsx`
8. `frontend/src/data/seasonalRecommendations.js`
9. `backend/routers/product.py`
10. `backend/routers/market.py`
11. `backend/routers/misc.py`

參考頁面：

```text
https://fae.moa.gov.tw/map/county_agri.php
```

只參考資訊架構與互動方式，不複製原網站 HTML、CSS、圖片、Logo 或程式碼。

---

## 2. 任務目標

保留首頁目前的「今天買什麼」快速決策流程，新增三種農產探索入口：

```text
在地特色
本月尚青
農產在哪
```

首頁不得被改造成政府資料入口或後台數據牆。

---

## 3. 不可破壞的既有功能

- 「今天買什麼」Hero
- 品項搜尋
- 市場選擇
- 目前節氣
- 今日採買建議
- 便宜／正常／偏貴狀態
- 商品詳情入口
- 收藏與提醒
- 農產新知
- 互助網
- Loading／Empty／Error
- Mobile Bottom Navigation
- 深色模式

修改前先盤點 `Home.jsx` 與 `Home.css`，禁止以重寫整頁為由刪除現有功能。

---

## 4. 首頁資訊順序

```text
1. Hero：今天買什麼 + 搜尋 + 節氣
2. 今日採買建議
3. 農產探索 Tabs
4. 在地特色／本月尚青／農產在哪內容
5. 收藏與提醒
6. 農產新知與互助網
7. 資料來源與更新時間
```

地圖不得放在首屏阻礙快速查價。

---

## 5. 建議元件

```text
frontend/src/components/public/
├─ HomeAgricultureExplorer.jsx
├─ AgricultureExplorerTabs.jsx
├─ TaiwanCountyMap.jsx
├─ CountySelector.jsx
├─ LocalSpecialtyCard.jsx
├─ MonthlyProduceCard.jsx
├─ ProduceOriginPanel.jsx
├─ SourceBadge.jsx
└─ HomeSectionHeader.jsx
```

建立資料 Adapter：

```text
frontend/src/lib/homeAgricultureExplorerAdapter.js
```

`Home.jsx` 只負責頁面組合，不得塞入大量資料 normalization、來源判斷與地圖資料。

---

## 6. 第一階段交付

### 6.1 探索 Tabs

建立：

- 在地特色
- 本月尚青
- 農產在哪

要求：

- 正確 Tab semantics
- 鍵盤可切換
- Mobile 可橫向滑動或等寬排列
- 切換不造成整頁跳動

### 6.2 縣市選擇

Desktop：

- 可使用臺灣簡化 SVG 地圖
- 右側顯示縣市內容

Tablet：

- 地圖與內容可上下排列
- 同時提供下拉選單

Mobile：

- 區域切換：北部／中部／南部／東部及外島
- 縣市 Chips 或下拉選單
- 地圖不可成為唯一操作入口

### 6.3 本月尚青

第一版整合：

```text
GET /api/solar-term
GET /api/products
frontend/src/data/seasonalRecommendations.js
```

規則：

- 節氣：Official API
- 行情：Official API
- 推薦與料理：若來自現有檔案，標示 Static Seed
- 行情 API 失敗時顯示 Partial Error
- 不得把 Static Seed 偽裝成即時官方盛產資料

### 6.4 在地特色與農產在哪

若尚未找到可正式串接的縣市農產 API：

- 先建立 UI、資料 contract 與 Unavailable 狀態
- 不填滿假縣市農產
- 不直接爬參考網站資料
- 顯示「正式縣市農產資料尚未接入」

---

## 7. 資料 contract

建議 Adapter 回傳：

```js
{
  currentSolarTerm,
  selectedCounty,
  selectedMonth,
  localSpecialties,
  monthlyProduce,
  produceOrigins,
  marketStatuses,
  sources: {
    solarTerm: { status, type, updatedAt, error },
    prices: { status, type, updatedAt, error },
    countyProduce: { status, type, updatedAt, error }
  }
}
```

允許的來源類型：

```text
Official API
Static Seed
Demo
Unavailable
```

禁止將 API 失敗轉換成空陣列後顯示為正常狀態。

---

## 8. 視覺規格

- 明亮、溫暖、生活化
- 農業綠、米白、淡黃
- 卡片比後台更親切
- 地圖使用柔和色塊
- 選取縣市使用邊框、文字與背景共同辨識
- 不使用後台深色科技風
- 不複製參考網站插圖與裝飾素材

---

## 9. 三尺寸驗收

```text
360 × 800
390 × 844
768 × 1024
834 × 1112
1200 × 800
1440 × 900
```

Mobile：

- Hero 單欄
- 搜尋欄上下排列
- Tabs 可操作
- 不靠地圖也能選縣市
- 卡片單欄
- 無全頁水平捲軸

Tablet：

- Hero 可雙欄
- 品項卡兩欄
- 地圖與資訊可上下或 5:7 排列

Desktop：

- Hero 雙欄
- 地圖與縣市資訊左右排列
- 品項卡 3～4 欄

---

## 10. Accessibility

- 地圖縣市可用 Enter／Space
- 同步提供文字縣市清單
- Tabs 使用 `role="tablist"`、`role="tab"`、`aria-selected`
- 圖片有 alt
- Icon button 有 aria-label
- Focus 可見
- 觸控區至少 44 × 44px
- Reduced Motion 停用非必要動畫

---

## 11. 驗證

```bash
cd frontend
npm install
npm run build
git diff --check
```

人工回歸：

```text
/
/search
/product/高麗菜
/season
/basket
/alerts
/news
/mutual-aid
/settings
```

PR 說明必須列出：

- 保留的舊功能
- 新增探索功能
- Official API
- Static Seed
- Unavailable
- 三尺寸結果
- Accessibility
- Build 結果
- 程式碼刪除與替代位置

完成後建立 Pull Request，不要自行合併 `main`。
