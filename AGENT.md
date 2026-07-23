# AGENT.md｜SmartBuy AI 開發總規範

> 本檔案是本專案所有 AI Agent、Codex 與開發者的第一入口。  
> 執行任何規格、開發、重構、測試或驗收前，必須先閱讀本檔案。  
> README 保留對外系統功能與高階技術架構介紹；詳細開發資訊集中於本檔案與本檔案指定的技術文件。

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
   └─ 儀表板、表格、圖表與營運管理，提供農民、商家與系統管理員使用
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

### 2.4 禁止隨意刪除程式碼與功能

任何重構、美化、簡化或效能優化，都不得以大量刪除既有程式碼作為預設手段。

強制規則：

- 修改前必須先盤點原檔案的功能、API、狀態處理、互動、路由與資料來源。
- 不得因為畫面看起來複雜，就直接刪除已可使用的功能、API 串接、圖表、篩選、通知或錯誤處理。
- 不得用 Mock、Demo 或靜態資料取代既有正式 API，除非正式 API 不存在或無法使用，且畫面明確標示。
- 刪除程式碼前必須確認有等價或更完整的替代實作。
- 單一檔案若大量刪除，PR 必須逐項說明刪除原因、替代位置與功能驗證結果。
- 若刪除後造成搜尋、排序、收藏、日期、通知、深色模式、RWD 或 API 功能縮水，視為未完成。
- 不確定某段程式用途時，應先搜尋引用、讀取相關 API 與文件，不得直接刪除。
- 過時程式碼的移除應獨立成清理任務或小型 commit，避免混在 UI 改版中難以驗收。
- 驗收時必須比較改版前後的主要功能清單，不能只以 build 成功或畫面可開啟判定完成。

### 2.5 分階段開發

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
admin
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

### 4.2 消費者首頁視覺基準

所有首頁改版、農產探索、臺灣地圖、縣市與月份推薦功能，必須先閱讀：

```text
docs/uiux/PUBLIC_HOME_VISUAL_STYLE_REFERENCE.md
```

參考來源為農業部食農教育資訊整合平臺「臺灣農產地圖」，只吸收資訊架構與互動邏輯，不複製原網站品牌、素材或程式碼。

正式首頁方向：

- 第一屏保留「今天買什麼」、查價、節氣與採買建議
- 第二層增加「在地特色／本月尚青／農產在哪」探索入口
- 臺灣地圖不得阻礙首屏快速查價
- Mobile 必須提供縣市 Chips／下拉選單，地圖不可成為唯一操作方式
- 縣市特色、盛產月份與產地資訊需標示資料來源
- Official API、Static Seed、Demo、Unavailable 必須清楚區分
- 不得直接爬取或複製參考網站 HTML、CSS、圖片與 Logo
- 不得因新增地圖移除搜尋、今日採買、收藏、提醒、新知或互助功能

### 4.3 DashboardLayout

- 桌機：固定 Sidebar + Topbar
- 平板：可縮合 Sidebar
- 手機：Sidebar 改 Drawer
- 主要內容採 KPI、圖表、表格、篩選器與警示清單

### 4.4 Dashboard 視覺基準

所有後台頁面必須閱讀並遵循：

```text
docs/uiux/DASHBOARD_VISUAL_STYLE_REFERENCE.md
```

正式視覺方向：

- 深墨綠固定側欄
- 白色 Topbar
- 淺灰／暖灰內容背景
- 白色 KPI、圖表與表格卡片
- 綠色表示正常與主要操作
- 黃橘色表示注意
- 紅色表示錯誤與高風險
- 藍色表示資訊與中性系統狀態
- Desktop 四欄 KPI、Tablet 兩欄、Mobile 一欄
- 不得照抄參考品牌、Logo、文字或假資料

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

正式角色固定為四種：

```text
consumer
farmer
merchant
admin
```

中文名稱：

| 角色值 | 中文名稱 | 主要介面 |
|---|---|---|
| `consumer` | 消費者 | 前台 |
| `farmer` | 農民 | 前台 + 農民可用後台模組 |
| `merchant` | 商家 | 前台 + 商家可用後台模組 |
| `admin` | 系統管理員 | 全部前台與後台功能 |

強制規則：

- `operator`、`staff` 或其他名稱都不是正式角色，不得新增到新資料、migration、權限矩陣或介面選項。
- 遇到未知或舊角色值時，必須以最低權限處理，不得自動提升成 `admin`。
- 前端統一透過 `ProtectedRoute`、`RoleGuard` 或 `PermissionGuard` 控制路由與功能顯示。
- 禁止在各頁散落硬編碼角色判斷。
- 後台不能只靠隱藏 Sidebar 達成權限控制。
- 正式管理 API 必須由後端驗證角色或權限。
- 消費者不得進入 Dashboard。
- 農民與商家只能使用授權給各自角色的後台模組。
- 系統管理員可管理平台內容、會員、通知、資料任務與系統設定。
- 第一階段若 API 尚未支援角色，只能使用集中管理的 development mock / feature flag，且 production 不得啟用。
