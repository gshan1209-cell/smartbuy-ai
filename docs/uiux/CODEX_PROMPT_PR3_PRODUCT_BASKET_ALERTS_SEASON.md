# Codex 任務｜PR-3 商品詳情、菜籃、提醒中心與節氣推薦

Repository：

```text
https://github.com/gshan1209-cell/smartbuy-ai.git
```

建議分支：

```text
feat/product-basket-alerts-season
```

建議 PR 標題：

```text
feat(uiux): redesign product detail basket alerts and seasonal experience
```

---

## 1. 開始前必讀

請依序完整閱讀：

1. `AGENT.md`
2. `docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md`
3. `docs/uiux/SMARTBUY_UIUX_TASKS.md`
4. 本文件
5. `frontend/src/pages/ProductDetail.jsx`
6. `frontend/src/pages/MyBasket.jsx`
7. `frontend/src/components/Navbar.jsx` 中的通知功能
8. `frontend/src/lib/favoritesService.js`
9. `backend/routers/product.py`
10. `backend/routers/notifications.py`
11. `backend/routers/misc.py`

本次開始修改前，必須先盤點原有功能與 API。

### 最高優先規則

- 禁止因為 UI 重構而大幅刪除既有程式碼或功能。
- 不得刪除商品詳情既有價格分析、歷史圖表、MA、AI 方向預測、風險說明與免責資訊。
- 不得刪除收藏、通知、節氣或深色模式功能。
- 不得用 Demo／Mock 取代已存在的正式 API。
- 大量刪除前必須先找到等價替代位置，並在 PR 逐項說明。
- build 成功不等於驗收通過，必須比較改版前後功能是否完整。

---

## 2. 任務目標

延續 PR-2 的消費者白話設計，完成四個主要區域：

1. 商品詳情 `/product/:name`
2. 我的菜籃 `/basket`
3. 提醒中心 `/alerts`
4. 節氣與當季推薦 `/season`

本次不得修改：

- FastAPI API contract
- Supabase 資料表
- LightGBM 模型
- 預測資料流程
- Cloudflare R2
- GitHub Actions

只有在修正前端既有 API 使用錯誤時，才能做必要且最小的後端調整。

---

# 3. 商品詳情頁

## 3.1 消費者首層資訊

頁首優先顯示：

- 品項名稱
- 市場名稱
- 今日價格
- 便宜／正常／偏貴
- 白話採買建議
- 收藏／取消收藏主按鈕
- 資料日期
- 返回查價結果

白話建議請沿用：

```text
frontend/src/lib/consumerAdvice.js
```

不得在頁首優先顯示：

- z-score
- MA 特徵名稱
- 模型機率
- 完整技術分析

上述專業資訊必須保留，但移到第二層「進階分析」。

## 3.2 近七日走勢

新增消費者版近七日簡易走勢：

- 預設只顯示最近 7 日
- 顯示日期、價格與漲跌方向
- 圖表必須有文字摘要
- Chart.js instance 必須在更新與卸載時 `destroy()`
- 沒有歷史資料時顯示 EmptyState

既有 30 日圖表、MA7／MA14／MA30 與行情位置不可刪除，移入進階分析即可。

## 3.3 影響因素

建立「為什麼是這個建議」區塊：

- 價格相對近期平均
- 下一交易日 AI 方向
- 天氣風險入口
- 目前節氣入口
- 市場變化摘要

沒有正式資料時不得自行編造原因。

## 3.4 AI 預測

保留既有：

```text
/api/predictions/direction/latest
```

必須保留：

- 漲／跌／持平
- 信心程度
- 資料基準日
- 資料新鮮度
- 風險說明
- 僅供參考免責文字

消費者首層只顯示簡化摘要，完整機率放在進階分析。

## 3.5 收藏

沿用：

```text
favoritesService
```

收藏操作必須：

- optimistic update
- 成功 Toast
- 失敗回復
- 失敗 Toast
- 未登入仍沿用 localStorage fallback

---

# 4. 我的菜籃

## 4.1 定位

頁面主要回答：

```text
我收藏的菜現在適不適合買？
```

不再只顯示品項名稱。

## 4.2 收藏品項卡

針對每個收藏品項，呼叫既有 API 取得資料：

```text
GET /api/products/{name}
```

卡片顯示：

- 品項名稱
- 今日價格
- 價格狀態
- 白話採買建議
- 市場
- 資料日期
- 查看詳情
- 移除收藏

請限制並行請求，避免大量收藏造成瞬間過多 API 呼叫；可使用小型 adapter 或分批載入。

## 4.3 RWD

### Mobile

- 單欄卡片
- 主資訊不需要展開才能看到
- 移除按鈕至少 44 × 44px

### Tablet

- 兩欄卡片

### Desktop

- 可使用高效率表格或三欄卡片
- 若保留文章收藏，需與商品收藏清楚分區

## 4.4 移除收藏

移除收藏必須：

- ConfirmDialog，或
- 立即移除後提供 Undo Toast

操作失敗需恢復資料。

## 4.5 狀態

必須完整處理：

- Loading
- Partial loading
- Empty
- API error
- 單一品項載入失敗

單一品項失敗不可讓整個菜籃白屏。

---

# 5. 提醒中心 `/alerts`

## 5.1 正式通知 API

目前正式 API 只有互助網通知：

```text
GET   /api/notifications
GET   /api/notifications/unread-count
PATCH /api/notifications/{id}/read
PATCH /api/notifications/read-all
```

目前正式通知類型：

```text
mutual_aid_reply
mutual_aid_like
```

不得假裝後端已有價格、天氣或節氣通知。

## 5.2 頁面功能

登入後提供：

- 通知列表
- 未讀數量
- 已讀／未讀樣式
- 單筆標示已讀
- 全部標示已讀
- 進入對應互助貼文
- 分頁或載入更多
- EmptyState
- ErrorState

未登入時：

- 顯示登入說明
- 提供前往登入按鈕
- 不得無限重試 API

## 5.3 分類設計

頁面可預留分類：

- 全部
- 價格
- 天氣
- 節氣
- 互助網

但現階段：

- 「互助網」使用正式 API
- 「價格／天氣／節氣」必須明確標示尚未接入正式通知 API
- 可顯示功能說明或空狀態
- 禁止建立看似真實的通知紀錄

## 5.4 與 Navbar 共用

請建立集中通知 adapter，讓：

- Navbar NotificationBell
- `/alerts`

共用資料格式與標記已讀操作，避免兩套不同邏輯。

不得破壞現有 Navbar 通知下拉選單。

---

# 6. 節氣與當季推薦 `/season`

## 6.1 正式節氣 API

沿用：

```text
GET /api/solar-term
```

頁面至少顯示：

- 現在節氣
- 下一個節氣
- 距離下一節氣天數
- 季節分類
- 白話節氣說明

## 6.2 當季推薦

第一階段可使用集中式 static seed：

```text
frontend/src/data/seasonalRecommendations.js
```

資料結構至少包含：

```text
solarTerm
recommendedProducts
weatherRiskProducts
cookingSuggestions
knowledge
sourceNote
```

規則：

- 必須標示「節氣知識種子資料」或資料來源
- 不得宣稱是即時 AI 預測
- 不得編造即時價格
- 推薦品項可連到 `/search?q=...`
- 天氣風險若未接正式 API，需明確標示為一般季節風險知識

## 6.3 顯示區塊

建議結構：

1. 現在是什麼節氣
2. 適合買什麼
3. 哪些菜容易受天氣影響
4. 節氣料理建議
5. 節氣小知識
6. 查看實際今日菜價

## 6.4 長輩友善

- 正文至少 16px
- 關鍵建議以完整句子呈現
- 不只用顏色判斷
- 避免過多技術詞彙
- 主要按鈕至少 44px

---

# 7. 共用資料與元件

可新增：

```text
frontend/src/lib/productDetailAdapter.js
frontend/src/lib/basketProductAdapter.js
frontend/src/lib/notificationsAdapter.js
frontend/src/data/seasonalRecommendations.js
frontend/src/components/product/
frontend/src/components/basket/
frontend/src/components/alerts/
frontend/src/components/season/
```

優先沿用：

- Card
- Badge
- Button
- Drawer
- EmptyState
- LoadingState
- Toast
- consumerAdvice

禁止新增第三套 Design Token 或大量 inline style。

---

# 8. 三尺寸驗收

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

- 商品價格與採買建議在首屏可見
- 菜籃單欄
- 提醒列表不水平溢出
- 節氣卡片單欄
- 底部導覽不遮住操作

## Tablet

- 不得直接套用桌機或手機版
- 商品詳情可雙欄
- 菜籃兩欄

## Desktop

- 專業資訊可在第二層並排呈現
- 不得讓技術內容搶過採買建議

---

# 9. 不可破壞功能清單

完成後逐項驗證：

- 商品詳情 API
- 商品歷史價格圖表
- MA7／MA14／MA30
- 行情位置
- AI 方向預測
- AI 信心與風險文字
- 收藏與取消收藏
- 未登入 localStorage 收藏
- 菜籃商品與文章收藏
- Navbar 通知
- 互助網通知已讀
- 深色模式
- Query String 返回查價頁
- `/api/solar-term`

任何項目被刪除或失效，PR 不得標示完成。

---

# 10. 驗證指令

```bash
cd frontend
npm install
npm run build
```

若有既有測試，必須執行。

另外執行：

```bash
git diff --check
```

手動驗證路由：

```text
/product/高麗菜
/basket
/alerts
/season
/settings
/search
/mutual-aid
```

---

# 11. 文件更新

完成後更新：

```text
docs/uiux/SMARTBUY_UIUX_TASKS.md
```

只有實際完成並驗證的項目才能勾選。

若架構或規則改變才更新 `AGENT.md`。

README 只保留系統功能與高階技術介紹，不加入本次 Codex 指令。

---

# 12. PR 回報格式

PR 必須包含：

## 本次完成

分別說明：

- 商品詳情
- 菜籃
- 提醒中心
- 節氣推薦

## 既有功能保留對照

逐項列出改版前功能與改版後所在位置。

## 大量刪除說明

若有單一檔案大量刪除，必須說明：

- 刪除原因
- 替代檔案
- 替代元件
- 驗證方式

## 驗證結果

- Build
- Test
- 六尺寸
- 路由
- API

## Demo／Static seed

列出所有尚未接正式 API 的資料，不得模糊描述。

## 已知限制

列出尚未完成內容。

## 下一步

建議下一階段：

```text
PR-4｜Dashboard Overview 與共用 Dashboard 元件
```

---

請直接開始開發，不要只產生分析報告。

完成後建立 Pull Request，不要自行合併到 `main`。
