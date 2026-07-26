---
name: smartbuy-codex-local-testing
description: 適用於 SmartBuy AI 需要本機瀏覽器、Docker、裝置模擬、GUI、實機或 CI／Connector 無法直接執行的測試；由 Codex 執行並回傳可驗證證據，主驗收 Agent 負責審核、CI、PR 與合併。不得用來跳過既有 CI、資料安全或功能回歸要求。
---

# SmartBuy Codex Local Testing Handoff

## Purpose

將必須依賴本機環境的驗證交給 Codex 執行，同時維持可重現、可審核、不可偽造的測試證據。這個技能只負責本機測試委派與結果回收，不取代開發技能、`smartbuy-quality-gate` 或 GitHub Actions。

## Trigger

遇到下列任一情況時啟用：

- 需要安裝 Chromium、Playwright browser runtime 或其他大型本機執行環境。
- 需要 Docker、Docker Compose、本機 PostgreSQL、Redis、MinIO 或服務容器。
- 需要手機、平板、桌機裝置模擬，或 360px、768px、834px 等邊界尺寸。
- 需要 GUI 點擊、鍵盤操作、焦點、拖曳、檔案上傳、相機、麥克風或實機操作。
- 需要區域網路中的 ESP32、感測器、掃描器或其他硬體。
- CI、Vercel Preview、Connector 或遠端環境因權限、配額、SSO、網路或平台限制無法完成驗證。
- 使用者明確要求把本機測試交給 Codex。

下列情況不應只交給本機測試：

- 已有 GitHub Actions 可穩定執行的單元測試、Build、bundle budget 或 E2E。
- 可以用 repository tests、API contract tests 或 deterministic mocks 完成的驗證。
- 需要正式資料庫 migration、正式資料寫入或 production smoke test，但尚未取得明確授權。

## Responsibility Split

### 主驗收 Agent

1. 提供任務背景、受影響檔案、完成條件與禁止事項。
2. 指定 focused tests、完整回歸、裝置尺寸與預期結果。
3. 明確說明是否允許修改程式、建立 commit、開 PR 或接觸外部服務。
4. 收到 Codex 結果後檢查：
   - 命令是否真的對應任務。
   - 輸出是否足以證明結果。
   - 是否有任意刪除、放寬 assertion、提高 retry 或永久 skip。
   - 是否仍需 GitHub Actions、Preview 或人工驗收。
5. 負責 GitHub diff、CI、PR、合併與交付說明。

### Codex

1. 先讀取 `AGENT.md`、`AGENTS.md` 與任務指定技能。
2. 確認工作樹乾淨，記錄起始 branch 與 commit SHA。
3. 不猜測環境；先輸出版本與可用工具。
4. 先執行 focused tests，修正後再執行受影響的完整測試。
5. 測試失敗時保留原始證據，不得只貼重寫後摘要。
6. 若被授權修正，直接在任務分支修改並建立小而清楚的 commit。
7. 回傳完整交付報告，不得只寫「本機測試通過」。

## Standard Codex Instruction

將以下內容作為每次委派的固定骨架，補上本次任務細節後交給 Codex：

```text
你正在 SmartBuy AI repository 執行本機測試任務。

開始前必須：
1. 閱讀 AGENT.md、AGENTS.md。
2. 閱讀 .agents/skills/smartbuy-quality-gate/SKILL.md。
3. 閱讀 .agents/skills/smartbuy-codex-local-testing/SKILL.md。
4. 顯示目前 branch、HEAD SHA、git status。
5. 不得任意刪除既有程式碼或功能。

本次測試目標：
<填入具體目標>

必測範圍：
<填入命令、頁面、角色、裝置、API 或情境>

允許修改：
<是／否；若是，限定範圍>

禁止事項：
- 不得寫入正式資料庫或正式帳號。
- 不得提交 secrets、token、cookie、JWT 或資料庫 URL。
- 不得提高 retries、永久 skip、放寬 assertion、隱藏 overflow 來讓測試通過。
- 不得跳過既有可執行的 CI 對應測試。

執行順序：
1. 輸出 OS、Node、npm、Python、瀏覽器、Docker 等實際版本。
2. 安裝必要依賴，但不得無理由修改 lockfile。
3. 跑 focused tests。
4. 若失敗，分析根因並在允許範圍內修正。
5. 重跑 focused tests。
6. 跑受影響的完整測試、Build、E2E 或 bundle budget。
7. 建立 commit，回傳 branch 與 SHA。

回報必須包含：
- 環境版本。
- 每一條實際命令及 exit result。
- pass／fail／skip 數量。
- 失敗根因與修正摘要。
- 修改檔案清單。
- branch 與 commit SHA。
- screenshot／video／trace／log／artifact 路徑。
- 未完成、阻擋或需人工確認事項。
- 是否接觸正式服務或正式資料；預設回答否。
```

## Common Command Sets

### Frontend baseline

```bash
cd frontend
npm ci
npm test
npm run build:check
```

### Playwright browser gate

```bash
cd frontend
npm install --no-save --no-package-lock @playwright/test@1.61.1
npx playwright install chromium
npm run build
npm run test:e2e
```

至少確認：

- 1440 × 900 desktop。
- 1024 × 768 tablet。
- 768 × 1024 compact tablet。
- 390 × 844 mobile。
- 360px minimum width，重大 RWD 變更時人工補測。
- 無水平溢位、可見焦點、accessible name、鍵盤流程、404 與權限 fail-closed。

### Backend baseline

```bash
python -m pip install -r requirements.txt
python -m compileall -q backend src tests
python -m pytest -q --tb=short
```

### Docker／local service

```bash
docker version
docker compose config
docker compose up -d
# 執行服務健康檢查與測試
docker compose logs --no-color > local-test-docker.log
docker compose down -v
```

除非任務明確要求保留 volume，測試完成後應清理本機測試容器與暫存資料。

## Evidence Requirements

可接受證據：

- 完整命令與 exit code。
- 測試 runner 的 pass／fail／skip 摘要。
- GitHub branch 與 commit SHA。
- Playwright trace、screenshot、video、HTML report。
- Docker logs、HTTP response、console output。
- 人工測試清單，每項包含尺寸、步驟、預期與實際結果。

不可接受證據：

- 只有「已測試」「正常」「應該沒問題」。
- 沒有 commit 的程式修正宣稱。
- 只有 screenshot，但沒有互動步驟與測試結果。
- 使用正式資料成功一次就宣稱功能通過。
- 測試曾失敗，但透過 skip、retry 或放寬 assertion 後未解釋原因。

## Required Codex Report

```markdown
## Environment
- OS:
- Branch:
- Start SHA:
- Node / npm:
- Python:
- Browser / Playwright:
- Docker:

## Commands and results
- `command` → PASS / FAIL / SKIP

## Focused verification

## Full regression

## Browser / device verification
- Desktop 1440×900:
- Tablet 1024×768:
- Compact Tablet 768×1024:
- Mobile 390×844:
- Minimum 360px:

## Changes made
- Files:
- Commit SHA:

## Evidence
- Logs:
- Screenshots:
- Videos:
- Traces:
- Reports:

## Production safety
- Connected to production services: No / Yes with explicit authorization
- Wrote production data: No / Yes with explicit authorization
- Secrets committed: No

## Blocked or manual follow-up
```

## Acceptance

本機測試委派只有在以下條件全部成立時才算完成：

- Codex 回報包含環境、完整命令、結果與證據。
- 所有被修正的失敗都已重新測試。
- 可在 CI 執行的測試仍由 GitHub Actions 通過。
- 沒有未授權的正式資料寫入或 secrets 泄漏。
- 主驗收 Agent 已審核 diff、commit、風險與未完成項目。
