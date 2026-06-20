# SmartBuy AI Agent 工作入口

本文件是所有 AI Agent 與人類開發者開始任務前的共同入口。無論使用 Codex、Claude Code、Gemini 或其他 Agent，都必須先完成下列讀取流程，再修改任何檔案。

## 1. 啟動時必讀

依序讀取：

1. `AGENT.md`：工作規則與任務讀取方式。
2. `README.md`：專案啟動、測試與資料限制。
3. `docs/SPEC.md`：完整規格入口。
4. `data/tasks/tasks.json`：唯一的任務狀態來源。

若任一檔案無法讀取，停止修改並清楚回報檔名與錯誤，不可自行猜測任務內容。

## 2. 如何讀取任務

### Python

```python
from src.tasks.task_loader import load_tasks

tasks = load_tasks()
for task in tasks:
    print(task["task_id"], task["status"], task["title"])
```

### PowerShell（沒有 Python 時）

```powershell
$tasks = Get-Content -LiteralPath "data/tasks/tasks.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$tasks | Select-Object task_id, status, priority, title, owner
```

禁止用正規表示式或文字搜尋代替 JSON 解析。

## 3. 每筆任務必須能讀到的欄位

```text
task_id
title
status
owner
worker_type
priority
module
related_files
goal
done_definition
dev_log
tutorial_doc
handoff_note
```

讀取後必須確認：

- `task_id` 不為空且沒有重複。
- `status` 是「待認領、進行中、等待測試、需要修改、已完成、已封存」之一。
- `related_files` 與 `done_definition` 是陣列。
- 三個任務文件路徑均存在於任務資料中。

## 4. 如何決定本次任務

1. Agent 可執行以下命令自行找出「待認領」候選任務，但這個動作不會也不得變更狀態：

   ```powershell
   .\.venv\Scripts\python.exe -m src.tasks.agent_workflow list
   ```

2. Agent 將候選任務回報給人類，由人類指定唯一的 `task_id`。
3. 使用者明確指定 `task_id` 時，只處理該任務；若只描述功能，Agent 可提出最相符選項，但仍須等待人類決定。
4. Agent 不得自行選擇最高優先任務，也不得自行認領任何任務。
5. 「等待測試」只由人類明確指派的測試 Agent 接手。
6. 不得修改「已完成」或「已封存」任務，除非人類明確要求重開。
7. 沒有待認領任務時，回報「目前沒有待認領任務」，不可任意擴大工作範圍。

認領前須重新讀取一次 `tasks.json`，確認狀態與 `related_files` 沒有被其他 Agent 改動。多人協作時使用獨立 `feature/*` 分支，避免同時修改相同檔案。

## 5. 讀取成功回報

開始修改前，Agent 必須先執行自動認領命令：

```powershell
.\.venv\Scripts\python.exe -m src.tasks.agent_workflow start TASK-ID `
  --actor "Agent 名稱" `
  --approved-by "指定任務的人類" `
  --role "開發"
```

`--approved-by` 為必填；未提供人類核准者時命令會拒絕認領。成功後會重新驗證 `tasks.json`、將任務更新為「進行中」，並輸出以下讀取成功回報：

```text
任務讀取成功
- 任務：{task_id}｜{title}
- 狀態：{status}
- 目標：{goal}
- 相關檔案：{related_files}
- 完成標準：共 {done_definition 數量} 項
- 本次角色：開發／測試／文件
- 人類核准：{核准者}
```

這份回報是「Agent 已正確讀取任務」的最低確認證據。若無法完整填出以上內容，不得開始修改。

## 6. 開發與交付規則

1. 只修改任務的 `related_files`；需要新增範圍時先說明原因。
2. 不大幅重構未指定模組，不覆蓋其他人的變更。
3. 實作後依 `done_definition` 逐項驗證。
4. 必須為所有新增或修改的程式加上清楚的「中文註解 (Docstring)」，包含模組功能說明與相關元件清單，以利人類與其他 Agent 閱讀維護。
5. 必須提供測試指令與實際結果；未執行就寫「未執行」，不可宣稱通過。
6. 完成任務前必須建立或更新：
   - `dev_log`
   - `tutorial_doc`
   - `handoff_note`
7. 開發過程中若產生任何一次性執行腳本（如批次處理或修復檔案用的 `.py` 檔），用完後必須立即刪除，維持專案目錄乾淨。
8. 交付時必須執行 `agent_workflow finish`，由工具產生缺少的三份文件並更新狀態。
9. 測試尚未通過時，狀態維持「等待測試」或「需要修改」，不可設為「已完成」。
10. 完成後列出新增、修改檔案與仍存在的限制。

### 自動交付命令

需要別人接著測試：

```powershell
.\.venv\Scripts\python.exe -m src.tasks.agent_workflow finish TASK-ID `
  --actor "Agent 名稱" `
  --summary "本次完成內容" `
  --outcome needs-test `
  --test-command "python -m pytest -q" `
  --test-result "已執行，結果請填在這裡" `
  --changed-file "src/example.py" `
  --next-step "請進行人工驗收"
```

狀態對照：

| `--outcome` | 自動狀態 | 使用時機 |
|---|---|---|
| `needs-test` | 等待測試 | 功能完成，但仍需人工或下一階段驗證 |
| `failed` | 需要修改 | 測試失敗或仍有明確問題 |
| `success` | 已完成 | 所有完成標準與實際測試皆通過 |

`success` 必須提供真實測試結果，否則命令會拒絕標記完成。既有文件預設會保留；只有確定要重建時才使用 `--force-documents`。

## 7. Agent 啟動檢查清單

```text
□ 已讀 AGENT.md
□ 已讀 README.md
□ 已讀 docs/SPEC.md 與完整規格
□ tasks.json 可被 JSON 解析
□ 已找到唯一任務
□ 已確認狀態與相關檔案
□ 已由人類明確指定 task_id
□ 已執行 agent_workflow start 並回報「任務讀取成功」
□ 已確認完成標準與文件輸出路徑
□ 交付時已執行 agent_workflow finish
```
