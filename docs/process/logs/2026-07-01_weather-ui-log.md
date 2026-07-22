# 2026-07-01 開發紀錄：天氣影響分析 + 售價動態 UI 優化

## 1. 任務目標

完成天氣影響分析功能（Step 4 後端 API、Step 5 前端整合），並對售價動態頁進行資訊整合與排版優化，讓產地天氣異常資訊直接貼附在品項上，而非以難以理解的全域橫幅呈現。

## 2. 執行資訊

- 執行者：Claude（與使用者協作）
- 產生時間：2026-07-01
- 交付 commits：`e0c2020`、`ff57591`（皆在 `main`，Render auto-deploy）

## 3. 本次修改內容

### Step 4：後端 API 擴充

**`backend/main.py`**
- `/api/products/{name}`：回傳新增 `weather_impact` 欄位（含各產地縣市雨量、有效雨日、整體影響方向）
- 新增 `/api/weather-summary`：回傳目前各縣市天氣異常摘要（供全站警示使用）
- lifespan 啟動時預算 `product → weather_risk` 對照表（`_build_product_weather_risks()`），注入 `/api/products` 每個品項的 `weather_risk` 欄位，不增加 request 延遲

**`src/weather/weather_impact.py`**（新增）
- `get_weather_impact(product_name)`：分析產地近 14 天天氣，判斷多雨／乾旱／高溫／低溫，回傳 `all_counties`（含所有產地縣市、比重、異常事件）
- `get_weather_summary()`：回傳全台有異常的縣市清單（漲價風險事件），供橫幅或預算使用

**`src/data/weather_loader.py`**（新增）
- 讀取 `data/weather/weather_daily.csv`，加 lru_cache 避免重複 I/O

**`scripts/fetch_weather_history.py`**（新增）
- 從 CWA 氣象局 Open Data API（資料集 `C-B0024-001`，逐時觀測）撈歷史天氣，聚合成日資料寫入 CSV
- 支援 `--days` 參數，每次最多撈 30 天以內避免 API 超限

**`data/mapping/county_station_map.json`**（新增）
- 15 縣市對應局屬氣象站，本次新增台北（466920 臺北）、新北（466881 新北）、桃園（467050 新屋）、新竹（467571 新竹），補足蕹菜、菜豆等北部主產品項的天氣分析覆蓋

**`data/weather/weather_daily.csv`**（新增）
- 465 筆，2026-05-31 ～ 2026-06-30，涵蓋 15 縣市

---

### Step 5：前端整合與 UI 優化

**`frontend/src/pages/PriceSearch.jsx`**

#### 資訊整合
- 拆開兩個 card（「行情分析」collapsible + `WeatherImpactCard`）合併成 **`PriceInsightCard`**：
  - 上半（常駐）：price reason + advice，一眼看到行情說明
  - 下半（有天氣異常才展開）：各縣市雨量條、價格天氣關聯、農民建議
  - 無異常時顯示一行綠色「✓ 近期產地天氣正常」，不靜默消失

#### Metrics cards 重設計
- Card 3「採買建議」→「漲跌幅（30 天）」：改為紅綠數字（+/- %），採買建議降為小字副標；三格均為數字，視覺重量一致

#### 全域天氣橫幅移除
- 原本的「產地天氣警示：南投（多雨）；台中（多雨）…」橫幅對用戶意義不明，改為**品項內嵌**：
  - 每個產地有異常的品項，名稱旁顯示對應小 icon（🌧/🌡/🧊/🏜），hover tooltip 顯示「產地多雨」等
  - 用戶點進該品項才看完整的 `PriceInsightCard` 天氣分析

#### 篩選與排序
- **篩選 chips**（4 個）：全部 / ↓ 便宜 / → 正常 / ↑ 偏貴，點選即時過濾，標題顯示筆數
- **排序下拉**：預設（依狀態）/ 漲幅最高優先 / 跌幅最大優先；篩選和排序可同時使用
- 品項列表右下角新增漲跌幅 % 顯示（紅/綠上色）

#### Sidebar 優化
- 移除無功能的「蔬菜種類」chips（節省約 55px）
- 列表字體統一 13/14px，去掉 active 時 14/16px 的跳動
- 滾輪改為 overlay 風格（4px 細條，hover 時才出現，不佔寬度），避免雙側滾輪衝突

#### Bug fix
- `priceDiff > 10` 字串比較錯誤 → `Number(priceDiff) > 10`

#### 其他細節
- 今日均價卡 hover 加 2px 綠色邊框，明示可點擊
- AI 預測佔位從大 dashed card 縮成一行淺紫色小橫條
- 縣市雨量條：`no_data: true` 顯示「無測站資料」+ 更低透明度（0.35）vs 有資料無異常（0.6）
- 分析期間取值排除 `no_data` 縣市，避免取到空值
- 天氣橫幅 icon 改用 `event_type` 對應 `EVENT_LABELS`（舊版用 string split 很脆弱）
- RWD：≤768px 雙欄改上下堆疊，sidebar 限高 280px，外框 padding 縮小

**`frontend/src/styles/theme.css`**
- `.yz-metric-clickable:hover`：box-shadow 2px 綠色邊框
- `.yz-price-sidebar` overlay 滾輪 CSS（webkit + Firefox）
- `@media (max-width: 768px)` 手機版雙欄排版

---

## 4. 完成標準

- [x] `/api/products/{name}` 回傳 `weather_impact`（含 `all_counties`）
- [x] `/api/weather-summary` 可正常呼叫
- [x] `/api/products` 每個品項有 `weather_risk` 欄位
- [x] `PriceInsightCard` 在有天氣異常時展示雨量條 + 建議
- [x] 篩選 chips + 排序下拉正常運作，可同時使用
- [x] 品項 icon 有天氣資料時正確顯示，無資料時不顯示
- [x] `vite build` 無錯誤（兩個 commit 皆通過）

## 5. 待辦（下次繼續）

1. **部署驗證**：確認 Render 部署後 `weather_impact` 資料有正確顯示（天氣 CSV 已 commit，應正常）
2. **自動更新**：GitHub Actions cron 每日執行 `fetch_weather_history.py`，保持天氣資料最新
3. **補測站**：目前 15 縣市，未涵蓋台東、澎湖（農業產區影響較小，可後補）
4. **蔬菜分類篩選**：目前 chips 已移除，待建立品名→分類對照表後重新實作
5. **30 天走勢圖**：目前仍為 DemoChart 示範圖，待串接歷史價格 API
6. **農產新知、互助網、設定**等頁面尚未完成
