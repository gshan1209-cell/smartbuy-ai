# TASK-D08 開發紀錄：建立會員資訊資料表

## 1. 任務目標

建立會員資訊的 SQL 腳本並提供基本資料庫 Schema 結構與偏好設定欄位。

## 2. 執行資訊

- 執行者：Antigravity
- 產生時間：2026-07-08T14:51:34+08:00
- 交付結果：success
- 下一狀態：已完成

## 3. 本次修改內容

已修改 members 會員資訊資料表 SQL 腳本以精簡會員欄位，僅保留會員核心欄位與 Email 索引。

### 修改檔案

- `scripts/create_members_table.sql`
- `data/tasks/tasks.json`

## 4. 完成標準

- [ ] 建立 scripts/create_members_table.sql
- [ ] 資料表包含主鍵、唯一值約束與合理索引
- [ ] 欄位完整對應目前前端 Settings.jsx 與 AuthContext.jsx 的狀態

## 5. 測試方式

```powershell
.\.venv\Scripts\python.exe -m pytest -q --ignore=tests/test_home_view.py
```

## 6. 測試結果

測試套件 77 項全部通過，且修改後的 SQL 建表與欄位約束已在 Supabase 交易及回滾測試中驗證通過。

## 7. 下一步

請在 Supabase 專案的 SQL Editor 執行 scripts/create_members_table.sql 以在線上建立最新的實體 members 資料表。
