---
name: project-mutualaid
description: MutualAid.jsx 互助網架構、真實後端 API 串接（mutualAidApi.js + backend/routers/mutual_aid.py）
metadata:
  node_type: memory
  type: project
---

# 互助網（MutualAid.jsx）架構

**路徑**: `frontend/src/pages/MutualAid.jsx` + `MutualAid.css`（路由 `/mutual-aid`）

## 整體結構（2026-07-17 串接真實 API 後）

頁面分兩個 tab：

1. **社群討論**（`DiscussionBoard` 元件）— 本檔案主要說明對象
2. **回報菜價**（`ReportPrice` 元件，另一個檔案，不在此範圍）

`DiscussionBoard` 內容：

- 頁首：登入/未登入皆可見的發文觸發卡（`ma-post-trigger`）
- 搜尋框（300ms debounce）+「★ 只看收藏」切換
- 貼文類型 pills（全部／滯銷急售／求助／資訊分享）+ 城市 `<select>`（台灣 22 縣市）
- 貼文卡片列表：type badge、狀態 chip（徵求中／洽談中／已結束）、日期、收藏☆★、按讚♡♥ + like_count、作者/農場/地點、首張圖片縮圖、「💬 留言」開啟 detail modal
- 本人貼文額外顯示：狀態切換 select、編輯、刪除（二次確認）
- 「載入更多」分頁按鈕（無 total，用回傳筆數 < limit 判斷 hasMore）
- `ComposeModal`：type + 城市 select + 地址/農場名稱（選填）+ 內容 + 最多 3 張圖片上傳（縮圖預覽、可刪除）
- `PostDetailModal`：開啟時另外 `fetchPost(id)` 拿完整 `comments[]`（列表 API 不含留言），留言新增/刪除為本地增刪不整頁重抓

## API 串接

**前端封裝**: `frontend/src/lib/mutualAidApi.js` — 唯一入口，所有請求 `credentials: 'include'`（cookie-based JWT，不可用 `hooks/useApi.js` 的 Bearer-token `post`/`put`，那條路不帶 cookie）。非 2xx 一律 throw `Error`，並在 `err.status` 附上 HTTP 狀態碼供呼叫端判斷 401。

匯出：`fetchPosts` / `fetchPost` / `createPost` / `updatePost` / `deletePost` / `updatePostStatus` / `addComment` / `deleteComment` / `toggleLike` / `toggleSave` / `fetchSavedPosts` / `uploadImage`。

**後端**:
- `backend/routers/mutual_aid.py`（prefix `/api/mutual-aid`，已在 `backend/main.py` 註冊）
- `src/data/mutual_aid_repository.py` — SQLAlchemy Core + text()，資料表 `mutual_aid_posts` / `mutual_aid_comments` / `mutual_aid_likes` / `mutual_aid_saved`
- 讀取端點（`GET /posts`、`GET /posts/{id}`）用 `_get_current_member_id_optional`（新增於 `backend/routers/auth.py`）做 optional auth，未登入時 `is_liked`/`is_saved` 回傳 `null` 而非 `false`
- 寫入端點一律用既有的 `_get_current_member_id`（必須登入，401 若無/過期 cookie）
- 圖片上傳 `POST /api/mutual-aid/upload-image` 轉存 Cloudflare R2（Pillow 轉 webp），回傳 R2 公開網址，**沒有本地 static 掛載**，前端直接拿 `url` 當 `<img src>`

### 與原本 mock 版的關鍵欄位差異

- `post.author` → `post.author_name`；`post.location`（單一字串）→ `location_city` + `location_addr` 兩欄組合顯示
- `post.date` → `post.created_at`（ISO 字串，前端 `formatDate()` 取前 10 碼）
- ownership 判斷 → `post.member_id === user?.id`（原本用字串比對 `author === myName`）
- 列表 API 回傳裸陣列，**沒有 `{items, total}` 包裝、也沒有 `comments_count`**（留言只存在 detail 回應）
- `toggle_like` 回 `{liked, like_count}`；`toggle_save` 只回 `{saved}`（不對稱，無 count）

## 收藏機制

改走後端 `mutual_aid_saved` 表（`toggleSave` / `fetchSavedPosts`），**已移除** `frontend/src/lib/savedPosts.js`（原 localStorage 方案，唯一使用者就是本頁），與 [[project-mybasket]] 的 `favoritesService.js`（`user_favorites` 表）是完全獨立的兩套收藏系統，互不共用。

## 401 / 錯誤處理

專案沒有全站登入 modal，既有慣例是 `navigate('/login')`（見 `Navbar.jsx`、`Settings.jsx`）。本頁作法：任何寫入操作（按讚/收藏/發文/留言/狀態切換/編輯/刪除）遇到 401 就顯示頂部橫幅「請先登入才能使用這個功能。前往登入」（`<Link to="/login">`），其餘錯誤顯示於 `rp-msg rp-warn` 樣式的橫幅並可關閉；按讚/收藏皆為樂觀更新，失敗會 revert。

**Why:** 後端已完整實作好互助網 API（含按讚、狀態、圖片上傳），但前端一直停在 mock 資料版本；串接時發現既有草稿假設（`{items,total}`、`comments_count`、本地圖片路徑）與實際後端不符，需照後端實際回應調整前端資料模型。
**How to apply:** 之後修改互助網功能時，欄位命名以後端 `_post_response`/`_comment_response`（`src/data/mutual_aid_repository.py`）為準；新增寫入型 API 呼叫一律經過 `mutualAidApi.js` 並帶 `credentials:'include'`，401 走頂部橫幅而非跳轉/彈窗。本機測試若互助網 API 全部 500，先確認 Postgres 是否已建立 `mutual_aid_*` 系列資料表（此 repo 未附 migration，該表由其他協作者另外建立）。
