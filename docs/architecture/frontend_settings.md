# 設定頁架構（Settings.jsx）

路徑：`frontend/src/pages/Settings.jsx`（路由 `/settings`，需登入）

## 頁面結構（4 張卡片）

### 1. 帳號資料
- 頭像（名字首字母圓形色塊）、顯示名稱、會員方案 badge
- 修改顯示名稱：`PATCH /api/auth/profile`
- Email：唯讀
- 變更密碼：三欄（舊密碼/新密碼/確認新密碼）→ `PATCH /api/auth/password`（新密碼至少 6 字元）
- 登出：`POST /api/auth/logout` → `logout()`（AuthContext）

### 2. 顯示與版面（即時儲存 localStorage + 後端）

| 設定 | key | 選項 |
|------|-----|------|
| 字體大小 | `fontSize` | sm / md / lg |
| 版面設定 | `layout` | simple / detailed |
| 主題配色 | `theme` | light / dark |

儲存：`localStorage`（key: `smartbuy_display_prefs`）+ `PATCH /api/auth/preferences`；成功後設定 `document.documentElement` 的 `data-theme` / `data-fontsize` attribute。

### 3. 推播偏好（`Toggle` 元件）

| 設定 | key | 預設 |
|------|-----|------|
| 品項降價通知 | `priceAlert` | true |
| 互助網回應通知 | `mutualAidReply` | false |

樂觀更新，後端失敗回滾。儲存：`localStorage`（key: `smartbuy_notif_prefs`）+ `PATCH /api/auth/preferences`。

> `weatherAlert` 欄位存在後端/localStorage 但前端無 UI（刻意保留）。

### 4. 關於
- FAQ 手風琴（`FaqAccordion`，3 則常見問題）
- 分享 App：優先 `navigator.share`，fallback 複製網址到剪貼簿
- 版本號：`v0.1.0`（hardcode）

## 狀態

| state | 說明 |
|-------|------|
| `name` | 顯示名稱，init 來自 `user.name` |
| `prefs` | 推播偏好，init 來自 localStorage |
| `displayPrefs` | 顯示偏好，init 來自 localStorage |
| `feedback` | `{ type: 'success'\|'error', msg }`，2–3 秒自動清除 |
| `pwForm` | `{ old, new, confirm }` 密碼欄位 |
| `pwState` | `'idle'\|'loading'\|'success'\|'error'` |
| `copied` | 分享按鈕複製成功的短暫 flag |

## 後端 API

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/auth/me` | 取得目前會員資訊 |
| PATCH | `/api/auth/profile` | 更新顯示名稱 |
| GET | `/api/auth/preferences` | 讀取偏好 |
| PATCH | `/api/auth/preferences` | 更新偏好（partial patch，未傳欄位不覆蓋） |
| PATCH | `/api/auth/password` | 變更密碼（需驗證舊密碼） |
| POST | `/api/auth/logout` | 登出（清除 httpOnly cookie） |

驗證：httpOnly cookie（`access_token`），由 `_get_current_member_id` 解碼。
Router：`backend/routers/auth.py`；DB：`backend/src/data/member_repository.py`。

## 偏好載入流程

1. mount 時（`user` 存在）呼叫 `GET /api/auth/preferences`
2. 成功 → 覆蓋 localStorage + state；失敗 → 靜默使用 localStorage 值
3. `splitPrefs()` 將回傳扁平物件拆成 `prefs`（推播）和 `display`（顯示）

## 元件

| 元件 | 說明 |
|------|------|
| `Toggle` | 自訂 toggle button，class `yz-tgl on/off` |
| `OptionGroup` | 多按鈕單選群組，active 用 `var(--yz-g)` 背景 |
| `FaqAccordion` | 手風琴，以 `item.id` 控制展開狀態 |
