# 前端工程師任務指引：會員系統（註冊 / 登入 / 個人設定）

> **適用範圍**：此文件由後端 / 資料工程交付給前端工程師，說明 `members` 資料表的欄位規格、API 合約，以及各頁面需實作的畫面與串接細節。

> [!IMPORTANT]
> **此任務已於 2026-07-22 全部完成並部署**（`/register`、`/login`、`/settings`、`AuthContext.jsx` 均已對接真實後端）。本文件已依實際程式碼（`backend/routers/auth.py`、`frontend/src/context/AuthContext.jsx`、`Login.jsx`、`Register.jsx`、`Settings.jsx`）校正過，僅作為現況參考，**不要再依早期草稿版本（token 存 localStorage、`/auth` 路徑、`PUT /preferences` 等）重做**。若與 [API_SPEC.md](API_SPEC.md) 或 [SPEC.md](SPEC.md) 有出入，一律以程式碼與 `API_SPEC.md` 為準。

---

## 1. 資料庫欄位說明

### 1.1 `public.members`

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `id` | INTEGER | 自動 | 系統自動遞增，前端不需傳入 |
| `email` | VARCHAR(100) | ✅ | 登入帳號，全局唯一；格式驗證必須含 `@` |
| `password_hash` | VARCHAR(255) | ✅ | **前端只傳明文密碼**；後端負責 bcrypt 雜湊後寫入 |
| `name` | VARCHAR(100) | ✅ | 會員顯示名稱（暱稱） |
| `plan` | VARCHAR(50) | ❌（前端申請不填） | 會員計畫等級，預設 `免費會員`，**僅在會員升級流程中由後端更新，不出現在申請表單** |
| `created_at` | TIMESTAMPTZ | 自動 | 帳號建立時間，系統自動填入 |
| `updated_at` | TIMESTAMPTZ | 自動 | 資料更新時間，系統自動更新 |

> [!IMPORTANT]
> `plan` 欄位**不得**出現在會員申請表單中。前端無論在哪個頁面都不需要傳送此欄位。

### 1.2 `public.user_preferences`

| 欄位 | 型別 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `member_id` | INTEGER | ✅ | 無 | 會員 ID，外鍵連到 `public.members(id)`，`ON DELETE CASCADE` |
| `price_alert` | BOOLEAN | ✅ | `true` | 品項降價通知（目前設定頁未提供切換 UI） |
| `weather_alert` | BOOLEAN | ✅ | `true` | 產地天氣異常警示（目前設定頁未提供切換 UI） |
| `mutual_aid_reply` | BOOLEAN | ✅ | `true` | 互助網回應通知 |
| `mutual_aid_like` | BOOLEAN | ✅ | `true` | 互助網按讚通知 |
| `font_size` | TEXT | ✅ | `md` | `sm`、`md`、`lg`（目前設定頁未提供切換 UI） |
| `layout_mode` | TEXT | ✅ | `simple` | `simple`、`detailed`（目前設定頁未提供切換 UI） |
| `theme` | TEXT | ✅ | `light` | `light`、`dark` |
| `created_at` | TIMESTAMPTZ | 自動 | `NOW()` | 建立時間 |
| `updated_at` | TIMESTAMPTZ | 自動 | `NOW()` | 更新時間，自動 trigger |

---

## 2. 後端 API 合約

> Base path 固定為 `/api/auth`（`backend/routers/auth.py` 的 `APIRouter(prefix="/api/auth")`）。認證方式是 **httpOnly cookie**（`access_token`），不是 `Authorization: Bearer` header，前端 fetch 一律要帶 `credentials: 'include'`。

### 2.1 POST `/api/auth/register` — 會員註冊

**Request Body（JSON）**

```json
{
  "email": "farmer@example.com",
  "password": "your_password",
  "name": "王大明"
}
```

**欄位驗證規則（前端須先做 Client-side 驗證，與後端 `register_member()` 一致）**

| 欄位 | 規則 |
|------|------|
| `email` | 必填、合法 Email 格式 |
| `password` | 必填、長度 **8 位以上**（後端強制檢查；`Register.jsx` 目前 `minLength` 設為 6，與後端不一致，前端待修正） |
| `name` | 必填、不可空白 |

**成功回應 `201 Created`**

同時設定 httpOnly cookie（`access_token`），並回傳：

```json
{
  "success": true,
  "member": {
    "id": 1,
    "email": "farmer@example.com",
    "name": "王大明"
  }
}
```

**失敗回應 `400 Bad Request`（Email 已被使用）**

```json
{ "detail": "此電子郵件已被使用，請直接登入或使用其他信箱。" }
```

**失敗回應 `422 Unprocessable Entity`（欄位驗證失敗，如密碼長度不足）**

```json
{ "detail": "密碼長度至少需要 8 個字元。" }
```

---

### 2.2 POST `/api/auth/login` — 會員登入

**Request Body（JSON）**

```json
{
  "email": "farmer@example.com",
  "password": "your_password"
}
```

**成功回應 `200 OK`**

同時設定 httpOnly cookie（`access_token`）。回應**不含 token**，只回傳會員公開資訊：

```json
{
  "success": true,
  "member": {
    "id": 1,
    "email": "farmer@example.com",
    "name": "王大明",
    "plan": "免費會員"
  }
}
```

**失敗回應 `401 Unauthorized`**

```json
{ "detail": "電子郵件或密碼錯誤，請重新輸入。" }
```

---

### 2.3 POST `/api/auth/logout` — 登出

清除 `access_token` cookie，回傳 `{ "success": true }`。

---

### 2.4 GET `/api/auth/me` — 取得目前登入會員資訊（需登入）

依 cookie 內的 token 解析出 `member_id`，回傳該會員公開資訊（`id`、`email`、`name`、`plan`）。未登入或 token 失效回傳 `401`。

---

### 2.5 PATCH `/api/auth/profile` — 更新會員資料（需登入）

**Request Body（JSON）— 只傳需要變更的欄位**

```json
{ "name": "王大明（新名稱）" }
```

> [!NOTE]
> - `email` 不允許在此端點修改
> - `plan` 不允許透過此端點修改（由後端升級流程處理）
> - 密碼變更請改用 `PATCH /api/auth/password`（見 2.8）

**成功回應 `200 OK`**

```json
{
  "success": true,
  "member": {
    "id": 1,
    "email": "farmer@example.com",
    "name": "王大明（新名稱）",
    "plan": "免費會員"
  }
}
```

---

### 2.6 GET `/api/auth/preferences` — 讀取設定偏好（需登入）

若該會員尚無偏好資料，後端會自動以預設值建立一筆。

**成功回應 `200 OK`**

```json
{
  "priceAlert": true,
  "weatherAlert": true,
  "mutualAidReply": true,
  "mutualAidLike": true,
  "fontSize": "md",
  "layout": "simple",
  "theme": "light"
}
```

---

### 2.7 PATCH `/api/auth/preferences` — 更新設定偏好（需登入）

> 注意：method 是 **PATCH**，不是 PUT；只需傳要變更的欄位（`exclude_unset`），未傳的欄位不會被覆蓋。

**Request Body（JSON，可只傳需要變更的欄位）**

```json
{ "theme": "dark" }
```

**成功回應 `200 OK`**（回傳更新後的完整偏好物件，格式同 2.6）

---

### 2.8 PATCH `/api/auth/password` — 變更密碼（需登入）

**Request Body（JSON）**

```json
{ "old_password": "old_pw", "new_password": "new_pw" }
```

**驗證規則**

| 欄位 | 規則 |
|------|------|
| `new_password` | 長度至少 6 個字元；不可與舊密碼相同 |

**成功回應 `200 OK`**：`{ "success": true }`
**失敗回應 `422`**：舊密碼錯誤、新密碼與舊密碼相同、或新密碼太短時，`detail` 會帶出對應中文訊息。

---

## 3. 頁面現況（`frontend/src/pages/`、`frontend/src/context/AuthContext.jsx`）

### 3.1 `/register` — 會員申請頁（`Register.jsx`，已完成）

- 表單欄位：**顯示名稱**、**Email**、**密碼**（無「確認密碼」欄位，與早期草稿設計不同）
- 送出按鈕文字：「建立中…」/「建立帳號」
- 呼叫 `POST /api/auth/register`（`credentials: 'include'`），成功後直接用回傳的 `member` 呼叫 `setAuthData()` 登入並導向 `/settings`（不會先導去 `/login`）
- `plan` 欄位不出現在表單中，符合規格

### 3.2 `/login` — 會員登入頁（`Login.jsx`，已完成）

- 表單欄位：**Email**、**密碼**
- 送出按鈕文字：「登入中…」/「登入」
- 登入成功後導向 `/settings`
- 頁面下方有「還沒有帳號？前往註冊」連結，跳至 `/register`

**`AuthContext.jsx` 現行狀態**

- `login(email, password)`：呼叫 `POST /api/auth/login`（`credentials: 'include'`），成功後把回傳的 `member` 存入 `localStorage`（key：`yz_auth_user`），**不存 token**（token 由 httpOnly cookie 保管，JS 存取不到也不需要存取）
- `logout()`：呼叫 `POST /api/auth/logout` 清除 cookie，並移除 `localStorage` 的 `yz_auth_user`
- `updateProfile(patch)`：呼叫 `PATCH /api/auth/profile`，成功後同步更新 `localStorage`
- 介面（`user`、`isAuthenticated`、`login`、`logout`、`updateProfile`、`setAuthData`）供下游元件使用

### 3.3 `/settings` — 設定頁（`Settings.jsx`，已完成）

- **帳號資料區塊**：顯示名稱（可編輯，呼叫 `PATCH /api/auth/profile`）、Email（唯讀）、`plan` 徽章（唯讀展示，無「升級計畫」按鈕）、變更密碼（Modal，呼叫 `PATCH /api/auth/password`）、登出
- **顯示與版面區塊**：目前僅提供「主題配色」（亮/暗）切換，呼叫 `PATCH /api/auth/preferences`；`fontSize`／`layout` 欄位資料庫已支援，但目前無對應 UI
- **推播偏好區塊**：目前僅提供「互助網回應通知」「互助網按讚通知」兩個開關；`priceAlert`／`weatherAlert` 資料庫已支援，但目前無對應 UI（此區塊標註「尚未串接實際推播」，代表通知本身尚未實作，設定值已確實同步後端）
- 進入頁面時呼叫 `GET /api/auth/preferences` 取得目前設定，並同步寫入 `localStorage`（`smartbuy_notif_prefs`、`smartbuy_display_prefs`）作前端快取

---

## 4. LocalStorage 規格

| Key | 用途 | 型別 |
|-----|------|------|
| `yz_auth_user` | 已登入會員的公開資訊（`id`, `email`, `name`, `plan`） | JSON object |
| `smartbuy_notif_prefs` | 通知偏好的前端快取；實際資料來源為 `user_preferences` | JSON object |
| `smartbuy_display_prefs` | 顯示偏好的前端快取；實際資料來源為 `user_preferences` | JSON object |

> 沒有 `yz_auth_token`：登入憑證是 httpOnly cookie，JS 無法也不需要讀寫它；所有需登入的請求只要帶 `credentials: 'include'` 即可。

---

## 5. 已知落差 / 待辦

1. `Register.jsx` 密碼欄位 `minLength={6}`，但後端 `register_member()` 實際要求 8 位以上 → 使用者輸入 6~7 位會通過前端驗證但被後端 422 拒絕，應把前端 `minLength` 改成 8。
2. 設定頁尚未提供 `priceAlert`／`weatherAlert`／`fontSize`／`layout` 的切換 UI，資料庫欄位與 API 已支援，僅缺前端畫面。
3. `Register.jsx` 沒有「確認密碼」欄位，若產品需求仍要雙重確認，需另外補上。

---

## 6. 備注與限制

- **密碼雜湊**：前端傳送明文密碼即可，後端統一使用 bcrypt 加密存入 `password_hash` 欄位。
- **JWT 實作**：Token 的產生、驗證與儲存（httpOnly cookie）皆由後端負責，前端不接觸 token 本身，只需在請求中帶 `credentials: 'include'`。
- **`plan` 欄位限制**：前端所有表單（含設定頁）均不得提供使用者修改 `plan`，只能讀取顯示。
