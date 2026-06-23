# TASK-D04 小白教學：將買貴通報改寫入 Supabase

## 1. 這個功能是做什麼的？

將買貴通報功能從現有的本機 CSV 寫入方式升級為 Supabase PostgreSQL 優先，並在資料庫離線時自動安全降級為本機 CSV 備援。

## 2. 這次完成了什麼？

1. 建立 scripts/create_price_reports_table.sql 建表腳本，加入 unit 欄位，並將儲存位置欄位命名為 write_destination。2. 建立 src/data/report_repository.py，實作優先寫入 Supabase、失敗 fallback 本機 CSV 備援之機制，且在無官方行情時寫入 NULL 不崩潰，並回傳 write_destination。3. 修改 app/pages/05_report_price.py 呼叫新 repository，並在畫面上顯示正確的寫入位置（Supabase 線上資料庫或本機 CSV 備援）與對比資訊。4. 新增 tests/test_report_repository.py 覆蓋連線正常、CSV Fallback、無行情與價格防呆之單元測試並通過全專案測試。5. 更新 README.md 與 docs/SPEC.md 文件。

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

- `scripts/create_price_reports_table.sql`
- `src/data/report_repository.py`
- `app/pages/05_report_price.py`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest tests/ -q
```

## 6. 預期與實際結果

49 passed

## 7. 下一步可以怎麼做？

無
