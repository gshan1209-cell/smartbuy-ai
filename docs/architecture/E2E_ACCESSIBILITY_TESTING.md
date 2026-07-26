# SmartBuy AI｜瀏覽器 E2E 與無障礙回歸規範

> 本文件定義不依賴正式後端或資料庫的瀏覽器級驗收方式，補足 Node 單元測試無法證明的焦點、鍵盤、路由、響應式與真實 Chromium 行為。

## 1. 測試範圍

Playwright E2E 固定覆蓋：

- 首頁、搜尋、404 與登入導向。
- 後台明確允許、403 拒絕與權限服務 fail-closed。
- 桌機 1440 × 900。
- 平板 1024 × 768。
- 手機 390 × 844。
- 鍵盤送出、初始焦點、可見互動控制項名稱。
- 前台、404 與後台外殼的水平溢出。
- 行動版後台選單可開啟並呈現具名導覽。

## 2. 決定性網路層

一般 E2E 不連接 Render、Supabase、R2、LLM 或正式 API。

`frontend/e2e/helpers.mjs` 會：

- 阻擋外部字型請求，降低網路波動。
- 將未特別指定的 `/api/**` 固定回傳 503。
- 只對 `/api/admin/access` 提供案例需要的 200、401 或 403。
- 以 `yz_auth_user` localStorage 建立可重現的登入狀態。

這樣可以驗證前端是否正確處理 unavailable、allow 與 deny，而不是把外部服務偶發成功當成前端通過。

## 3. 本機執行

Playwright runner 固定使用 `1.61.1`；它不寫入專案 lockfile。

```bash
cd frontend
npm ci
npm install --no-save --no-package-lock @playwright/test@1.61.1
npx playwright install chromium
npm run build
npm run test:e2e
```

測試使用 `vite preview` 啟動 production build，不以 Vite 開發模式作為正式 E2E 證據。

## 4. CI 執行順序

```text
Frontend Node tests + bundle budget
        ↓
Browser E2E job
        ↓
安裝固定 Playwright runner
        ↓
只安裝 Chromium
        ↓
Production build + vite preview
        ↓
Desktop 全套案例
Tablet / Mobile responsive 案例
```

Browser E2E 只有在一般前端測試與 build 通過後才執行。

## 5. 失敗診斷

失敗時 CI 必須保留：

- `playwright-report/`
- `test-results/`
- retain-on-failure trace
- only-on-failure screenshot
- retain-on-failure video
- PR conversation 的精簡文字摘要

Artifacts 保留 7 天。不得只貼一張截圖就宣告原因，也不得在沒有 trace 的情況下把失敗標記為 flaky。

## 6. 無障礙最低門檻

每個受測頁面至少確認：

- 關鍵 heading 可由 role 與 accessible name 找到。
- 所有可見 button、link、input、select、textarea 與 role=button 有可存取名稱。
- Tab 後焦點不留在 body。
- 表單 label 使用 `htmlFor`／`id` 或等效語意關聯。
- 權限錯誤使用 `role=alert`。
- Mobile menu button 有 aria-label，開啟後能找到具名 navigation。
- 390px 寬度不產生水平捲動。

這是最低 smoke gate，不等同完整 WCAG 稽核；色彩對比、縮放與螢幕閱讀器人工驗證仍應在重大 UI 改版時執行。

## 7. 禁止事項

- 不得讓一般 E2E 寫入正式資料庫。
- 不得使用真實會員帳密或 Token。
- 不得將 API 200 全域 mock 成空物件來掩蓋 unavailable 行為。
- 不得用增加 retry 次數掩蓋不穩定測試。
- 不得移除 Mobile／Tablet project 只保留 Desktop。
- 不得將失敗測試永久 skip 後宣告完成。
- 不得把 Vercel Preview 額度或外部 API outage 說成程式測試通過。

## 8. 何時新增案例

下列變更必須同步新增或更新 E2E：

- Public 或 Dashboard 路由。
- Login、AuthProvider、ProtectedRoute、PermissionGuard。
- Header、Sidebar、Drawer、Bottom navigation。
- 404、Error Boundary、Suspense fallback。
- RWD breakpoint、固定寬度、表格與地圖容器。
- aria-label、label、keyboard handler 或焦點管理。
