# 互助網架構（MutualAid.jsx）

路徑：`frontend/src/pages/MutualAid.jsx` + `MutualAid.css`（路由 `/mutual-aid`）

## 頁面結構

2026-07-20 移除「回報菜價」tab 後，頁面只剩 `DiscussionBoard` 元件。

`DiscussionBoard` 包含：
- 發文觸發卡（登入/未登入皆可見）
- 搜尋框（300ms debounce）
- 「★ 只看收藏」「🙋 只看我的」切換（互斥，`viewFilter` state：`'all' | 'saved' | 'mine'`，再按一次回 `'all'`）
- 貼文類型 pills（全部／滯銷急售／求助／資訊分享）+ 城市 select（台灣 22 縣市）
- 貼文卡片列表（type badge、狀態 chip、日期、收藏☆★、按讚♡♥ + like_count、首張圖片縮圖）
- 本人貼文額外顯示：狀態切換 select、編輯（含圖片增刪）、刪除（二次確認）
- 「載入更多」分頁按鈕（`viewFilter==='saved'` 時停用；用回傳筆數 < limit 判斷 hasMore）
- `ComposeModal`：type + 城市 + 地址/農場名稱（選填）+ 內容 + 最多 3 張圖片
- `PostDetailModal`：另外 `fetchPost(id)` 拿完整留言；留言新增/刪除本地增刪不整頁重抓
- `ImageLightbox`：全頁遮罩，多張圖左右箭頭切換，點遮罩或 ✕ 關閉

## API 串接

**前端封裝**：`frontend/src/lib/mutualAidApi.js`（唯一入口）

匯出：`fetchPosts` / `fetchPost` / `createPost` / `updatePost` / `deletePost` / `updatePostStatus` / `addComment` / `deleteComment` / `toggleLike` / `toggleSave` / `fetchSavedPosts` / `uploadImage`

所有請求帶 `credentials: 'include'`；非 2xx 一律 throw Error 並附 `err.status`。

**後端**：
- Router：`backend/routers/mutual_aid.py`（prefix `/api/mutual-aid`）
- Repository：`src/data/mutual_aid_repository.py`
- 資料表：`mutual_aid_posts` / `mutual_aid_comments` / `mutual_aid_likes` / `mutual_aid_saved`

讀取端點用 `_get_current_member_id_optional`（未登入時 `is_liked`/`is_saved` 回傳 null）；寫入端點用 `_get_current_member_id`（必須登入，401 若無/過期 cookie）。

## 與 mock 版的欄位差異

| mock 版 | 實際後端 |
|---------|---------|
| `post.author` | `post.author_name` |
| `post.location`（單一字串） | `location_city` + `location_addr` 組合顯示 |
| `post.date` | `post.created_at`（ISO 字串，前端取前 10 碼） |
| 字串比對 author === myName | `post.member_id === user?.id` |
| `{items, total}` 包裝 | 裸陣列，無 total，無 comments_count |

`toggle_like` 回 `{liked, like_count}`；`toggle_save` 只回 `{saved}`（不對稱）。

## 圖片儲存

圖片不落地任何檔案系統：Pillow 轉 webp → base64 編碼回傳 → 前端存入 `mutual_aid_posts.images`（`text[]`）。`<img src>` 直接吃 data URL，不需要任何 GET 圖片 API 或外部服務。

## 收藏機制

走後端 `mutual_aid_saved` 表（`toggleSave` / `fetchSavedPosts`），與 MyBasket 的 `favoritesService.js`（`user_favorites` 表）是完全獨立的兩套系統，互不共用。

## 401 處理

任何寫入操作（按讚/收藏/發文/留言/狀態切換/編輯/刪除）遇 401 → 頂部橫幅「請先登入才能使用這個功能。前往登入」（`<Link to="/login">`），不跳轉。按讚/收藏為樂觀更新，失敗 revert。
