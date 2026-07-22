---
name: project-mutualaid
description: 互助網的非顯而易見決策：圖片 base64 原因、cookie auth 限制、401 橫幅慣例、表不在 migration
metadata:
  type: project
---

# 互助網（MutualAid.jsx）— 記憶重點

詳細架構見 `docs/architecture/frontend_mutualaid.md`。

## 圖片為何用 base64 存進資料庫

**Why:** 原本要用 Cloudflare R2，但 `backend/.env` 沒配 R2 credentials 而 503；改用 Supabase Storage 需另申請 `service_role` key；最後選最省事的做法：圖片 Pillow 轉 webp 後 base64 存進 `mutual_aid_posts.images`（`text[]`），不依賴任何外部物件儲存或新憑證。
**How to apply:** 貼文量小可接受（base64 膨脹約 33%，無 CDN 快取）；量大時應重新考慮物件儲存。

## Cookie auth — 不能用 useApi.js

互助網所有請求走 `mutualAidApi.js`，帶 `credentials: 'include'`。`hooks/useApi.js` 的 get/post 不帶 cookie，不可用於互助網 API。

## 401 處理慣例

任何寫入操作遇 401 → 頂部橫幅「請先登入」，**不** `navigate('/login')`。
**Why:** 其他頁面（Navbar、Settings）遇 401 是跳轉，互助網刻意改為橫幅，避免中斷操作流程。

## mutual_aid_* 表不在 migration 檔裡

`mutual_aid_posts` / `mutual_aid_comments` / `mutual_aid_likes` / `mutual_aid_saved` 由協作者另外建立，本 repo 無 migration 紀錄。本機若互助網 API 全 500，先確認這幾張表是否存在於 Supabase。
