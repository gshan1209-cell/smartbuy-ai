# TASK-D03 小白教學：將首頁與採買推薦切換為 Supabase 優先

## 1. 這個功能是做什麼的？

建立首頁與採買推薦的 Supabase 優先資料來源切換，並處理多頁面路徑與欄位相容性。

## 2. 這次完成了什麼？

1. 切換首頁與採買推薦以 load_price_history(days=90) 為單一資料來源，取得資料 attrs['source'] 作為頁面顯示與推薦計算的依據。2. 處理 history_df 為空時的 fallback 與友善提示（目前無可用行情資料），並避免呼叫 get_bargain_recommendations。3. 修復 Streamlit 多頁面 import app.common 失敗之路徑問題。4. 編寫單元測試 test_home_view.py 並通過全部測試。

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

- `app/home_view.py`
- `app/pages/01_home.py`
- `src/recommendation/purchase_advisor.py`

## 5. 怎麼測試？

```powershell
.\.venv\Scripts\python.exe -m pytest tests/ -q
```

## 6. 預期與實際結果

45 passed

## 7. 下一步可以怎麼做？

無
