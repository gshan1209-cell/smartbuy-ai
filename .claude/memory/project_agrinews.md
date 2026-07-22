---
name: project-agrinews
description: 農產新知的非顯而易見細節：savedNews.js 已廢棄、meta.summary 存全文、後端快取
metadata:
  type: project
---

# 農產新知（AgriNews.jsx）— 記憶重點

詳細架構見 `docs/architecture/frontend_agrinews.md`。

## savedNews.js 已廢棄但仍存在

`frontend/src/lib/savedNews.js` 仍在專案中，但 AgriNews.jsx 已改用 `favoritesService.js`（`user_favorites` 表）。`savedNews.js` 目前只被 `MyBasket.jsx` 的 localStorage fallback 使用。不要再對 AgriNews 新增 savedNews.js 的呼叫。

## 收藏時 meta.summary 存的是完整全文

`addFavorite` 的 meta 中 `summary` 欄位存的是 `article.fullContent`（完整 `content_text`），不是卡片上截斷 200 字的顯示版本。MyBasket 的收藏文章卡片展開時才顯示完整內容。

## 後端有 5 分鐘 in-memory cache

`/api/news` 有 TTL 300s 的 in-memory cache（`_news_cache`）。開發時若改了新聞資料但前端沒反應，重啟後端即可清除。
