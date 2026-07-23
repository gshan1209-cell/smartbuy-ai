# Codex 任務｜PR-2 消費者首頁與售價查詢 UI/UX 重構

> 適用專案：`gshan1209-cell/smartbuy-ai`  
> 前置條件：PR-1 前台／後台 Layout 與三尺寸 RWD 基礎已完成並合併。  
> 本次範圍：只處理消費者首頁與售價查詢頁，不擴張到商品詳情、菜籃、提醒中心、節氣完整頁或後台業務模組。

---

## 1. 開始前必讀

請依序閱讀：

1. `AGENT.md`
2. `docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md`
3. `docs/uiux/SMARTBUY_UIUX_TASKS.md`
4. 本文件
5. `frontend/src/pages/Home.jsx`
6. `frontend/src/pages/Home.css`
7. `frontend/src/pages/PriceSearch.jsx`
8. `frontend/src/pages/PriceSearch.css`
9. `frontend/src/layouts/PublicLayout.jsx`
10. `frontend/src/styles/tokens.css`
11. `frontend/src/styles/public-layout.css`
12. 目前前端 API hooks、收藏服務與既有共用元件

如文件衝突，以使用者最新指示、`AGENT.md` 與最新 UI/UX 規格為優先。

---

## 2. 分支與 PR

從最新 `main` 建立：

```bash
git checkout main
git pull
git checkout -b feat/consumer-home-price-search
```

PR 標題：

```text
feat(uiux): redesign consumer home and price search experience
```

完成後建立 Pull Request，不要直接合併 `main`。

---

## 3. 產品定位

SmartBuy AI 初期前台主要使用者是一般買菜消費者。

首頁與查價頁必須優先回答：

1. 今天什麼菜比較便宜？
2. 現在適不適合買？
3. 哪些品項可能漲價？
4. 我收藏的品項有沒有值得注意的變化？
5. 天氣或節氣是否可能影響價格？

前台不可要求使用者先理解：

- 批發市場專業術語
- 標準差或 z-score
- 原始風險係數
- 模型特徵工程
- 市場多空偏向
- 完整 AI 模型名稱與細節

這些資訊可保留於「進階資訊」或未來後台，但不可佔據消費者首屏。

---

## 4. 本次任務範圍

### 4.1 必須完成

- `SB-UIUX-P2-001｜消費者首頁`
- `SB-UIUX-P2-002｜售價查詢頁簡化`

### 4.2 本次不處理

- 商品詳情完整改版
- 我的菜籃完整改版
- 提醒中心正式功能
- 節氣完整頁
- 後台 Dashboard 業務 API
- 後端 RBAC
- AI 模型與預測流程
- 資料庫 schema
- FastAPI contract

若發現其他頁面問題，只記錄於 PR 的「後續建議」，不要順手擴大範圍。

---

# 5. 消費者首頁重構

## 5.1 首屏目標

首頁首屏改為：

```text
今天買什麼？
快速看看哪些菜便宜、正常或可能漲價。
```

首屏至少包含：

- 清楚主標題
- 一句白話說明
- 品項搜尋框
- 市場／地區選擇入口
- 1～3 張今日採買建議卡
- 主要 CTA：「查今天菜價」
- 次要 CTA 最多一個

手機 390px 首屏不捲動或只需極少捲動，就能看到至少一項今日採買建議。

## 5.2 首頁資訊順序

建議順序：

1. 今天買什麼
2. 快速搜尋
3. 今日便宜／正常／偏貴摘要
4. 一句採買建議
5. 我的收藏提醒摘要
6. 天氣／節氣提醒
7. 農產新知入口
8. 互助網入口
9. 會員 CTA

農產新知與互助網保留，但不可高於查價與採買建議。

## 5.3 今日採買卡

每張卡至少顯示：

- 品項名稱
- 今日價格或可用的價格摘要
- 狀態：便宜／正常／偏貴／資料不足
- 白話建議：適合買／可等等／可提前買／資料不足
- 資料日期或最後更新時間
- 點擊後前往 `/product/:name` 或 `/search?q=...`

顏色不可是唯一辨識方式，必須同時使用文字與圖示。

## 5.4 資料來源

優先沿用現有 API 與資料結構。

目前首頁已使用：

```text
GET /api/markets
```

首頁需要的推薦資料若現有 API 可取得，請透過集中 adapter 整理，不要在 JSX 散落資料轉換。

若現階段無法取得完整「今日建議」資料：

- 建立集中式 `consumerHomeAdapter` 或同等用途模組
- 可使用明確標示的 Demo fallback
- Demo 不可偽裝成即時正式數據
- 顯示 `Demo`、`示範資料` 或 `資料尚未接入`
- 不得修改後端 contract 來配合畫面

## 5.5 首頁文案修正

移除或降低以下舊定位：

- 「提供農民、農業從業者與研究人員」
- 「市場洞察」作為首屏核心訴求
- 「多空偏向」等投資式語言

改用一般消費者能理解的文字，例如：

- 今天哪些菜比較划算
- 最近價格正在下降
- 可能受天氣影響，可提前留意
- 比近一週平均便宜
- 資料不足，建議再觀察

不要宣稱 AI 能保證省錢或保證預測正確。

## 5.6 首頁視覺規則

- 使用既有 Design Token
- 不新增第三套色彩系統
- 不大量使用 inline style
- 可延續綠色、米白、暖色農業科技風格
- 不使用過度複雜動畫
- 不使用大面積專業儀表板視覺
- 首屏 CTA 不超過兩個
- 正文原則上至少 16px
- 觸控區至少 44 × 44px

---

# 6. 售價查詢頁重構

## 6.1 消費者模式優先

`/search` 預設畫面應以消費者容易理解的結果為主。

預設首層顯示：

- 搜尋欄
- 市場篩選
- 基本排序
- 狀態篩選
- 商品結果卡片或簡潔列表
- 品名
- 今日價格
- 便宜／正常／偏貴
- 一句採買建議
- 資料更新時間
- 收藏按鈕

以下內容移到「進階資訊」摺疊區，或降低視覺權重：

- 全台市場風險指數
- 多空偏向
- z-score
- 異常波動率
- 複雜漲跌榜
- 完整市場情報圖表

不得直接刪除仍有價值的現有功能，應採漸進式移動與收合。

## 6.2 手機版篩選器

Mobile 0～767px：

- 搜尋欄固定在主要內容上方
- 篩選條件改為 Drawer 或 Bottom Sheet
- 不在首屏橫向塞入全部控制項
- 顯示目前套用的篩選條件數量
- 提供「套用」與「清除」
- 開啟時支援 overlay、Escape、body scroll lock
- 所有控制項在 360px 不超出視窗

優先沿用 PR-1 已建立的 shared `Drawer`。

## 6.3 平板版

Tablet 768～1199px：

- 不能直接縮小桌機表格
- 結果區採兩欄卡片或清楚的緊湊列表
- 篩選工具列可換行
- 市場選擇器不得使用固定 320px／520px 導致超出
- 834px 不得產生水平捲軸

## 6.4 桌機版

Desktop 1200px 以上：

- 可保留高效率雙欄布局
- 篩選區與結果區層級清楚
- 專業市場情報預設收合
- 商品列表可使用表格或較密集卡片
- 不影響原有搜尋、排序與收藏效率

## 6.5 商品結果卡

每筆至少包含：

- 品項名稱
- 市場名稱
- 今日價格與單位
- 狀態文字
- 採買建議
- 更新日期
- 收藏／取消收藏
- 查看詳情

資料不足時：

- 顯示「資料不足」
- 不自行推算假價格
- 不顯示誤導性的漲跌箭頭

## 6.6 MarketSelector 修正

目前 MarketSelector 使用固定或較大的最小寬度。

請改為：

- 手機寬度 `min(100%, available width)`
- 下拉內容不超過 viewport
- 長市場名稱可換行或省略
- 支援鍵盤與 focus 狀態
- 點擊外部可關閉
- 不遮住手機底部導覽

## 6.7 Chart.js 安全規則

保留現有 Chart.js 功能時：

- 元件 unmount 必須 destroy instance
- 資料更新前先 destroy 舊 instance
- 不重複建立 canvas instance
- 收合進階資訊後，不得造成 hidden canvas 尺寸錯誤
- Build 不得出現 runtime chart error

---

# 7. 建議元件拆分

可依實際程式調整，但建議建立：

```text
frontend/src/components/public/
├─ ConsumerHero.jsx
├─ ConsumerSearchBar.jsx
├─ TodayRecommendationCard.jsx
├─ PriceStatusBadge.jsx
├─ PurchaseAdvice.jsx
├─ ConsumerReminderSummary.jsx
├─ WeatherSeasonNotice.jsx
├─ PriceSearchToolbar.jsx
├─ MobileFilterDrawer.jsx
├─ ProductPriceCard.jsx
└─ AdvancedMarketIntel.jsx
```

資料整理建議集中於：

```text
frontend/src/lib/consumerAdvice.js
frontend/src/lib/consumerHomeAdapter.js
frontend/src/lib/priceSearchAdapter.js
```

不要為了符合建議結構而過度拆分小元件；重點是資料轉換、視覺元件與 API 呼叫責任清楚。

---

# 8. 白話採買建議規則

請建立集中式規則，不要在多個 JSX 重複硬編碼。

最低規則：

```text
便宜     → 適合買
正常     → 價格平穩，可依需求購買
偏貴     → 可以等等，或比較其他品項
資料不足 → 暫時無法判斷，建議稍後再看
```

若已有下一交易日方向：

```text
可能上漲 + 目前正常／便宜 → 可考慮提前購買
可能下跌 + 目前偏貴       → 可再觀察
```

規則必須：

- 可測試
- 可重用
- 不保證結果
- 資料不足時不過度推論
- 顯示資料日期

---

# 9. 狀態處理

首頁與查價頁都必須處理：

- Loading
- Empty
- Error
- Partial data
- Demo fallback

要求：

- API 失敗不可整頁白屏
- 單一區塊失敗不影響其他區塊
- 提供重試或前往查價的替代操作
- Empty state 要有下一步引導
- Error message 不顯示敏感資訊

---

# 10. 無障礙與操作體驗

- 搜尋輸入要有 label 或可存取名稱
- 圖示按鈕要有 `aria-label`
- 狀態不可只依靠顏色
- Drawer 開關可使用鍵盤
- focus 樣式清楚
- 商品卡可用鍵盤進入詳情
- 表單錯誤與篩選條件需可被讀屏理解
- 不得因固定底部導覽遮住最後一筆內容

---

# 11. 三尺寸驗收

必須實際驗證：

```text
360 × 800
390 × 844
768 × 1024
834 × 1112
1200 × 800
1440 × 900
```

## Mobile

- 首屏看到至少一項採買建議
- 搜尋與篩選不超出畫面
- Filter Drawer 可正常操作
- 商品卡單欄
- 底部導覽不遮內容

## Tablet

- 首頁資訊為適合平板的兩欄或混合版型
- 查價結果兩欄或緊湊列表
- 篩選器可換行
- 不產生水平捲軸

## Desktop

- 首頁內容最大寬度與 full-bleed 區塊合理
- 查價效率不低於現有版本
- 進階市場情報可收合
- 大量結果仍容易掃讀

---

# 12. 不可破壞的既有功能

- `/search?q=...&market=...` 查詢參數
- 商品搜尋
- 市場篩選
- 排序
- 價格範圍
- 收藏與取消收藏
- 登入狀態
- 商品詳情導覽
- Chart.js 清理
- 深色模式
- PublicLayout 與 Mobile Bottom Nav
- 現有 API contract

---

# 13. 禁止事項

本次禁止：

- 修改 FastAPI contract
- 修改資料庫 schema
- 修改 LightGBM 模型
- 修改 GitHub Actions 預測流程
- 刪除現有查價功能
- 把專業資訊直接刪掉而沒有替代入口
- 使用未標示的假即時數據
- 大量 inline style 建立新頁面
- 新增未使用套件
- 把 PR-3 以後功能混入本 PR
- 把開發任務寫進 README

---

# 14. 驗證指令

```bash
cd frontend
npm install
npm run build
```

若已有測試，執行既有測試。

建議為白話建議規則新增單元測試；若專案目前沒有測試框架，不要為此任務引入大型新框架，可先以純函式與簡單測試方式處理。

---

# 15. PR 必須提供

## 本次完成

- 首頁資訊架構
- 首頁消費者文案
- 今日採買建議
- 查價頁簡化
- Mobile Filter Drawer
- 進階市場情報收合
- 三尺寸 RWD

## 驗證結果

- `npm run build`
- 搜尋／排序／收藏測試
- Query string 測試
- Chart.js cleanup 測試
- 深色模式
- 六個指定尺寸

## 截圖

至少提供：

- 首頁 390px
- 首頁 834px
- 首頁 1440px
- 查價頁 390px
- 查價頁 834px
- 查價頁 1440px
- 手機篩選 Drawer
- 進階資訊展開畫面

## 已知限制

明確列出：

- 哪些資料仍為 Demo
- 哪些 API 尚未提供
- 哪些內容留到 PR-3

## 下一步

```text
PR-3｜商品詳情、菜籃、提醒中心與節氣頁
```

---

# 16. 完成條件

以下全部完成才可標示完成：

- 首頁主要對象已改為買菜消費者
- 390px 首屏可看到今日採買建議
- 首頁主要 CTA 不超過兩個
- 查價頁專業資訊已降低首層權重
- 手機篩選器使用 Drawer／Bottom Sheet
- 360px 無水平捲軸
- 搜尋、排序、收藏仍可用
- Chart.js 正常清理
- 深色模式可讀
- Loading／Empty／Error 已處理
- Build 成功
- 任務文件狀態已更新
- PR 描述與截圖完整
