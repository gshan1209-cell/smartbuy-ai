---
name: smartbuy-dev-login
description: 適用於 SmartBuy AI 開發環境提供預設展示帳號、免密碼進入後台、登入流程驗證或管理員畫面展示；不適用於建立正式會員、修改正式認證、繞過後端權限或部署環境。
---

# SmartBuy AI 開發預設登入

## 目的

讓本機開發與驗收可以快速進入後台，同時保留正式環境的登入、Cookie、JWT 與後端 RBAC。開發預設帳號只能是前端開發旗標下的展示 session，不得被當成正式會員資料。

## 實作流程

1. 先盤點 `AuthContext`、登入頁、`ProtectedRoute`、後台存取 API 與角色設定，確認正式登入鏈路不被替換。
2. 將開發旗標集中放在 `frontend/src/config/development.js`，使用 `import.meta.env.DEV`；不要用可被正式環境誤啟用的通用環境變數。
3. 將展示使用者資料集中定義，至少包含穩定的 `id`、email、名稱與正式角色（`consumer`、`farmer`、`merchant`、`admin` 之一）。
4. 登入頁只在開發旗標成立時顯示預設帳號入口；正式建置不得渲染該入口，也不得把固定密碼或 Token 寫入程式碼。
5. 開發 session 可用既有前端 auth state 儲存，但 `ProtectedRoute` 仍須要求已登入；不可把未登入使用者全面放行。
6. 正式環境維持後端登入與 `/api/admin/access` 權限驗證。開發 bypass 不得修改後端 router、資料庫會員、JWT 或正式 RBAC 規則。
7. 一般帳密登入成功後，依任務需求導向後台入口；若任務指定其他頁面，必須保留並驗證該導向契約。

## 驗收條件

- 開發伺服器的 `/login` 可看見預設帳號入口，操作後能進入 `/dashboard`。
- 預設帳號只建立本機開發 session，不呼叫正式會員登入 API、不新增資料庫帳號。
- 未登入直接進入 `/dashboard` 仍會被導回 `/login`。
- 非開發建置不包含預設帳號 UI、固定展示身份或角色 bypass。
- 正常帳密登入、登出與正式後端角色檢核程式碼仍存在且未被停用。
- 必須執行 frontend build、登入／後台路由 smoke check、`git diff --check`，並在交付中揭露這是開發展示帳號而非正式帳號。

## 禁止事項

- 不得把 `admin@smartbuy.local` 或其他固定帳號寫入正式 seed、migration、後端白名單或生產環境設定。
- 不得在 production 以 `localStorage` 或前端角色欄位取代後端授權。
- 不得用開發 bypass 掩蓋真正的認證錯誤；正式環境的錯誤、未授權與依賴不可用狀態仍須可被驗證。
