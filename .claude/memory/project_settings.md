---
name: project-settings
description: Settings.jsx 帳號與設定頁架構、各區塊功能與後端 API 對應
metadata:
  node_type: memory
  type: project
  originSessionId: current
---

# 帳號與設定（Settings.jsx）架構

**路徑**: `frontend/src/pages/Settings.jsx`  
**路由**: `/settings`（需登入，未登入顯示提示並導引至 `/login`）

## 整體結構（共 4 張卡片）

### 1. 帳號資料
- 頭像（名字首字母，圓形色塊）、顯示名稱、會員方案 badge
- **修改顯示名稱**：`PATCH /api/auth/profile` → `updateProfile({ name })`（來自 `AuthContext`）
- **Email**：唯讀顯示，不可透過此頁修改
- **變更密碼**：三欄（舊密碼 / 新密碼 / 確認新密碼）→ `PATCH /api/auth/password`
  - 新密碼至少 6 字元（後端 Pydantic validator）
  - 前端確認兩次輸入一致後才送出
- **登出**：`POST /api/auth/logout`（清除 cookie），呼叫 `logout()`（AuthContext）

### 2. 顯示與版面
三個 `OptionGroup`（按鈕選單），即時儲存到 localStorage + 後端：

| 設定     | key        | 選項             |
|----------|-----------|-----------------|
| 字體大小 | `fontSize` | sm / md / lg     |
| 版面設定 | `layout`   | simple / detailed |
| 主題配色 | `theme`    | light / dark     |

- 儲存位置：`localStorage`（key: `smartbuy_display_prefs`）+ `PATCH /api/auth/preferences`
- `saveDisplayPrefs` 同時設定 `document.documentElement` 的 `data-theme` / `data-fontsize` attribute

### 3. 推播偏好
- 以 `Toggle` 元件（自訂 toggle button）呈現
- 儲存位置：`localStorage`（key: `smartbuy_notif_prefs`）+ `PATCH /api/auth/preferences`
- **optimistic update**：先更新 state，若後端失敗則回滾

| 設定         | key             | 預設  |
|-------------|----------------|-------|
| 品項降價通知 | `priceAlert`    | true  |
| 互助網回應通知 | `mutualAidReply` | false |

> `weatherAlert` 欄位存在後端/localStorage 但前端未顯示（保留）

### 4. 關於
- 幕後說明文字（獨立開發者）
- **FAQ 手風琴**（`FaqAccordion`）：3 則常見問題，狀態為 `open: string | null`
  - 價格資料來源、AI 準確率（~51%，retrain 後需更新）、菜籃資料存在本機
- **分享 App**：優先用 `navigator.share`，fallback 為複製網址到剪貼簿
- 版本號：`v0.1.0`（hardcode）

## 狀態管理

| state          | 說明                                |
|---------------|-------------------------------------|
| `name`         | 顯示名稱 input，init 來自 `user.name` |
| `prefs`        | 推播偏好，init 來自 localStorage      |
| `displayPrefs` | 顯示偏好，init 來自 localStorage      |
| `feedback`     | `{ type: 'success'|'error', msg }` 全域提示，2–3 秒自動清除 |
| `pwForm`       | `{ old, new, confirm }` 密碼欄位     |
| `pwState`      | `'idle'|'loading'|'success'|'error'` |
| `copied`       | 分享按鈕複製成功的短暫 flag           |

## 後端 API 總覽

| 方法    | 路徑                    | 說明                        |
|--------|------------------------|-----------------------------|
| GET    | `/api/auth/me`         | 取得目前會員資訊             |
| PATCH  | `/api/auth/profile`    | 更新顯示名稱（只有 name）    |
| GET    | `/api/auth/preferences`| 取得推播 + 顯示偏好          |
| PATCH  | `/api/auth/preferences`| 更新偏好（partial patch）   |
| PATCH  | `/api/auth/password`   | 變更密碼（需驗證舊密碼）     |
| POST   | `/api/auth/logout`     | 登出（清除 httpOnly cookie） |

- 驗證機制：httpOnly cookie（`access_token`），後端由 `_get_current_member_id` 解碼
- 路由檔：`backend/routers/auth.py`
- DB 函式：`backend/src/data/member_repository.py`（`register_member`, `login_member`, `update_member_profile`, `get_preferences`, `update_preferences`, `change_password`）

## 偏好載入流程

1. `useEffect` on mount（`user` 存在時）：呼叫 `GET /api/auth/preferences`
2. 成功 → 覆蓋 localStorage + state；失敗 → 靜默使用 localStorage 值（fallback）
3. `splitPrefs()` 將後端回傳的扁平物件拆分成 `prefs`（推播）和 `display`（顯示）兩部分

## 重要元件

- `Toggle`：自訂 toggle button，class `yz-tgl on/off`
- `OptionGroup`：多按鈕單選群組，active 樣式用 `var(--yz-g)` 背景
- `FaqAccordion`：手風琴，以 `item.id` 控制展開狀態

**Why:** Settings 是唯一整合帳號、顯示偏好、推播設定的入口，改動時須同步考慮 localStorage 與後端兩個儲存層。  
**How to apply:** 新增偏好欄位時，需同時更新 `DEFAULT_PREFS`/`DEFAULT_DISPLAY`、`splitPrefs()`、後端 `UpdatePreferencesRequest` Pydantic model，以及 `member_preferences` 資料表 schema。
