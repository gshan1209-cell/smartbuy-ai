# 每日 AI 推薦快照操作流程

目前為人工觸發 ChatGPT 的每日批次推薦流程，未直接串接 LLM API；程式會先整理完整的價格、交易量、預測、新知與來源比較，再交給 ChatGPT 產生角色化決策 JSON。現行輸出 Schema 為 v2，舊版 v1 已發布快照仍可由前端讀取。

## 每日流程

GitHub Actions 會在台灣時間上午 9 點左右執行 `Daily Recommendation Input Prepare`，等待早晨行情／預測／新知資料更新後，執行：

```powershell
python scripts/prepare_daily_recommendations.py --date YYYY-MM-DD
```

Workflow 會把以下整個目錄上傳為保留 7 天的 Artifact：

```text
recommendation_inputs/YYYY-MM-DD/
  ├─ chatgpt-prompt.md
  ├─ taipei-1-input.json
  ├─ taichung-city-input.json
  └─ kaohsiung-city-input.json
```

使用者只需要下載 Artifact，將 `chatgpt-prompt.md` 的完整內容交給 ChatGPT；三個 input JSON 是稽核與除錯用的原始整理資料，不需要另外貼給 ChatGPT。Workflow 不會呼叫 ChatGPT，也不會自動發布網站。

若資料更新後需要立即重跑，可在 GitHub Actions 手動執行同一 workflow，填入 `recommendation_date`；留白時使用 Asia/Taipei 當日日期。

1. 以 Asia/Taipei 當日日期整理三個市場資料：

   ```powershell
   python scripts/prepare_daily_recommendations.py
   ```

   若需補作指定日期：

   ```powershell
   python scripts/prepare_daily_recommendations.py --date YYYY-MM-DD
   ```

2. 開啟 `recommendation_inputs/YYYY-MM-DD/chatgpt-prompt.md`，將完整內容交給 ChatGPT。Prompt 已明確要求消費者、農民、商家依不同任務產生不同決策，不可只替換角色名稱。
3. 將 ChatGPT 回傳的純 JSON 存成 `recommendation_outputs/YYYY-MM-DD.json`。
4. 驗證並發布：

   ```powershell
   python scripts/publish_daily_recommendations.py --date YYYY-MM-DD --input recommendation_outputs/YYYY-MM-DD.json
   ```

   若要保留同一推薦日期的既有快照、以新人工批次建立版本化發布目錄，可指定：

   ```powershell
   python scripts/publish_daily_recommendations.py --date YYYY-MM-DD --input recommendation_outputs/YYYY-MM-DD.json --release-dir YYYY-MM-DD-chatgpt-YYYY-MM-DD
   ```

   這會保留原日期目錄，只更新 `latest.json` 指向新的版本化目錄。

5. 確認 `frontend/public/recommendations-daily/latest.json` 已指向本次日期，並確認三個市場 JSON 都位於 `frontend/public/recommendations-daily/YYYY-MM-DD/`。
6. 依既有流程 commit、push，由既有部署流程更新網站。

驗證失敗時，發布工具會停止且不更新 `latest.json`。行情交易日只取來源資料最大交易日期，不會以推薦日或系統日期偽造。預測或新知無資料時維持 `null` 並在 `source_summary` 與角色決策中揭露限制。v2 角色決策固定包含 `primary`、`watch`、`know`、`do`、`evidence`，前端主要畫面只呈現前四項，完整分析與來源放在詳細依據區。

## 未來 LLM API 替換點

只替換步驟 2 與 3：將 `chatgpt-prompt.md` 的固定輸入與輸出 Schema 交給 LLM API，再把回傳 JSON 送入同一支 `publish_daily_recommendations.py`。前端路徑、每日市場 JSON 與驗證契約不需要修改；屆時只將 `generator.type` 改為 `llm-api`，並同步調整發布驗證允許的生成方式。
