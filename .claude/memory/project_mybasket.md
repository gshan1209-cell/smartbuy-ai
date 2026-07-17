---
name: project-mybasket
description: MyBasket.jsx 我的收藏頁架構、收藏雲端同步機制（favoritesService + /api/favorites）
metadata:
  node_type: memory
  type: project
---

# 我的菜籃（MyBasket.jsx）架構

**路徑**: `frontend/src/pages/MyBasket.jsx` + `MyBasket.css`（路由 `/basket`，導覽列文字仍為「我的菜籃」）

## 整體結構（2026-07-17 重構後為純收藏頁）

1. **頁首**：標題「⭐ 我的收藏」+ 說明「收藏喜歡的品項與文章，登入後跨裝置同步」
2. **⭐ 收藏品項區**（`SavedProductsList`）
   - 資料為品項名稱字串陣列（來自售價動態頁 PriceSearch 的星號收藏）
   - 卡片：品項 badge、× 取消收藏、「查看品項詳情 ↗」→ `/product/:name`、展開/收合
3. **📰 收藏文章區**（`SavedNewsList`）
   - 資料為完整 article 物件 `{id, title, summary, source, url, date}`（來自農產新知頁 AgriNews）
   - 卡片：來源 badge、× 取消收藏、內文 line-clamp 3 行可展開、「閱讀原文 ↗」外連
4. 兩區皆有空狀態提示，分別導向 `/search`、`/news`

**已移除**（原菜籃功能，2026-07-17）：菜籃 chips、清空菜籃、採買建議（`/api/basket/advice` + PriceCard）、「🧺 與你的菜籃相關」比對。`lib/basket.js` 仍存在但此頁不再使用。

## 收藏雲端同步機制

**核心**: `frontend/src/lib/favoritesService.js` — 元件層唯一入口，封裝登入/未登入分流：

- `fetchFavorites(type)` / `addFavorite(type, refId, meta)` / `removeFavorite(type, refId)`，type 為 `'news' | 'product'`
- 登入判斷：module 層 cache `GET /api/auth/me`（200=登入），每次載入頁面只探測一次
- **登入** → 打 `/api/favorites`（fetch 一律帶 `credentials: 'include'`，因 JWT 在 httpOnly cookie；不可用 `hooks/useApi.js` 的 get/post，那條路不帶 cookie）
- **未登入** → fallback localStorage（`lib/savedNews.js` key `smartbuy_saved_news`、`lib/savedProducts.js` key `smartbuy_saved_products`）
- news id 型別陷阱：localStorage 舊資料 id 是 number、API ref_id 是 string，service 一律正規化為 string，元件比較要 `String()` 化

**後端**:
- `backend/routers/favorites.py` — `GET /api/favorites?type=`、`POST /api/favorites`、`DELETE /api/favorites/{type}/{ref_id}`；auth 用 `Depends(_get_current_member_id)`（import 自 `backend/routers/auth.py`）
- `src/data/favorites_repository.py` — SQLAlchemy Core + text()，寫入 Supabase Postgres `user_favorites` 表（一筆收藏一列，`UNIQUE(member_id, type, ref_id)`，重複收藏 `ON CONFLICT DO NOTHING`）
- 無 RLS：前端不直連 Supabase，權限隔離由 FastAPI 的 `WHERE member_id = 登入者` 保證

**收藏來源頁**:
- AgriNews.jsx：☆/★ 按鈕，meta 存 `{title, summary(=全文), source, url, date}`，ref_id = 文章 id
- PriceSearch.jsx：列表星號，ref_id = 品項名稱，meta = `{}`

**Why:** 收藏原本只存 localStorage 換裝置即消失；auth 是自建 JWT（非 Supabase Auth），故走 FastAPI 代理而非前端直連 Supabase。
**How to apply:** 新增收藏類型時擴充 `type` 的 Literal（後端 favorites.py + service），UI 一律經 favoritesService、樂觀更新不 refetch；勿在元件內直接 import savedNews/savedProducts。相關頁面見 [[project-homepage]]、[[project-settings]]。
