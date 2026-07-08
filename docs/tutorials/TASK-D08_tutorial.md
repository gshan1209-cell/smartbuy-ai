# TASK-D08 小白教學：建立會員資訊資料表

## 1. 這個功能是做什麼的？

建立會員資訊的 SQL 腳本並提供基本資料庫 Schema 結構與偏好設定欄位。

## 2. 這次完成了什麼？

已修改 members 會員資訊資料表 SQL 腳本以精簡會員欄位，僅保留會員核心欄位與 Email 索引。

## 3. 功能流程

```text
讀取任務
  ↓
修改相關檔案
  ↓
執行測試
  ↓
產生文件並更新任務狀態
```

## 4. 相關檔案

- `scripts/create_members_table.sql`
- `data/tasks/tasks.json`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest -q --ignore=tests/test_home_view.py
```

## 6. 預期與實際結果

測試套件 77 項全部通過，且修改後的 SQL 建表與欄位約束已在 Supabase 交易及回滾測試中驗證通過。

## 7. 下一步可以怎麼做？

請在 Supabase 專案的 SQL Editor 執行 scripts/create_members_table.sql 以在線上建立最新的實體 members 資料表。
