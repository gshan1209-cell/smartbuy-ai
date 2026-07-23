# Codex 執行指令｜PR-1 UI/UX 基礎工程

請在 Repository：`gshan1209-cell/smartbuy-ai` 執行第一階段 UI/UX 改造。

## 必讀文件

1. `docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md`
2. `docs/uiux/SMARTBUY_UIUX_TASKS.md`
3. 現有 `README.md`
4. `frontend/src/App.jsx`
5. `frontend/src/components/Navbar.jsx`
6. `frontend/src/index.css`
7. `frontend/src/styles/theme.css`
8. `frontend/src/pages/Home.jsx`
9. `frontend/src/pages/PriceSearch.jsx`

---

## 本次只執行範圍

完成下列任務：

- `SB-UIUX-P0-001`
- `SB-UIUX-P1-001`
- `SB-UIUX-P1-002`
- `SB-UIUX-P1-003`
- `SB-UIUX-P1-004`
- `SB-UIUX-P1-005`

不要在本 PR 大幅重做首頁與售價查詢內容；本 PR 先完成設計系統、雙 Layout、三尺寸 RWD 與路由骨架。

---

## 開發要求

### A. 建立統一 Design System

建立：

```text
frontend/src/styles/tokens.css
frontend/src/styles/globals.css
```

要求：

- 整併 `index.css` 與 `theme.css` 的共用 token
- 保留現有 `--yz-*` 變數相容性，避免既有頁面立即失效
- 定義 Mobile / Tablet / Desktop 三尺寸
- 定義 spacing、radius、shadow、content width、header height、sidebar width
- 不要新增第三套色彩系統
- 新元件不得大量使用 inline style

### B. 建立共用元件

建立於：

```text
frontend/src/components/shared/
```

至少包含：

- Button
- Card
- Badge
- Input
- Drawer
- EmptyState
- LoadingState

元件要求：

- 支援 `className`
- 保留原生 button/input 常用 props
- Drawer 支援 overlay、ESC、焦點基本處理
- 圖示按鈕使用者必須能提供 aria-label

### C. 建立 PublicLayout

建立：

```text
frontend/src/layouts/PublicLayout.jsx
frontend/src/components/public/PublicHeader.jsx
frontend/src/components/public/MobileBottomNav.jsx
```

要求：

- 將現有 Navbar 的通知、登入狀態與主要導覽能力移入 PublicHeader
- 不得讓既有通知功能失效
- 手機版 Header 精簡
- 手機底部導覽固定：首頁、查菜價、菜籃、提醒、我的
- `/alerts` 尚未完整開發時可建立清楚的 Placeholder Page
- 頁面底部需預留 bottom navigation 高度
- 桌機／平板不顯示 MobileBottomNav

### D. 建立 DashboardLayout

建立：

```text
frontend/src/layouts/DashboardLayout.jsx
frontend/src/components/dashboard/DashboardSidebar.jsx
frontend/src/components/dashboard/DashboardTopbar.jsx
frontend/src/components/dashboard/DashboardDrawer.jsx
frontend/src/pages/dashboard/DashboardOverview.jsx
```

要求：

- 桌機：固定 Sidebar
- 平板：Sidebar 支援縮合圖示模式
- 手機：Sidebar 改成 Drawer
- DashboardOverview 只做骨架，顯示「Demo／尚未接入管理 API」
- 可建立響應式 KPI placeholder，但不得偽裝成正式數據
- 前台與後台使用不同導覽元件

### E. 重構路由

重構 `frontend/src/App.jsx`：

- 前台既有頁面套用 PublicLayout
- `/dashboard/*` 套用 DashboardLayout
- 新增 `/alerts` Placeholder
- 新增 `/season` Placeholder
- 新增 `/dashboard/overview`
- `/dashboard` 導向 `/dashboard/overview`
- 不得刪除或改名既有公開路由

可使用 React Router nested routes 與 `Outlet`。

---

## 三尺寸標準

### Mobile

```text
0–767px，基準 390px，最低驗證 360px
```

### Tablet

```text
768–1199px，基準 834px
```

### Desktop

```text
1200px 以上，基準 1440px
```

必須驗證：

- 無全頁水平捲軸
- Header 不重疊
- Sidebar / Drawer 正常
- Bottom Navigation 不遮住內容
- 通知下拉選單不超出手機視窗

---

## 不可變更事項

- 不重寫 FastAPI
- 不修改既有 API contract
- 不移除登入、收藏、互助網、通知功能
- 不更換 React、Vite 或 React Router
- 不引入大型 UI framework
- 不將所有舊頁面一次重寫
- 不在此 PR 新增資料庫 migration
- 不把 mock KPI 當成真實資料

---

## 驗證指令

至少執行：

```bash
cd frontend
npm install
npm run build
```

若專案已有測試指令，也執行現有測試；不要為了通過而刪除測試。

---

## 完成後回報格式

請回報：

1. 變更摘要
2. 新增／修改檔案清單
3. 路由結構
4. Mobile／Tablet／Desktop 實作方式
5. Build 結果
6. 已知限制
7. 下一個建議任務
8. PR 連結

PR 標題建議：

```text
feat(uiux): establish public and dashboard layouts with 3-size RWD
```

PR 說明必須引用：

- `docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md`
- `docs/uiux/SMARTBUY_UIUX_TASKS.md`
