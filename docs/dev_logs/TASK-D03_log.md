# TASK-D03 開發紀錄：將首頁與採買推薦切換為 Supabase 優先

## 1. 任務目標

建立首頁與採買推薦的 Supabase 優先資料來源切換，並處理多頁面路徑與欄位相容性。

## 2. 執行資訊

- 執行者：Antigravity
- 產生時間：2026-06-23T11:51:22+08:00
- 交付結果：success
- 下一狀態：已完成

## 3. 本次修改內容

1. 切換首頁與採買推薦以 load_price_history(days=90) 為單一資料來源，取得資料 attrs['source'] 作為頁面顯示與推薦計算的依據。2. 處理 history_df 為空時的 fallback 與友善提示（目前無可用行情資料），並避免呼叫 get_bargain_recommendations。3. 修復 Streamlit 多頁面 import app.common 失敗之路徑問題。4. 編寫單元測試 test_home_view.py 並通過全部測試。

### 修改檔案

- `app/home_view.py`
- `app/main.py`
- `app/pages/01_home.py`
- `tests/test_home_view.py`

## 4. 完成標準

- [ ] 首頁資料載入切換為呼叫 price_repository.load_price_history(days=90)
- [ ] 首頁顯示當前資料來源 (Supabase 或 本機 CSV 備援)
- [ ] 首頁顯示最新交易日期
- [ ] 確保傳入採買推薦模組的欄位同時相容 crop_name 與 product_name
- [ ] 修復首頁入口的 sys.path 多頁面導入問題
- [ ] 編寫或更新單元測試並通過全專案測試

## 5. 測試方式

```powershell
.\.venv\Scripts\python.exe -m pytest tests/ -q
```

## 6. 測試結果

45 passed

## 7. 下一步

無
