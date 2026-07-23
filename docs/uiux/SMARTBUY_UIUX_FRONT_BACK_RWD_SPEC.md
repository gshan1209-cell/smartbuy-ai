# SmartBuy AI｜前台／後台 UI/UX 與三尺寸 RWD 開發規格書

> 文件版本：v1.1  
> 建立日期：2026-07-23  
> 角色定案：2026-07-23  
> 適用專案：`gshan1209-cell/smartbuy-ai`  
> 開發方式：保留既有 React + Vite + FastAPI 架構，分階段重構 UI，不重寫既有 API。

---

## 1. 專案目標

SmartBuy AI 由單一使用者網站，升級為「消費者前台 + 專業後台」雙介面平台。

### 1.1 前台定位

前台以買菜消費者為初期客群，畫面必須簡單、白話、手機優先。使用者不需要理解批發市場、機器學習或波動率，也能快速回答：

1. 今天什麼菜便宜？
2. 現在適不適合買？
3. 哪些品項可能漲價？
4. 收藏的菜有沒有降價？
5. 天氣與節氣會不會影響價格？

### 1.2 後台定位

後台採儀表板設計，服務系統管理員，並提供農民及商家依權限使用專業模組。後台主要負責資料監控、內容管理、會員管理、AI 預測監控與營運決策。

### 1.3 客群發展路徑

| 階段 | 主要客群 | 核心價值 |
|---|---|---|
| 初期 | 買菜消費者 | 白話菜價、採買建議、收藏與提醒 |
| 中期 | 農民 | 行情、天氣風險、供應與滯銷互助 |
| 後期 | 商家 | 採購、庫存、促銷、供需與會員洞察 |

---

## 2. 現有系統基線

### 2.1 前端

- React 19
- Vite
- React Router v6
- Tailwind CSS 3
- Chart.js
- Lucide React
- 既有頁面：首頁、售價動態、商品詳細、菜籃、農產新知、互助網、設定、登入、註冊
- 目前所有頁面共用單一 `Navbar`
- 目前存在 `index.css` 與 `styles/theme.css` 兩套設計 token
- 部分元件大量使用 inline style，RWD 與主題一致性不足

### 2.2 後端

- FastAPI
- SQLAlchemy
- PostgreSQL / Supabase
- JWT + httpOnly Cookie
- 既有 Router：auth、market、product、prediction、misc、favorites、mutual-aid、notifications
- 現有 API 原則上保留，UI 改版不得任意變更 API contract

### 2.3 既有資料與 AI

- Supabase PostgreSQL：線上查詢及會員互動資料
- Cloudflare R2 Parquet：歷史資料湖
- LightGBM：下一交易日跌／持平／漲方向分類
- GitHub Actions：每日資料與預測流程

---

## 3. 整體資訊架構

```text
SmartBuy AI
├─ 前台 Public App
│  ├─ 消費者首頁
│  ├─ 今日菜價／搜尋
│  ├─ 商品詳情
│  ├─ 我的菜籃
│  ├─ 採買提醒
│  ├─ 節氣與當季推薦
│  ├─ 農產生活資訊
│  ├─ 互助網
│  └─ 會員設定
│
└─ 後台 Dashboard
   ├─ 總覽
   ├─ 行情管理
   ├─ 商品管理
   ├─ AI 預測監控
   ├─ 天氣與節氣
   ├─ 內容管理
   ├─ 互助網管理
   ├─ 會員與角色
   ├─ 通知管理
   ├─ 資料任務監控
   └─ 系統設定
```

---

## 4. 路由規格

### 4.1 前台路由

| 路由 | 頁面 | 說明 |
|---|---|---|
| `/` | Consumer Home | 今天買什麼、快速搜尋、提醒摘要 |
| `/search` | Price Search | 簡化版菜價查詢與篩選 |
| `/product/:name` | Product Detail | 白話採買建議、走勢、影響因素 |
| `/basket` | My Basket | 收藏與採買清單 |
| `/alerts` | Alerts | 降價、天氣、節氣與預測提醒 |
| `/season` | Seasonal Guide | 二十四節氣、當季蔬果與料理建議 |
| `/news` | Agri Lifestyle | 面向消費者的農產生活資訊 |
| `/mutual-aid` | Mutual Aid | 社群互助 |
| `/settings` | Settings | 會員與顯示偏好 |
| `/login` | Login | 登入 |
| `/register` | Register | 註冊 |

### 4.2 後台路由

| 路由 | 模組 |
|---|---|
| `/dashboard`、`/dashboard/overview` | 營運總覽 |
| `/dashboard/prices` | 行情管理 |
| `/dashboard/products` | 商品管理 |
| `/dashboard/predictions` | AI 預測監控 |
| `/dashboard/weather` | 天氣風險 |
| `/dashboard/seasonal` | 節氣規則與推薦 |
| `/dashboard/content` | 文章與內容管理 |
| `/dashboard/mutual-aid` | 互助網管理 |
| `/dashboard/members` | 會員與角色管理 |
| `/dashboard/notifications` | 通知管理 |
| `/dashboard/data-jobs` | 資料更新與排程監控 |
| `/dashboard/settings` | 系統設定 |

---

## 5. Layout 架構

### 5.1 目錄目標

```text
frontend/src/
├─ layouts/
│  ├─ PublicLayout.jsx
│  └─ DashboardLayout.jsx
├─ components/
│  ├─ shared/
│  │  ├─ Button.jsx
│  │  ├─ Card.jsx
│  │  ├─ Input.jsx
│  │  ├─ Badge.jsx
│  │  ├─ Modal.jsx
│  │  ├─ Drawer.jsx
│  │  ├─ EmptyState.jsx
│  │  └─ LoadingState.jsx
│  ├─ public/
│  │  ├─ PublicHeader.jsx
│  │  ├─ MobileBottomNav.jsx
│  │  └─ ConsumerRecommendationCard.jsx
│  └─ dashboard/
│     ├─ DashboardSidebar.jsx
│     ├─ DashboardTopbar.jsx
│     ├─ DashboardDrawer.jsx
│     ├─ MetricCard.jsx
│     ├─ ResponsiveDataTable.jsx
│     └─ DashboardChartCard.jsx
├─ pages/
│  ├─ public/
│  └─ dashboard/
└─ styles/
   ├─ tokens.css
   ├─ globals.css
   ├─ public-layout.css
   └─ dashboard-layout.css
```

### 5.2 PublicLayout

- 桌機／平板：頂部 Header
- 手機：精簡 Header + 固定底部導覽
- 主內容最大寬度 `1200px`
- 消費者頁面禁止直接呈現過度專業指標
- 未登入者仍可搜尋與查看菜價

### 5.3 DashboardLayout

- 桌機：固定 Sidebar + Topbar + Content
- 平板：可縮合圖示 Sidebar
- 手機：Sidebar 改為 Drawer
- 儀表板內容使用 KPI 卡片、圖表、表格及警示區塊
- 前台與後台不可共用同一組導覽列

---

## 6. 三尺寸 RWD 規格

### 6.1 Breakpoint

```css
/* Mobile */
@media (max-width: 767px) {}

/* Tablet */
@media (min-width: 768px) and (max-width: 1199px) {}

/* Desktop */
@media (min-width: 1200px) {}
```

設計稿基準：

- 手機：390 × 844，最低支援 360px
- 平板：834 × 1112
- 桌機：1440 × 900

### 6.2 手機版

- 單欄卡片
- 主要觸控區至少 44 × 44px
- 左右頁面 padding 16px
- 標題不得因過大造成單字斷裂
- 篩選器改 Bottom Sheet / Drawer
- 表格改卡片清單或水平捲動
- 圖表保留核心資訊，避免過多標籤
- 前台底部導覽固定五項：首頁、查菜價、菜籃、提醒、我的

### 6.3 平板版

- 內容 padding 24px
- 一般卡片兩欄
- Dashboard KPI 卡片兩欄
- Dashboard Sidebar 可縮為圖示列
- 表格保留主要欄位，詳細資訊用 Drawer
- 不得只把桌機版等比例縮小

### 6.4 桌機版

- 內容最大寬度 1200～1440px
- 前台卡片 3～4 欄
- Dashboard KPI 3～4 欄
- Sidebar 建議寬度 240px，縮合 72px
- 支援完整表格、圖表並排、進階篩選

---

## 7. 前台 UX 規格

### 7.1 首頁資訊順序

1. 今天買什麼
2. 搜尋蔬果或市場
3. 今日便宜／正常／偏貴品項
4. 收藏品項提醒
5. 天氣與節氣提醒
6. 當季推薦與料理建議
7. 農產新知與互助資訊

### 7.2 白話資訊轉譯

前台顯示：

- 便宜／正常／偏貴
- 適合買／可等等／建議提前買
- 近 7 日簡易走勢
- 一句原因說明
- 資料更新時間

前台預設不顯示：

- 模型名稱
- 完整特徵工程
- 風險係數原始值
- 複雜波動率指標
- 後台資料品質細節

### 7.3 無障礙與新手友善

- 正文至少 16px
- 色彩不得作為唯一狀態辨識方式，需搭配文字或圖示
- 表單須有 label、錯誤訊息與 focus 狀態
- 所有圖示按鈕須有 `aria-label`
- 支援鍵盤操作
- Loading、Empty、Error 三種狀態必須完整

---

## 8. 後台 Dashboard 規格

### 8.1 Overview KPI

- 今日行情資料筆數
- 最後更新時間
- 價格異常品項數
- AI 預測完成率
- 預測資料日期
- 新增會員數
- 收藏熱門品項
- 待處理互助貼文
- 排程失敗／系統警告

### 8.2 儀表板元件

- Metric Card
- Trend Chart
- Status Badge
- Alert List
- Responsive Table
- Filter Bar
- Date Range Picker
- Drawer Detail
- Confirm Dialog
- Toast
- Skeleton Loading

### 8.3 後台資料原則

- 第一階段可使用現有 API + 明確標記的 mock admin data
- 不得把 mock data 偽裝成真實營運資料
- API 尚未存在時建立 adapter 與 TODO，不可任意破壞既有 API
- 所有數據須顯示資料日期或最後更新時間

---

## 9. 角色與權限

### 9.1 正式角色

本系統只有四種正式角色：

```text
consumer
farmer
merchant
admin
```

| 角色值 | 中文名稱 | 說明 |
|---|---|---|
| `consumer` | 消費者 | 使用簡單前台，不可進入 Dashboard |
| `farmer` | 農民 | 可使用農民授權的行情、預測、天氣、節氣與互助功能 |
| `merchant` | 商家 | 可使用商家授權的行情、商品、預測、節氣與採購功能 |
| `admin` | 系統管理員 | 可使用全部後台管理功能 |

`operator`、`staff` 或其他角色名稱不屬於正式角色，不得出現在新 migration、權限矩陣、註冊流程或角色選項。

### 9.2 第一階段實作原則

- 前端建立 `ProtectedRoute`、`RoleGuard` 或 `PermissionGuard`
- 未具後台權限者進入 `/dashboard/*` 應顯示 403 或導向適當頁面
- 未知或舊角色值一律以最低權限處理，不得自動提升為系統管理員
- 若後端尚未提供 role，僅可在 development 使用集中式 feature flag / mock，production 不得啟用
- 禁止在各頁散落硬編碼角色判斷
- 禁止只靠 Sidebar 隱藏作為安全措施

### 9.3 後端需求

- `members.role`
- `/api/auth/me`、登入與註冊回傳 normalized role
- 後端建立角色或 permission dependency
- 管理 API 由後端驗證權限
- 系統管理員操作預留 audit log
- 一般會員不得透過 profile API 修改 role

---

## 10. Design System

### 10.1 色彩方向

- Primary Green：農業、信任、主要 CTA
- Dark Green：標題、導覽、後台 Sidebar
- Warm Beige：背景
- White：卡片
- Amber：提醒
- Red：警告／偏貴／錯誤
- Blue：資訊

### 10.2 Token 統一

- 將 `index.css` 與 `theme.css` 重複 token 整併至 `styles/tokens.css`
- 舊 class 在過渡期可保留 alias，避免一次性大範圍破壞
- 禁止新增大段 inline style
- 可變動數值用 CSS variable 或 component props

### 10.3 元件一致性

- Button：primary、secondary、outline、ghost、danger
- Card：default、interactive、metric、warning
- Badge：success、neutral、warning、danger、info
- Input：default、focus、error、disabled
- Drawer／Modal：統一 overlay、焦點鎖定、ESC 關閉

---

## 11. 非功能需求

### 11.1 效能

- 首頁 LCP 目標小於 2.5 秒（正式環境正常網路條件）
- 圖片採 lazy loading 與適當尺寸
- Dashboard 非首屏模組可 lazy import
- 圖表元件卸載時必須 destroy instance

### 11.2 相容性

- Chrome、Edge、Safari、Firefox 目前主流版本
- iOS Safari 與 Android Chrome
- 360px 寬度不得產生全頁水平捲軸

### 11.3 安全

- 不改變現有 httpOnly Cookie 認證方式
- 後台不能只靠前端隱藏選單作權限控制
- 所有管理 API 最終必須後端驗證角色
- 角色只有 `consumer`、`farmer`、`merchant`、`admin`
- 未知角色不得取得 Dashboard 權限

---

## 12. 驗收條件

### 12.1 全域

- `npm run build` 成功
- 既有公開路由可正常開啟
- 既有搜尋、收藏、登入、互助網與通知功能不得因 Layout 重構失效
- 三種尺寸無主要破版
- 無全頁水平捲軸
- 深色模式不出現不可讀文字

### 12.2 前台

- 手機版可從底部導覽抵達五個主要入口
- 首頁第一屏能在 5 秒內讓使用者理解今天是否適合買菜
- 商品卡必須顯示品名、價格狀態、採買建議及更新時間

### 12.3 後台

- `/dashboard` 使用獨立 DashboardLayout
- 桌機 Sidebar、平板縮合、手機 Drawer 均可操作
- 至少完成 Overview 骨架與響應式 KPI 卡片
- 消費者與未知角色不能直接看到 Dashboard 內容
- 農民與商家只能看到被授權的模組
- 系統管理員可進入完整管理模組

---

## 13. 不在第一階段範圍

- 不重訓 AI 模型
- 不更換 FastAPI
- 不搬遷資料庫
- 不重寫所有 API
- 不一次完成農民與商家全部業務功能
- 不在第一個 PR 進行大規模資料表 migration

---

## 14. 開發策略

1. 先建立 Design System 與 Layout 骨架
2. 再改造消費者首頁與共用導覽
3. 再改造搜尋、商品詳情與菜籃
4. 建立 Dashboard Overview
5. 最後逐步接入後台管理 API 與四角色權限

每個階段應獨立 PR，避免一次性大改造成難以驗收與回滾。
