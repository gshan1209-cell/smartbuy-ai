# AGENTS.md｜SmartBuy AI Agent 執行入口

> 本檔案是 Codex、ChatGPT 與其他支援 Agent Skills 的工具進入專案時的第一入口。
> 專案完整開發規範仍以 `AGENT.md` 為主；本檔案負責技能選用、執行順序與交付格式。

## 1. 啟動順序

執行任何開發、重構、測試、文件或驗收任務前，依序完成：

1. 閱讀根目錄 `AGENT.md`。
2. 確認任務影響範圍：前台、後台、API、資料、AI、部署或文件。
3. 從 `.agents/skills/` 選擇最少但足夠的技能。
4. 先盤點既有路由、元件、API、資料來源、權限與測試，再修改。
5. 定義完成條件與回歸項目。
6. 實作後執行對應驗證，附上可重現的結果。

不得跳過 `AGENT.md`，也不得用技能內容覆蓋其中的專案總規範。

## 2. 指令優先順序

發生衝突時，依下列順序處理：

1. 使用者本次明確指令
2. Issue、PR 或任務規格的明確驗收條件
3. `AGENT.md` 專案總規範
4. 本檔案 `AGENTS.md`
5. 已選用的 `SKILL.md`
6. 其他設計、技術與歷史文件

若高優先指令可能造成資料遺失、權限漏洞、正式功能縮水或破壞 API contract，必須先清楚標示風險，不得默默執行。

## 3. 技能目錄

| 任務類型 | 必要技能 |
|---|---|
| 新功能、跨層修改、範圍不明的重構 | `smartbuy-task-planner` |
| 消費者前台、首頁、搜尋、菜籃、提醒、節氣、新知、互助網 | `smartbuy-public-app` |
| Dashboard、農民／商家／管理員後台、角色權限 | `smartbuy-dashboard-rbac` |
| 菜價、農業部資料、天氣、二十四節氣、產地與價格風險 | `smartbuy-agri-intelligence` |
| FastAPI、資料庫、登入、API contract、快取、背景任務 | `smartbuy-api-change` |
| Build、測試、RWD、回歸驗收、PR 交付 | `smartbuy-quality-gate` |

同一任務可組合多個技能，但不要載入與任務無關的技能。

## 4. 強制共通規則

- 禁止因重構或美化而隨意刪除既有程式碼與功能。
- 修改前先搜尋引用、路由、狀態、API 與資料來源。
- 不得用靜態 Mock 取代已存在且可使用的正式 API。
- 正式角色固定為 `consumer`、`farmer`、`merchant`、`admin`。
- 未知角色以最低權限處理，不得自動升級。
- 後台權限必須同時有前端顯示控制與後端驗證。
- 所有農業、行情、天氣、節氣與 AI 結果都要能辨識資料來源與資料狀態。
- 新頁面與重大改版至少驗證 Mobile、Tablet、Desktop。
- 變更 API 時應優先維持相容；破壞性變更必須有 migration 與明確說明。
- 一個 PR 只處理一個清楚範圍，確保可獨立建置、驗收與回滾。

## 5. 專案結構規範

涉及新增目錄、搬移檔案、拆分模組、整理依賴或大型重構時，必須先閱讀：

```text
docs/architecture/PROJECT_STRUCTURE.md
```

結構調整的共同原則：

- `backend/main.py` 只保留部署入口；FastAPI 組裝放在 `backend/application.py`。
- Router 集中於 `backend/api/router.py` 註冊；生命週期集中於 `backend/core/lifecycle.py`。
- 與 FastAPI 無關的資料、規則、特徵與模型能力優先放在根目錄 `src/`。
- `frontend/src/App.jsx` 只保留應用外殼；路由放在 `routes/`，穩定設定放在 `config/`，瀏覽器副作用放在 `hooks/`。
- 新增共用元件前先檢查 `components/shared/`，不得建立功能重複但命名不同的第二套元件。
- 舊檔案只能在引用、測試、部署與回滾方式都確認後分批搬移，不得一次全站搬家。

## 6. 任務交付格式

每次完成任務，至少交付：

1. **變更摘要**：做了什麼、沒有做什麼。
2. **影響範圍**：前台、後台、API、資料庫、資料流程、AI、部署。
3. **驗證結果**：實際執行的測試、Build、手動檢查。
4. **回歸檢查**：既有功能是否保留。
5. **風險與後續**：未完成、受環境限制或需下一階段處理的事項。

只寫「完成」或「Build 成功」不算完整交付。

## 7. 技能維護

新增或修改技能時必須：

- 放在 `.agents/skills/<skill-name>/SKILL.md`。
- `SKILL.md` 包含 `name` 與繁體中文 `description` frontmatter。
- 一個技能只負責一類可重複工作。
- 描述清楚寫出何時應觸發與何時不應觸發。
- 指令使用可執行的步驟、輸入、輸出與驗收條件。
- 技能不能降低 `AGENT.md` 的安全、權限、保留功能與驗收要求。

完整設計見：

```text
docs/agent-skills/SMARTBUY_AGENT_SKILL_ARCHITECTURE.md
```
