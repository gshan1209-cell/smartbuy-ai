# AGENT.md｜SmartBuy AI 開發總規範

> 本檔案是本專案所有 AI Agent、Codex 與開發者的第一入口。  
> 執行任何規格、開發、重構、測試或驗收前，必須先閱讀本檔案。  
> README 僅保留對外的系統功能介紹；所有開發相關資訊集中於本檔案與本檔案指定的技術文件。

---

## 1. 專案定位

**SmartBuy AI｜便宜買 AI** 是一套把農產品行情、天氣、二十四節氣與 AI 價格方向預測，轉換成白話採買建議的平台。

### 客群發展順序

1. **初期：買菜消費者**  
   提供簡單菜價、採買建議、收藏、提醒、節氣與當季推薦。
2. **中期：農民**  
   提供市場行情、產地天氣風險、供應資訊與滯銷互助。
3. **後期：商家**  
   提供採購、庫存、促銷、供需與顧客洞察。

---

## 2. 開發核心原則

### 2.1 雙介面架構

本系統正式採用：

```text
SmartBuy AI
├─ 前台 Public App
│  └─ 簡單、白話、手機優先，主要提供消費者使用
└─ 後台 Dashboard
   └─ 儀表板、表格、圖表與營運管理，提供農民、商家與管理者使用
```

前台與後台必須使用不同 Layout，不可只在同一個 Navbar 上持續增加功能。

### 2.2 三尺寸 RWD

所有新頁面與重大改版都必須驗證：

| 類型 | 範圍 | 設計基準 |
|---|---:|---:|
| Mobile | 0–767px | 390 × 844，最低支援 360px |
| Tablet | 768–1199px | 834 × 1112 |
| Desktop | 1200px 以上 | 1440 × 900 |

不可只把桌機版等比例縮小作為平板或手機版。

### 2.3 保留既有功能

UI/UX 重構不得破壞：

- 登入、註冊與登出
- 售價搜尋
- 商品詳細頁
- 收藏與菜籃
- 互助網貼文、留言、按讚與圖片
- 通知
- 設定與深色模式
- 現有 FastAPI API contract

### 2.4 分階段開發

- 一次只完成一個明確 PR 範圍。
- 禁止在單一 PR 同時重構全站、資料庫與 AI 模型。
- 先建立設計系統與 Layout，再重做頁面，再建立後台業務功能。
- 每個階段都必須可獨立 build、驗收與回滾。

---

## 3. 現有技術架構

### 3.1 前端

- React 19
- Vite
- React Router v6
- Tailwind CSS 3
- Chart.js
- Lucide React
- Supabase JavaScript SDK

主要位置：

```text
frontend/src/
├─ App.jsx
├─ components/
├─ context/
├─ hooks/
├─ lib/
├─ pages/
├─ styles/
├─ index.css
└─ main.jsx
```

目前公開路由：

```text
/
/search
/product/:name
/basket
/news
/mutual-aid
/settings
/login
/register
```

### 3.2 後端

- FastAPI
- SQLAlchemy
- PostgreSQL / Supabase
- JWT + bcrypt + httpOnly Cookie

目前 Router：

```text
auth
market
product
prediction
misc
favorites
mutual_aid
notifications
```

### 3.3 AI 與資料

- LightGBM：下一交易日「跌／持平／漲」分類
- Supabase PostgreSQL：線上查詢、會員、收藏、互助網等即時資料
- Cloudflare R2 Parquet：歷史資料湖與模型訓練資料
- GitHub Actions：每日行情與預測流程

### 3.4 部署

- 前端：Vercel
- 後端：Render
- 資料庫：Supabase PostgreSQL
- 資料湖：Cloudflare R2

---

## 4. 目標前端架構

```text
frontend/src/
├─ layouts/
│  ├─ PublicLayout.jsx
│  └─ DashboardLayout.jsx
├─ components/
│  ├─ shared/
│  ├─ public/
│  └─ dashboard/
├─ pages/
│  ├─ public/
│  └─ dashboard/
└─ styles/
   ├─ tokens.css
   ├─ globals.css
   ├─ public-layout.css
   └─ dashboard-layout.css
```

### 4.1 PublicLayout

- 桌機／平板：頂部 Header
- 手機：精簡 Header + 固定底部導覽
- 手機底部導覽固定五項：首頁、查菜價、菜籃、提醒、我的
- 內容以消費者可理解的白話資訊為主

### 4.2 DashboardLayout

- 桌機：固定 Sidebar + Topbar
- 平板：可縮合 Sidebar
- 手機：Sidebar 改 Drawer
- 主要內容採 KPI、圖表、表格、篩選器與警示清單

---

## 5. 目標路由

### 5.1 前台

```text
/
/search
/product/:name
/basket
/alerts
/season
/news
/mutual-aid
/settings
/login
/register
```

### 5.2 後台

```text
/dashboard
/dashboard/overview
/dashboard/prices
/dashboard/products
/dashboard/predictions
/dashboard/weather
/dashboard/seasonal
/dashboard/content
/dashboard/mutual-aid
/dashboard/members
/dashboard/notifications
/dashboard/data-jobs
/dashboard/settings
```

---

## 6. 角色與權限規劃

預留角色：

```text
consumer
farmer
merchant
operator
admin
```

規則：

- 前端統一透過 `ProtectedRoute` 與 `RoleGuard` 控制路由。
- 禁止在各頁散落硬編碼角色判斷。
- 後台不能只靠隱藏 Sidebar 達成權限控制。
- 正式管理 API 必須由後端驗證角色。
- 第一階段若 API 尚未支援角色，只能使用集中管理的 development mock / feature flag，並清楚標註。

---

## 7. UI/UX 規則

### 7.1 前台

前台應優先回答：

- 今天什麼菜便宜？
- 現在適不適合買？
- 哪些品項可能漲價？
- 收藏的菜有沒有降價？
- 天氣與節氣是否影響價格？

前台預設顯示：

- 便宜／正常／偏貴
- 適合買／可等等／建議提前買
- 近 7 日簡易走勢
- 一句白話原因
- 資料更新時間

前台預設不在首層顯示：

- 模型名稱
- 原始風險係數
- 完整特徵工程
- 複雜波動率指標
- 資料品質監控細節

### 7.2 後台

後台總覽至少預留：

- 今日行情資料筆數
- 最後更新時間
- 價格異常品項數
- AI 預測完成率
- 新增會員
- 收藏熱門品項
- 待處理互助貼文
- 系統錯誤與排程警告

所有數據都必須顯示資料日期或最後更新時間。

### 7.3 共用體驗

- 正文至少 16px。
- 觸控區至少 44 × 44px。
- 顏色不可作為唯一狀態辨識，需搭配文字或圖示。
- 表單需有 label、錯誤訊息與 focus 狀態。
- 圖示按鈕需有 `aria-label`。
- 所有頁面需有 loading、empty、error 狀態。
- 360px 寬度不可產生全頁水平捲軸。

---

## 8. Design System 規則

### 8.1 Token

- 將 `index.css` 與 `styles/theme.css` 的重複 token 整合至 `styles/tokens.css`。
- 過渡期間保留必要的 `--yz-*` alias，避免現有頁面失效。
- 禁止新增第三套互不相容的色彩系統。

### 8.2 元件

新功能優先使用共用元件：

```text
Button
Card
Badge
Input
Drawer
Modal / ConfirmDialog
Toast
EmptyState
LoadingState / Skeleton
ResponsiveDataTable
DashboardChartCard
```

### 8.3 樣式

- 禁止以大量 inline style 建立新頁面或共用元件。
- 可變動數值應使用 class、CSS variable 或 component props。
- 深色模式必須使用 token，不可在元件中硬編碼白色背景。

---

## 9. API 與資料安全規則

- UI 任務不得任意變更現有 API contract。
- API 尚未存在時，使用集中 adapter 或明確 mock。
- Mock 資料必須標示 `Demo`、`Mock` 或 `尚未接入管理 API`。
- 禁止將 mock 營運數據偽裝成正式數據。
- 不得在前端顯示密碼、JWT、資料庫連線字串或敏感環境變數。
- 後端管理功能必須有權限驗證，不可只依賴前端。

---

## 10. 開發文件與任務來源

以下文件是目前 UI/UX 改版的正式依據：

1. `docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md`
2. `docs/uiux/SMARTBUY_UIUX_TASKS.md`
3. `docs/uiux/CODEX_PROMPT_PR1_UIUX_FOUNDATION.md`
4. `docs/SPEC.md`（若存在，以實際系統行為與最新規格為準）
5. `SmartBuy_AI_便宜買AI_MVP完整開發規格書_v1.1_含任務中心與24節氣.md`

衝突處理優先順序：

1. 使用者最新明確指示
2. 本 `AGENT.md`
3. 最新 UI/UX 規格與任務文件
4. `docs/SPEC.md`
5. 舊版根目錄規格書
6. README

README 不是開發規格來源。

---

## 11. 目前開發順序

### PR-1｜UI/UX 基礎工程

依 `docs/uiux/CODEX_PROMPT_PR1_UIUX_FOUNDATION.md` 執行：

- 統一 Design System
- 建立共用 UI 元件
- 建立 PublicLayout
- 建立 DashboardLayout
- 建立三尺寸 RWD
- 重構路由骨架
- 保留既有功能與 API

### PR-2｜消費者首頁與售價查詢

- 首頁改為「今天買什麼」
- 白話採買建議
- 手機優先查價流程
- 手機篩選 Drawer / Bottom Sheet

### PR-3｜商品詳情、菜籃、提醒、節氣

- 商品詳細頁
- 我的菜籃
- `/alerts`
- `/season`

### PR-4｜Dashboard Overview

- KPI 卡片
- 圖表容器
- 響應式表格
- 篩選器
- Demo 狀態標記

### PR-5 之後

- 角色權限
- 行情管理
- AI 預測監控
- 內容管理
- 互助網管理
- 會員管理

---

## 12. Codex 執行規則

Codex 每次任務必須：

1. 先閱讀 `AGENT.md`。
2. 再閱讀指定規格與任務文件。
3. 只執行本次指定 PR 範圍。
4. 開始修改前盤點相關檔案與既有功能。
5. 禁止任意刪除舊功能或改名既有路由。
6. API 不足時建立 adapter / mock，不得任意重寫後端。
7. 所有新頁面驗證 Mobile、Tablet、Desktop。
8. 完成後執行 build 與既有測試。
9. 回報變更、驗收結果、已知限制與下一步。

---

## 13. 開發與驗證指令

### 前端

```bash
cd frontend
npm install
npm run build
```

本機開發：

```bash
cd frontend
npm run start
```

### 後端

請先確認專案現有安裝方式與環境變數，不得在文件中提交 `.env` 或機密值。

常見啟動方式：

```bash
uvicorn backend.main:app --reload
```

### 基本驗收

- 公開路由可正常開啟
- 登入、收藏、互助網、通知功能正常
- 390、834、1440 三尺寸無主要破版
- 360px 無全頁水平捲軸
- 深色模式文字可讀
- `npm run build` 成功

---

## 14. Git 與 PR 規範

### 分支命名

```text
feat/<scope>
fix/<scope>
refactor/<scope>
docs/<scope>
```

### Commit 建議

```text
feat(uiux): ...
fix(rwd): ...
refactor(layout): ...
docs(agent): ...
```

### PR 必須包含

- 目的與範圍
- 變更檔案
- 三尺寸實作方式
- Build / Test 結果
- 截圖或視覺驗收資訊
- 已知限制
- 未完成內容
- 下一個建議任務

---

## 15. Definition of Done

任務只有在以下條件全部滿足時才能標示完成：

- 指定範圍已實作
- 未破壞既有功能
- Mobile／Tablet／Desktop 已驗證
- Loading／Empty／Error 狀態已處理
- Build 成功
- 新增程式符合 Design System
- Mock 資料已清楚標示
- 文件與任務狀態已更新
- PR 說明完整

---

## 16. README 維護規則

README 只保留：

- 系統定位
- 使用者價值
- 主要功能
- 客群發展方向
- 線上體驗入口

README 不放置：

- 開發任務
- Codex 指令
- 分支策略
- 程式碼規範
- RWD 實作細節
- API 與資料庫技術規格
- 開發中的 TODO

所有上述開發資訊統一維護於 `AGENT.md` 與其指定的 `docs/` 文件。