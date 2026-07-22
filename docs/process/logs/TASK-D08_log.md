# TASK-D08 開發紀錄：建立會員資訊資料表

## 1. 任務目標

建立會員資訊的 SQL 腳本並提供基本資料庫 Schema 結構與偏好設定欄位。

## 2. 執行資訊

- 執行者：Antigravity
- 產生時間：2026-07-08T14:51:34+08:00
- 交付結果：success
- 下一狀態：已完成
- 更新時間：2026-07-13
- 最新狀態：已完成並部署；請勿重複建立會員 schema 或重做偏好同步

## 3. 本次修改內容

已完成會員 schema 對齊與設定偏好同步：

- `scripts/create_members_table.sql` 可重複執行，會建立或對齊 `public.members` 與 `public.user_preferences`。
- `members.email` 已使用 UNIQUE 約束，不再建立重複的普通 Email 索引。
- `user_preferences` 已包含通知與顯示偏好欄位，並有預設值與 check constraints。
- `members` 與 `user_preferences` 都有 `updated_at` 自動更新 trigger。
- 後端已新增 `/auth/preferences` 讀寫 API。
- 前端 `Settings.jsx` 已可讀寫 `user_preferences`，不再只存 localStorage。

### 修改檔案

- `scripts/create_members_table.sql`
- `backend/routers/auth.py`
- `frontend/src/pages/Settings.jsx`

## 4. 完成標準

- [x] 建立並對齊 `scripts/create_members_table.sql`
- [x] 資料表包含主鍵、唯一值約束、外鍵與必要 check constraints
- [x] 欄位完整對應目前 `Settings.jsx` 與 `AuthContext.jsx` 的狀態
- [x] 偏好設定可從前端同步更新到 Supabase `user_preferences`
- [x] 線上後端 `/auth/preferences` 已部署生效

## 5. 測試方式

```powershell
python -m py_compile backend/routers/auth.py
cd frontend
npm ci
npm run build
```

## 6. 測試結果

- `python -m py_compile backend/routers/auth.py` 通過。
- `npm run build` 通過。
- Supabase SQL Editor 執行 `scripts/create_members_table.sql` 成功。
- 註冊會員會新增 `members` 與 `user_preferences`。
- 修改會員名稱會同步更新 `members`。
- 修改設定頁通知與顯示偏好會同步更新 `user_preferences`。

## 7. 下一步

此任務已完成。後續工程師不需要重做會員資料表或設定偏好同步；若要延伸功能，請在既有 `members`、`user_preferences` 與 `/auth/preferences` API 上擴充。
