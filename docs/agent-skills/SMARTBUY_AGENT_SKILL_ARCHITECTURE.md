# SmartBuy AI｜Agent SKILL 架構設計

## 1. 目的

SmartBuy AI 的 Agent SKILL 不是角色扮演提示語，也不是另一份大型規格書，而是把高頻、可重複、容易出錯的開發流程拆成可選用的專案技能。

目標：

- 讓 ChatGPT、Codex 與其他 Agent 進入專案後能快速判斷該讀哪些規範。
- 降低跨前台、後台、API、資料與 AI 修改時的遺漏。
- 把「禁止隨意刪碼、四角色權限、三尺寸 RWD、正式資料來源標示」變成可執行的工作流程。
- 每個技能都能單獨更新、測試與版本管理，避免所有規則塞進單一超長文件。

## 2. 文件分工

```text
AGENT.md
└─ 專案總規範、技術架構、角色、路由與不可違反事項

AGENTS.md
└─ Agent 啟動入口、技能選用、執行順序與交付格式

.agents/skills/*/SKILL.md
└─ 特定任務的可重複工作流程

docs/
└─ UI/UX、API、資料、任務與歷史決策的詳細參考文件
```

原則：

- `AGENT.md` 管「全專案一定要遵守什麼」。
- `SKILL.md` 管「遇到某類任務時要怎麼做」。
- 技能不得複製整份總規範，只引用必要規則並提供步驟。

## 3. 初始技能集

| 技能 | 主要任務 | 典型觸發詞 |
|---|---|---|
| `smartbuy-task-planner` | 需求拆解、影響盤點、PR 範圍與完成條件 | 新功能、下一關、重構、規格、規劃 |
| `smartbuy-public-app` | 消費者前台與三尺寸 RWD | 首頁、查菜價、菜籃、提醒、節氣、互助網 |
| `smartbuy-dashboard-rbac` | 後台資訊架構與四角色權限 | Dashboard、農民後台、商家後台、管理員、權限 |
| `smartbuy-agri-intelligence` | 農業、天氣、節氣、行情與 AI 風險資料 | 農業部、氣象、菜價、產地、節氣、預測 |
| `smartbuy-api-change` | FastAPI、資料庫、認證、快取與 API contract | Router、API、Supabase、JWT、migration、cache |
| `smartbuy-quality-gate` | Build、測試、回歸、RWD 與 PR 驗收 | 驗收、測試、build、修 PR、是否完成 |

## 4. 技能選用流程

```text
收到任務
  ↓
先讀 AGENT.md
  ↓
判斷是否跨兩個以上領域
  ├─ 是 → 先用 smartbuy-task-planner
  └─ 否 → 直接選對應領域技能
  ↓
實作技能：public / dashboard / agri / api
  ↓
最後一定用 smartbuy-quality-gate
  ↓
輸出變更、驗證、回歸、風險
```

### 最小載入原則

Agent 應只載入完成任務所需的技能。例如：

- 修改消費者首頁卡片：`smartbuy-public-app` + `smartbuy-quality-gate`。
- 新增農民後台天氣風險：`smartbuy-task-planner` + `smartbuy-dashboard-rbac` + `smartbuy-agri-intelligence` + `smartbuy-api-change` + `smartbuy-quality-gate`。
- 單純修正 FastAPI 回傳欄位：`smartbuy-api-change` + `smartbuy-quality-gate`。

## 5. 技能契約

每個技能至少應包含：

1. **觸發邊界**：何時使用、何時不要使用。
2. **必要輸入**：任務、檔案、API、角色、資料來源或驗收條件。
3. **執行步驟**：可依序操作的命令式流程。
4. **保留規則**：不可破壞的功能、權限與 contract。
5. **輸出要求**：要留下哪些文件、程式與驗證證據。
6. **完成條件**：怎樣才算完成，而不是只說「已修改」。

## 6. Skill frontmatter 規範

```yaml
---
name: smartbuy-example-skill
description: Use when ... Do not use when ...
---
```

命名規則：

- 全部使用小寫 kebab-case。
- 專案技能統一以 `smartbuy-` 開頭。
- 名稱描述工作，不描述 Agent 身分。
- `description` 前段先寫最重要的觸發情境，避免技能清單被截短時失去辨識能力。

## 7. 新技能模板

```markdown
---
name: smartbuy-example-skill
description: Use when implementing or reviewing ... Do not use for ...
---

# Purpose

一句話描述此技能要穩定完成的工作。

## Inputs

- 任務需求
- 相關檔案或路由
- 驗收條件

## Workflow

1. 先讀必要規範。
2. 盤點現況與影響範圍。
3. 定義最小修改方案。
4. 實作並保留既有功能。
5. 執行驗證。

## Guardrails

- 不可違反的專案規則。

## Deliverables

- 程式或文件
- 測試與驗證證據
- 風險與未完成事項
```

## 8. Skill 與工具的關係

Skill 是工作流程，不等於工具：

- GitHub、Supabase、Vercel、Render、Google Drive 是工具或外部系統。
- Skill 定義何時使用工具、使用前要確認什麼、使用後如何驗證。
- 不應把憑證、Token、密碼或正式環境祕密寫進 Skill。
- 外部工具無法使用時，必須清楚標示未驗證部分，不可假裝已完成。

## 9. 版本與維護

- 技能修改應獨立成文件型 PR，或與真正需要該技能的功能 PR 一起提交。
- 技能內容與程式現況不一致時，以更新技能為正式任務，不得長期放任失真。
- 新增技能前先確認是否能擴充既有技能，避免大量重疊技能。
- 一個技能過長或同時處理多種工作時，應拆分。
- 技能移除前要搜尋 `AGENTS.md`、其他技能與任務文件中的引用。

## 10. 後續擴充方向

第二階段可依實際重複工作再增加：

- `smartbuy-data-pipeline`：GitHub Actions、R2 Parquet、每日行情與模型更新。
- `smartbuy-ml-evaluation`：LightGBM 特徵、訓練、資料切分與評估。
- `smartbuy-deployment-release`：Vercel、Render、環境變數、健康檢查與回滾。
- `smartbuy-content-safety`：農產新知、打詐內容、來源與發布審核。
- `smartbuy-skill-maintainer`：建立、測試與整理專案技能。

只有當同類任務已反覆出現，且現有技能不足時才新增，避免技能庫膨脹。
