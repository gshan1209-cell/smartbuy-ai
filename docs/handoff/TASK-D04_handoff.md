# TASK-D04 交接摘要：將買貴通報改寫入 Supabase

## 執行資訊

- 執行者：Antigravity
- 產生時間：2026-06-23T12:04:58+08:00
- 任務狀態：已完成

## 已完成

1. 建立 scripts/create_price_reports_table.sql 建表腳本，加入 unit 欄位，並將儲存位置欄位命名為 write_destination。2. 建立 src/data/report_repository.py，實作優先寫入 Supabase、失敗 fallback 本機 CSV 備援之機制，且在無官方行情時寫入 NULL 不崩潰，並回傳 write_destination。3. 修改 app/pages/05_report_price.py 呼叫新 repository，並在畫面上顯示正確的寫入位置（Supabase 線上資料庫或本機 CSV 備援）與對比資訊。4. 新增 tests/test_report_repository.py 覆蓋連線正常、CSV Fallback、無行情與價格防呆之單元測試並通過全專案測試。5. 更新 README.md 與 docs/SPEC.md 文件。

## 修改檔案

- `scripts/create_price_reports_table.sql`
- `src/data/report_repository.py`
- `app/pages/05_report_price.py`
- `tests/test_report_repository.py`
- `README.md`
- `docs/SPEC.md`

## 完成標準

- [ ] 建立 scripts/create_price_reports_table.sql 資料表建立腳本
- [ ] 建立 src/data/report_repository.py 處理通報之 Supabase 寫入與 CSV 備援
- [ ] 修改 app/pages/05_report_price.py 使用新 repository並提示資料寫入位置
- [ ] 無官方行情時 reference_price、price_gap 與百分比寫入 NULL 且前台正常提報不崩潰
- [ ] 編寫單元測試覆蓋 Supabase 寫入、Fallback CSV 與無行情狀態並通過測試
- [ ] 更新 README.md 與 docs/SPEC.md

## 測試指令

```powershell
.\.venv\Scripts\python.exe -m pytest tests/ -q
```

## 測試結果

49 passed

## 尚未完成／下一步

無

## 已知問題

若交付結果為 `failed`，請優先依測試結果修正；其他情況目前無自動登錄的已知問題。
