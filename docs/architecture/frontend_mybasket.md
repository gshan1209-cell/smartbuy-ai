# 我的收藏架構（MyBasket.jsx）

路徑：`frontend/src/pages/MyBasket.jsx` + `MyBasket.css`（路由 `/basket`）

## 頁面結構（2026-07-17 重構後為純收藏頁）

1. **⭐ 收藏品項區**（`SavedProductsList`）
   - 資料：品項名稱字串陣列（來自 PriceSearch 的星號收藏）
   - 卡片：品項 badge、× 取消收藏、「查看品項詳情 ↗」→ `/product/:name`、展開/收合

2. **📰 收藏文章區**（`SavedNewsList`）
   - 資料：完整 article 物件 `{id, title, summary, source, url, date}`（來自 AgriNews）
   - 卡片：來源 badge、× 取消收藏、內文 line-clamp 3 行可展開、「閱讀原文 ↗」外連

兩區皆有空狀態提示，分別導向 `/search`、`/news`。

## 收藏同步機制（favoritesService.js）

`frontend/src/lib/favoritesService.js` 為元件層唯一入口：

- `fetchFavorites(type)` / `addFavorite(type, refId, meta)` / `removeFavorite(type, refId)`
- type：`'news' | 'product'`
- 登入判斷：module 層 cache `GET /api/auth/me`（200=登入），每次頁面載入只探測一次

| 狀態 | 行為 |
|------|------|
| 登入 | 打 `/api/favorites`，帶 `credentials: 'include'` |
| 未登入 | fallback localStorage（`smartbuy_saved_news` / `smartbuy_saved_products`） |

## 後端 API

- Router：`backend/routers/favorites.py`
- 端點：`GET /api/favorites?type=`、`POST /api/favorites`、`DELETE /api/favorites/{type}/{ref_id}`
- Repository：`src/data/favorites_repository.py`（SQLAlchemy Core + text()）
- 資料表：`user_favorites`（`UNIQUE(member_id, type, ref_id)`，重複 `ON CONFLICT DO NOTHING`）
- 無 RLS：權限由 FastAPI 的 `WHERE member_id = 登入者` 保證

## 收藏來源頁

| 頁面 | 收藏觸發 | ref_id | meta |
|------|---------|--------|------|
| `AgriNews.jsx` | ☆/★ 按鈕 | 文章 id | `{title, summary, source, url, date}` |
| `PriceSearch.jsx` | 列表星號 | 品項名稱 | `{}` |

## 已移除（2026-07-17）

菜籃 chips、清空菜籃、採買建議（`/api/basket/advice`）、PriceCard 比對。`lib/basket.js` 仍存在但本頁不再使用。
