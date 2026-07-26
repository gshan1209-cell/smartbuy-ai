# SmartBuy AI 前端效能與錯誤韌性

## 目標

本文件定義 SmartBuy AI SPA 的頁面分包、載入狀態、部署後舊 chunk 復原、全域錯誤處理與 bundle 預算。此範圍不涉及資料庫 migration、API 資料內容或角色權限變更。

## 路由分包

- `frontend/src/routes/AppRoutes.jsx` 的頁面元件一律使用 `lazyWithRetry` 動態載入。
- Public 與 Dashboard layout、權限守衛及核心路由框架維持同步載入，確保基本導覽與授權判斷能立即執行。
- 圖表、地圖、AI 推薦、優惠券管理等頁面不得重新改成頂層靜態 import。
- 同一頁面被多條路由使用時共用同一個 lazy component，例如互助網與資訊分享。

## 載入與復原

- `App.jsx` 以單一 `Suspense` 包住路由，fallback 使用 `RouteLoadingFallback`。
- Loading UI 必須具備 `role="status"`、可理解文字與 reduced-motion 支援。
- `lazyWithRetry` 僅在可辨識的動態 chunk 載入失敗時重新整理一次。
- retry flag 存於 `sessionStorage`；相同 chunk 第二次失敗時交由 `AppErrorBoundary` 顯示，不得無限 reload。
- Error Boundary 不顯示憑證、Token、API body 或完整 stack trace給使用者。

## 錯誤與未知路由

- `AppErrorBoundary` 位於 `AuthProvider` 外層，能攔截登入初始化、路由與頁面 render 錯誤。
- 使用者可重新載入或回到首頁，錯誤畫面不得暗示資料已成功保存或刪除。
- Public 與 Dashboard 都必須有 `*` catch-all 路由並顯示正式 404 頁面。

## Vendor chunks

`frontend/vite.config.js` 將大型第三方依賴分為：

- `vendor-react`
- `vendor-chart`
- `vendor-map`
- `vendor-supabase`
- `vendor-icons`
- `vendor-ui`
- `vendor`

先判斷地圖與圖表，再判斷 React，避免 `react-leaflet` 被錯分到 React 核心 chunk。

## Build budget

執行：

```bash
cd frontend
npm ci
npm run build:check
```

`frontend/scripts/check-build-budget.mjs` 讀取 Vite manifest 並檢查：

- 初始 JavaScript raw 不超過 500 KiB。
- 初始 JavaScript gzip 不超過 180 KiB。
- 單一 chunk raw 不超過 600 KiB。
- 單一 chunk gzip 不超過 210 KiB。

預算是回歸防線，不得為了讓 CI 通過而直接放寬；若確有合理大型依賴，應先提供 chunk 組成、使用路由與替代方案分析。

## 驗收

- GitHub Actions Backend tests 通過。
- Frontend `npm run build:check` 通過並輸出初始與最大 chunk 數字。
- Vercel Preview 為 READY。
- `/`、`/search`、`/special-offers`、`/points`、`/dashboard/recommendations` 等代表路由能載入對應動態 chunk。
- 未知 Public 與 Dashboard URL 顯示 404，而不是空白頁。
- 模擬 lazy import 失敗時最多自動重載一次，之後顯示 Error Boundary。
