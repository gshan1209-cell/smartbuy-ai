# 前端工程師任務指引：會員系統（註冊 / 登入 / 個人設定）

> **適用範圍**：此文件由後端 / 資料工程交付給前端工程師，說明 `members` 資料表的欄位規格、API 合約，以及各頁面需實作的畫面與串接細節。

---

## 1. 資料庫欄位說明

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

---

## 2. 後端 API 合約

### 2.1 POST `/api/auth/register` — 會員註冊

**Request Body（JSON）**

```json
{
  "email": "farmer@example.com",
  "password": "your_password",
  "name": "王大明"
}
```

**欄位驗證規則（前端須先做 Client-side 驗證）**

| 欄位 | 規則 |
|------|------|
| `email` | 必填、合法 Email 格式 |
| `password` | 必填、長度 8 位以上 |
| `name` | 必填、長度 1~100 字 |

**成功回應 `201 Created`**

```json
{
  "success": true,
  "member_id": 1,
  "email": "farmer@example.com",
  "name": "王大明"
}
```

**失敗回應 `400 Bad Request`（Email 已被使用）**

```json
{
  "success": false,
  "error": "email_already_exists",
  "message": "此電子郵件已被使用，請直接登入或使用其他信箱。"
}
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

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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
{
  "success": false,
  "error": "invalid_credentials",
  "message": "電子郵件或密碼錯誤，請重新輸入。"
}
```

---

### 2.3 PATCH `/api/auth/profile` — 更新會員資料（需登入）

**Request Headers**

```
Authorization: Bearer <token>
```

**Request Body（JSON）— 只傳需要變更的欄位**

```json
{
  "name": "王大明（新名稱）"
}
```

> [!NOTE]
> - `email` 不允許在此端點修改
> - `plan` 不允許透過此端點修改（由後端升級流程處理）
> - `password` 如需修改，請設計獨立的 `/api/auth/change-password` 端點

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

## 3. 需要實作的頁面

### 3.1 `/register` — 會員申請頁（全新頁面）

**UI 需求**

- 表單欄位：
  1. **電子郵件**（email）— 必填，即時 Email 格式驗證
  2. **密碼**（password）— 必填，長度至少 8 位，顯示/隱藏切換按鈕
  3. **確認密碼**（password_confirm）— 必填，兩次輸入相符才可送出
  4. **顯示名稱**（name）— 必填

- `plan` 欄位**不得出現**在此表單。

- 送出按鈕文字：「立即加入」
- 送出後顯示成功訊息並導向 `/login` 頁

**錯誤處理**

| 情境 | 顯示訊息 |
|------|---------|
| Email 已被使用 | 「此電子郵件已被使用，請直接登入或使用其他信箱。」 |
| 密碼不一致 | 「兩次輸入的密碼不相符，請重新確認。」 |
| 伺服器錯誤 | 「目前系統繁忙，請稍後再試。」 |

---

### 3.2 `/login` — 會員登入頁（修改現有假登入）

**UI 需求**

- 表單欄位：
  1. **電子郵件**（email）— 必填
  2. **密碼**（password）— 必填，顯示/隱藏切換

- 送出按鈕文字：「登入」
- 登入成功後：
  - 將 API 回傳的 `token` 存入 `localStorage`（key：`yz_auth_token`）
  - 將 `member` 資料（不含密碼）存入 `localStorage`（key：`yz_auth_user`）
  - 導向首頁 `/`
- 頁面下方加上「還沒有帳號？立即申請」的連結，跳至 `/register`

**AuthContext.jsx 修改說明**

- 原來的假登入（DEMO_USER 硬寫）須替換為呼叫真實的 `/api/auth/login`
- `login(email, password)` 函式改為非同步（async）呼叫 API
- `logout()` 函式須同時清除 `yz_auth_token` 與 `yz_auth_user`
- 介面（`user`、`isAuthenticated`、`login`、`logout`、`updateProfile`）保持不變，下游元件不須改動

---

### 3.3 `/settings` — 設定頁（修改現有頁面）

**UI 需求**

- **帳號資料區塊**（已存在，需更新）：
  - 顯示：顯示名稱（可編輯）、Email（不可編輯，唯讀顯示）
  - 儲存時呼叫 `PATCH /api/auth/profile`，傳入 `{ name }`
  - 儲存成功後更新 `localStorage` 的 `yz_auth_user`

- **訂閱計畫區塊**（唯讀展示，不可由使用者修改）：
  - 顯示目前計畫名稱（`user.plan`），例如「免費會員」或「訂閱夥伴」
  - 可加上「升級計畫」按鈕（按下後暫時顯示「敬請期待」），不需串接升級流程

- **推播偏好區塊**（維持現狀，暫存 `localStorage`，待後端串接）：
  - 保留原有三個開關的 UI，不需要串接 members 資料表

---

## 4. LocalStorage 規格

| Key | 用途 | 型別 |
|-----|------|------|
| `yz_auth_token` | JWT Token，每次 API 需要鑑權的請求帶入 `Authorization: Bearer` Header | string |
| `yz_auth_user` | 已登入會員的公開資訊（`id`, `email`, `name`, `plan`） | JSON object |

---

## 5. 實作順序建議

1. **修改 `AuthContext.jsx`**：將假登入改為真實 API 呼叫（先確認後端 `/api/auth/login` 已就緒）
2. **建立 `/register` 頁面**：表單 UI + 驗證 + 串接 `/api/auth/register`
3. **更新 `/login` 頁面**：連結到真實 API，加上「前往申請」入口
4. **更新 `/settings` 頁面**：保留顯示名稱編輯 + 新增訂閱計畫唯讀區塊

---

## 6. 備注與限制

- **密碼雜湊**：前端傳送明文密碼即可，後端統一使用 bcrypt 加密存入 `password_hash` 欄位。
- **JWT 實作**：Token 的產生與驗證由後端負責，前端只負責儲存與帶入 Header。
- **`plan` 欄位限制**：前端所有表單（含設定頁）均不得提供使用者修改 `plan`，只能讀取顯示。
