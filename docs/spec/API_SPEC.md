# API 與函式介面

目前 MVP 採 FastAPI 後端與 React/Vite 前端。前端透過 HTTP API 呼叫後端，後端再呼叫 Python 領域模組與資料存取層。

## HTTP API

### 公開／商品行情

| 路徑 | 用途 |
|---|---|
| `GET /health` | 健康檢查 |
| `GET /api/markets` | 市場清單 |
| `GET /api/market-intel` | 市場情報摘要 |
| `GET /api/products` | 品項列表與行情狀態（支援 `q`、`market` 篩選） |
| `GET /api/products/{name}` | 單一品項行情與購買建議 |
| `GET /api/products/{name}/history` | 單一品項歷史價格走勢（含均線特徵） |
| `GET /api/products/{name}/direction` | 單一品項即時漲跌方向預測（LightGBM） |
| `GET /api/predictions/direction/latest` | 單一市場作物最新下一交易日方向分類（每日批次） |
| `GET /api/predictions/direction` | 多筆下一交易日方向分類列表（每日批次） |
| `GET /api/solar-term` | 目前節氣 |
| `GET /api/news` | 農產新聞列表（支援 `source`、`q` 篩選與分頁） |
| `GET /api/news/sources` | 新聞來源清單 |

### 會員／認證（httpOnly cookie）

| 路徑 | 用途 |
|---|---|
| `POST /api/auth/register` | 會員註冊，成功後設定登入 cookie |
| `POST /api/auth/login` | 會員登入 |
| `POST /api/auth/logout` | 登出（清除 cookie） |
| `GET /api/auth/me` | 取得目前登入會員資訊（需登入） |
| `PATCH /api/auth/profile` | 更新顯示名稱（需登入） |
| `GET /api/auth/preferences` | 取得推播與顯示偏好（需登入） |
| `PATCH /api/auth/preferences` | 更新推播與顯示偏好（需登入） |
| `PATCH /api/auth/password` | 變更密碼，需驗證舊密碼（需登入） |

### 收藏（需登入）

| 路徑 | 用途 |
|---|---|
| `GET /api/favorites?type=` | 取得指定類型（`news`／`product`）的收藏列表 |
| `POST /api/favorites` | 新增收藏（重複收藏不報錯） |
| `DELETE /api/favorites/{type}/{ref_id}` | 刪除單一收藏 |

### 通知（需登入）

| 路徑 | 用途 |
|---|---|
| `GET /api/notifications` | 通知列表（含 `total`、`unreadCount`，分頁） |
| `GET /api/notifications/unread-count` | 未讀通知數量 |
| `PATCH /api/notifications/{notification_id}/read` | 標記單筆通知已讀 |
| `PATCH /api/notifications/read-all` | 全部通知標記已讀 |

### 互助網

| 路徑 | 用途 |
|---|---|
| `GET /api/mutual-aid/posts` | 貼文列表（類型／縣市／關鍵字／`mine` 篩選、排序、分頁） |
| `GET /api/mutual-aid/saved` | 目前登入會員收藏的貼文（需登入） |
| `GET /api/mutual-aid/posts/{post_id}` | 單一貼文詳情（含留言） |
| `POST /api/mutual-aid/posts` | 發布貼文（需登入） |
| `PATCH /api/mutual-aid/posts/{post_id}` | 更新貼文，僅作者可操作（需登入） |
| `DELETE /api/mutual-aid/posts/{post_id}` | 刪除貼文，僅作者可操作（需登入） |
| `PATCH /api/mutual-aid/posts/{post_id}/status` | 更新貼文狀態，僅作者可操作（需登入） |
| `POST /api/mutual-aid/posts/{post_id}/comments` | 新增留言（需登入） |
| `DELETE /api/mutual-aid/comments/{comment_id}` | 刪除留言，僅留言作者可操作（需登入） |
| `POST /api/mutual-aid/posts/{post_id}/like` | 切換按讚狀態（需登入） |
| `POST /api/mutual-aid/posts/{post_id}/save` | 切換收藏狀態（需登入） |
| `POST /api/mutual-aid/upload-image` | 上傳貼文圖片，轉存為 base64 data URL（需登入） |

