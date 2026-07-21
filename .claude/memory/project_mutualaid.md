---
name: project-mutualaid
description: MutualAid.jsx 互助網架構、真實後端 API 串接（mutualAidApi.js + backend/routers/mutual_aid.py）
metadata:
  node_type: memory
  type: project
---

# 互助網（MutualAid.jsx）架構

**路徑**: `frontend/src/pages/MutualAid.jsx` + `MutualAid.css`（路由 `/mutual-aid`）

## 整體結構（2026-07-20 移除回報菜價 tab 後）

頁面只剩單一內容，無 tab 切換：`DiscussionBoard` 元件。

**Why:** 2026-07-20 使用者要求移除「回報菜價」分頁，前端已刪除 `ReportPrice.jsx`/`.css` 與 tab 切換 UI，後端也一併移除已死掉的 `POST /api/report`（呼叫不存在的 `save_report`）與 `src/data/report_store.py`。`src/data/report_repository.py`（Supabase 版買貴通報，未被任何 router 掛載）當時判斷為獨立/未接線的元件先保留；2026-07-21 確認前後端皆無引用後，整批移除：`src/data/report_repository.py`、`tests/test_report_repository.py`、`scripts/create_price_reports_table.sql`、`data/reports/price_reports.csv`，並清理 README.md / docs/SPEC.md / docs/database_current_state.md / docs/r2_parquet_data_lake.md 中對應描述。原始規格書與 docs/USER_FLOW.md 中的「買貴通報」屬產品願景/待做功能，維持不動。

`DiscussionBoard` 內容：

- 頁首：登入/未登入皆可見的發文觸發卡（`ma-post-trigger`）
- 搜尋框（300ms debounce）+「★ 只看收藏」「🙋 只看我的」兩個獨立切換鈕，共用同一個 `viewFilter` state（`'all' | 'saved' | 'mine'`，互斥、再按一次回到 `'all'`）
- 貼文類型 pills（全部／滯銷急售／求助／資訊分享）+ 城市 `<select>`（台灣 22 縣市）
- 貼文卡片列表：type badge、狀態 chip（徵求中／洽談中／已結束）、日期、收藏☆★、按讚♡♥ + like_count、作者/農場/地點、首張圖片縮圖（點擊開全螢幕 `ImageLightbox`）、「💬 留言」開啟 detail modal
- 本人貼文額外顯示：狀態切換 select、編輯（含圖片增刪，見下）、刪除（二次確認）
- 「載入更多」分頁按鈕（`viewFilter==='saved'` 時停用；無 total，用回傳筆數 < limit 判斷 hasMore）
- `ComposeModal`：type + 城市 select + 地址/農場名稱（選填）+ 內容 + 最多 3 張圖片上傳（縮圖預覽、可刪除）
- 編輯模式（`editForm` 內新增 `images` 陣列）：可在既有圖片基礎上再上傳（`handleEditAddImages`）/刪除（`handleEditRemoveImage`），`saveEdit` 一併把 `images` 存回後端
- `PostDetailModal`：開啟時另外 `fetchPost(id)` 拿完整 `comments[]`（列表 API 不含留言），留言新增/刪除為本地增刪不整頁重抓；圖片縮圖同樣可點擊開 `ImageLightbox`
- `ImageLightbox`：全頁遮罩（`position:fixed`）顯示單張大圖，多張圖時有左右箭頭切換與「N / total」計數，點遮罩或 ✕ 關閉；`DiscussionBoard` 用 `lightbox` state（`{images, index}`）驅動列表卡片點圖，`PostDetailModal` 內用自己的 `lightboxIndex` state 驅動

## API 串接

**前端封裝**: `frontend/src/lib/mutualAidApi.js` — 唯一入口，所有請求 `credentials: 'include'`（cookie-based JWT，不可用 `hooks/useApi.js` 的 Bearer-token `post`/`put`，那條路不帶 cookie）。非 2xx 一律 throw `Error`，並在 `err.status` 附上 HTTP 狀態碼供呼叫端判斷 401。

匯出：`fetchPosts` / `fetchPost` / `createPost` / `updatePost` / `deletePost` / `updatePostStatus` / `addComment` / `deleteComment` / `toggleLike` / `toggleSave` / `fetchSavedPosts` / `uploadImage`。`fetchPosts` 支援 `mine: boolean` 參數（送出 `?mine=true`）。

**後端**:
- `backend/routers/mutual_aid.py`（prefix `/api/mutual-aid`，已在 `backend/main.py` 註冊）
- `src/data/mutual_aid_repository.py` — SQLAlchemy Core + text()，資料表 `mutual_aid_posts` / `mutual_aid_comments` / `mutual_aid_likes` / `mutual_aid_saved`
- `GET /posts` 支援 `mine: bool = Query(False)`：`mine=true` 但未登入時 route 直接丟 401（`_get_current_member_id_optional` 回傳 `None`）；已登入則在 `list_posts()` 的 WHERE 加上 `p.member_id = :member_id`，與 `type`/`city`/`q` 篩選可疊加。前端用「🙋 只看我的」鈕觸發，401 時自動把 `viewFilter` 退回 `'all'` 並顯示登入橫幅（見下方 401 處理）。
- 讀取端點（`GET /posts`、`GET /posts/{id}`）用 `_get_current_member_id_optional`（新增於 `backend/routers/auth.py`）做 optional auth，未登入時 `is_liked`/`is_saved` 回傳 `null` 而非 `false`
- 寫入端點一律用既有的 `_get_current_member_id`（必須登入，401 若無/過期 cookie）
- 圖片上傳 `POST /api/mutual-aid/upload-image`（`upload_post_image()` in `src/data/mutual_aid_repository.py`）**不落地任何檔案系統/物件儲存**：Pillow 轉 webp 後直接 base64 編碼成 `data:image/webp;base64,...` 字串回傳給前端，前端把它當一般字串存進 `form.images`，貼文送出時跟其他文字欄位一起寫進 `mutual_aid_posts.images`（`text[]`）。`<img src>` 直接吃 data URL，不需要任何 GET 圖片的 API、也不需要任何外部服務環境變數。
- **Why**: 2026-07-20 一開始沿用既有程式碼是轉存 Cloudflare R2，但 `backend/.env` 沒配 R2 credentials 而 503；本想改配 Supabase Storage（這個後端的 Postgres 本來就是 Supabase 代管專案），但需要另外申請 `service_role` key，使用者最後選擇最省事的做法：圖片直接以 base64 存進既有的 `mutual_aid_posts.images` 欄位，完全不依賴任何外部物件儲存或新憑證。R2 版本（`src/data/r2_sync.py`）繼續只服務農產品價格 Parquet 同步，兩者無關聯。
- **權衡**: base64 會讓每張圖片在資料庫/回應 payload 中膨脹約 33%，且無 CDN 快取；貼文量很小的情況下可接受，量大時應重新考慮物件儲存方案。

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
