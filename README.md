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
