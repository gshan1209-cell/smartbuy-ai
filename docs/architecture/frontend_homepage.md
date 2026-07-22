# 首頁架構（Home.jsx）

路徑：`frontend/src/pages/Home.jsx` + `Home.css`

> 首頁目前為純展示頁，所有資料均為 mock，尚未接 API。

## 頁面結構

1. **Hero 區**
   - 背景：Unsplash 農田照片
   - 標語：「用數據與 AI 解讀農業市場，做出更好的每一步」
   - 按鈕：「探索市場趨勢」→ `/search`、「查看最新摘要」→ `/news`
   - 統計欄：120+ 農產品項、30+ 批發市場、每日更新、AI 預測（均為 hardcode）

2. **核心功能區**（3 欄卡片）
   - 01 售價動態 → `/search`
   - 02 農產新知 → `/news`
   - 03 互助網 → `/mutual-aid`

3. **售價動態**（split 區，圖左文右）
   - `PriceLineChart` SVG 折線圖（高麗菜近 7 日 mock 資料）
   - 搜尋框（submit → `/search?q=...`）、「查看全部行情」連結

4. **農產新知**（split 區，文左圖右）
   - 3 則 mock 文章卡（`MOCK_NEWS`），tag 顯示節氣/市場/農技

5. **互助網**（split 區，圖左文右）
   - `PublishMockup` 發文模擬 UI（阿仁·雲林縣，絲瓜急售）
   - 「加入互助網」→ `/mutual-aid`

6. **頁尾 CTA**
   - 「免費立即加入」→ `/register`、「了解更多功能」→ `/search`

## 元件

| 元件 | 說明 |
|------|------|
| `PriceLineChart` | SVG inline 折線圖，使用 `CHART_DATA`（mock） |
| `PublishMockup` | 互助網發文 UI 示意 |
| `StatusChip` | 價格狀態 chip（便宜/正常/偏貴） |

## Mock 資料

| 名稱 | 內容 |
|------|------|
| `CHART_DATA` | 高麗菜 6/24–6/30 價格（13.8～20.2 元/斤） |
| `MOCK_NEWS` | 3 筆，日期 2026-06-15 ~ 2026-06-28 |
| 互助帖 | 阿仁·雲林縣，絲瓜 300 斤六折出清 |
