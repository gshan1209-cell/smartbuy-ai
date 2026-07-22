# 農產新知架構（AgriNews.jsx）

路徑：`frontend/src/pages/AgriNews.jsx`（路由 `/news`）

## 頁面結構

- 搜尋框（400ms debounce，帶清除 ✕ 按鈕）
- 來源 select（動態從 `GET /api/news/sources` 取得）
- 清除篩選按鈕（query 或 sourceFilter 有值時顯示）
- 文章卡片格（auto-fill grid，minmax 440px）
  - 來源 badge、日期、收藏 ☆★ 按鈕
  - 標題、內文（預設 2 行 line-clamp，點擊展開）
  - 「閱讀原文 ↗」外連、「展開/收合」toggle
- 分頁列（上頁/下頁 + 頁碼，顯示省略號）

**狀態：**

| state | 說明 |
|-------|------|
| `articles` | 目前頁文章陣列 |
| `query` / `debouncedQuery` | 搜尋關鍵字（400ms debounce） |
| `sourceFilter` | 來源篩選 |
| `page` | 目前頁碼（query/sourceFilter 改變時重置為 1） |
| `total` | 後端回傳總筆數，用於計算 totalPages |
| `expandedId` | 目前展開的文章 id（換頁/換篩選時清空） |
| `savedIds` | 已收藏文章 id 字串陣列 |

## 後端 API

### `GET /api/news`

Query params：`q`、`source`、`limit`（預設 12，最大 100）、`offset`

回傳：
```json
{
  "total": 123,
  "limit": 12,
  "offset": 0,
  "articles": [
    {
      "id": 1,
      "title": "...",
      "published_date": "2026-07-20",
      "source_name": "農業部",
      "source_url": "https://...",
      "content_text": "..."
    }
  ]
}
```

後端有 5 分鐘 in-memory cache（`_news_cache`，TTL 300s），cache key = `source_name|keyword|limit|offset`。

### `GET /api/news/sources`

回傳：`{ "sources": ["農業部", "自由時報", ...] }`（DISTINCT source_name 排序）

### 後端實作

- Router：`backend/routers/misc.py`
- Repository：`src/data/agri_news_repository.py`
- 資料表：`public.agri_news_articles`
- 查詢條件：`parse_status = 'success'` AND `content_text IS NOT NULL` AND `BTRIM(content_text) <> ''`
- 排序：`published_date DESC NULLS LAST, id DESC`
- 每日更新：`scripts/update_agri_news_daily.py` + `src/data/fetch_agri_news.py`

## 收藏整合

走 `favoritesService.js`（`user_favorites` 表），樂觀更新（先更新 `savedIds`，失敗回滾）。

`addFavorite` 傳入的 meta：
```js
{
  title: article.title,
  summary: article.fullContent,   // 存完整 content_text，不是截斷後的 summary
  source: article.source,
  url: article.url,
  date: article.date,
}
```

前端欄位對應（從 API 回應轉換）：
| API 欄位 | 前端欄位 |
|---------|---------|
| `content_text` | `summary`（截斷 200 字顯示）/ `fullContent`（完整） |
| `source_name` | `source` |
| `source_url` | `url` |
| `published_date` | `date`（formatDate 轉 YYYY/MM/DD） |
