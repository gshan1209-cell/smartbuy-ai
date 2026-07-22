# TASK-D08 小白教學：建立會員資訊資料表

## 1. 這個功能是做什麼的？

建立會員資訊的 SQL 腳本並提供基本資料庫 Schema 結構與偏好設定欄位。

## 2. 這次完成了什麼？

已完成會員資料表與偏好設定同步：

- 建立/對齊 `public.members`
- 建立/對齊 `public.user_preferences`
- 新增必要唯一值、外鍵、check constraints 與 `updated_at` trigger
- 後端新增 `/auth/preferences`
- 前端設定頁已可把通知與顯示偏好同步到 Supabase

## 3. 功能流程

```text
會員註冊
  ↓
INSERT members
  ↓
INSERT user_preferences (member_id)
  ↓
設定頁讀取 /auth/preferences
  ↓
使用者修改通知或顯示偏好
  ↓
PUT /auth/preferences
  ↓
更新 Supabase user_preferences
```

## 4. 相關檔案

- `scripts/create_members_table.sql`
- `backend/routers/auth.py`
- `frontend/src/pages/Settings.jsx`

## 5. 怎麼測試？

```powershell
python -m py_compile backend/routers/auth.py
cd frontend
npm ci
npm run build
```

## 6. 預期與實際結果

已驗證：

- SQL 在 Supabase SQL Editor 執行成功。
- 註冊帳號會新增 `members` 與 `user_preferences`。
- 修改顯示名稱會更新 `members.name`。
- 修改通知、字體、版面、主題會更新 `user_preferences`。
- 線上 `/auth/preferences` 已生效。

## 7. 下一步可以怎麼做？

此任務已完成，不需要再重做會員資料表或設定偏好同步。後續若要新增更多會員設定，請沿用 `user_preferences` 與 `/auth/preferences` 擴充。
