# SmartBuy AI｜便宜買 AI

把農產品行情、產地天氣與 24 節氣轉成簡單採買建議的 Streamlit MVP。

AI Agent 或開發協作者開始工作前，請先完整閱讀 [`AGENT.md`](AGENT.md)，再從 `data/tasks/tasks.json` 讀取任務。

## 快速開始

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
streamlit run app/main.py
```

執行測試：

```powershell
pytest -q
```

## 資料儲存與雙層架構 (Data Storage Architecture)

為了在免費雲端資源限制下支撐機器學習 (ML) 訓練所需的兩年歷史行情資料，SmartBuy AI 採用**雙層資料儲存架構**：

1. **Supabase PostgreSQL (App 資料庫)**:
   - **定位**: 作為線上 App 即時查詢與每日行情更新之用。
   - **容量與限制**: 由於 Supabase 免費版資料庫容量限制為 500 MB，不適合存放全台數年、每日且涵蓋數千品項與市場的原始交易紀錄。
   - **生命週期**: 線上資料庫僅保留最近 **1～3 個月** 的交易資料（由每日更新腳本自動修剪），以確保輕量化、查詢高效與不超額。
   - **統一資料存取層 (price_repository.py)**: 線上頁面（如價格搜尋頁）透過 [price_repository.py](file:///d:/AI人工智慧/專題/smartbuy-ai/src/data/price_repository.py) 進行查詢。該資料層實作了「Supabase 優先、本機 CSV 備援」機制：僅在資料庫連線出錯、例外或初始資料集為空時執行 fallback。若資料庫可連線但查詢結果為空（0 筆），則正常顯示「查無資料」，不進行 fallback。回傳的 DataFrame 會統一將 `crop_name` 與 `product_name` 標準化對齊，並在 `df.attrs["source"]` 中附帶實際資料來源標記。

3. **使用者買貴通報 (report_repository.py)**:
   - **定位**: 使用者回報市場實際交易價格的儲存層。
   - **雙層寫入與備援**: 優先寫入 Supabase 的 `price_reports` 資料表（採用參數化防範 SQL 注入），若資料庫連線失敗或離線時，自動安全降級寫入本機 `data/reports/price_reports.csv` 備援，並在前台頁面明確顯示實際資料寫入目標。
   - **無官方行情處理**: 若對應作物查無當日官方行情，相關參考價格與價差欄位寫入 `NULL`，系統與前台防崩潰並允許照常通報。

2. **本機 Parquet 檔案 (ML 數據湖 - Data Lake)**:
   - **定位**: 專為機器學習模型訓練提供的高壓縮比、欄位導向 (Column-oriented) 歷史數據儲存層。
   - **儲存路徑**: 儲存於 `data/history_parquet/` 目錄下，檔名為 `agri_price_YYYY-MM.parquet` 的按月分割檔案。
   - **ML 訓練載入方式**: 模型訓練時，應優先讀取 Parquet 數據湖（呼叫 `load_historical_prices_for_ml()` 函式），而不是大量查詢 Supabase 資料庫，避免造成雲端資料庫負擔與限制瓶頸。
   - **預測結果**: 模型預測完成後，將結果寫回 Supabase 的 `prediction_results` 資料表中以供前台顯示。

## Agent 任務自動化

Agent 可先列出候選任務，但不得自行認領：

```powershell
.\.venv\Scripts\python.exe -m src.tasks.agent_workflow list
```

由人類決定任務後，Agent 才能自動將它改為「進行中」並輸出讀取摘要：

```powershell
.\.venv\Scripts\python.exe -m src.tasks.agent_workflow start TASK-T09 `
  --actor "Codex" `
  --approved-by "產品負責人" `
  --role "開發"
```

交付時自動產生缺少的開發紀錄、教學文件、交接摘要，並依結果更新狀態：

```powershell
.\.venv\Scripts\python.exe -m src.tasks.agent_workflow finish TASK-T09 `
  --actor "Codex" `
  --summary "完成 Agent 自動化流程" `
  --outcome needs-test `
  --test-command ".\.venv\Scripts\python.exe -m pytest -q" `
  --test-result "測試通過" `
  --next-step "進行人工驗收"
```

詳細規則與結果狀態對照請見 [`AGENT.md`](AGENT.md)。

目前版本使用 `data/` 內的示範資料，可在沒有 API 金鑰的情況下完整展示。正式串接農業部與中央氣象署 API 前，請先確認資料授權、欄位與更新頻率。

完整原始規格請見根目錄的 `SmartBuy_AI_便宜買AI_MVP完整開發規格書_v1.1_含任務中心與24節氣.md`，開發入口見 `docs/SPEC.md`。
