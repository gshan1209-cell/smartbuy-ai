# SmartBuy AI｜AI 動力裝甲與失效降級契約

## 1. 目的

SmartBuy AI 正式採用 **AI 動力裝甲架構**：

```text
沒有生成式 AI，SmartBuy 仍能完成核心採買與營運任務；
啟用 AI 後，推薦、解釋、分析與自動化能力大幅提升。
```

AI 不得成為登入、查價、商品管理、菜籃、互助網、通知或正式資料存取的單點故障。

---

## 2. 三版本定位

### 標準版｜基礎機體

不需要 LLM Token，核心能力包括：

- 會員登入、註冊、登出與角色權限。
- 農產品行情查詢與商品詳細資訊。
- 收藏、菜籃、提醒與通知。
- 二十四節氣、當季資訊與固定內容。
- 互助網貼文、留言、按讚與圖片。
- 農民、商家與管理員後台的非 AI 操作。
- 規則式採買建議與固定模板建議。
- 既有統計、異常判斷與傳統機器學習預測。
- 人工操作、人工審核與人工發布入口。

標準版是正式產品，不是 Mock、展示頁或殘缺模式。

### 進階版｜輔助裝甲

在標準版之上增加：

- AI 生成的白話行情說明。
- 消費者、農民、商家三角色推薦。
- 推薦理由、風險摘要與行動建議。
- 內容草稿、分類與摘要輔助。
- 快取優先與成本保護。

所有 AI 功能必須能回退標準版規則、固定模板或人工流程。

### 旗艦版｜完整動力裝甲

在進階版之上增加：

- 統一 AI Gateway。
- Prompt Registry 與版本管理。
- RAG／Knowledge Base。
- Agent Workflow 與跨工具協作。
- Token Ledger、成本預算與模型路由。
- AI 品質、延遲、錯誤與採用率儀表板。
- 高風險操作的人類核准與完整 Audit。

旗艦版尚屬目標能力，未完成項目不得在 Release Record 中標記為已交付。

---

## 3. 能力責任分層

| 能力 | 分層 | AI 關閉後 |
|---|---|---|
| Auth／RBAC | `core-required` | 必須可用 |
| 商品、行情、菜籃、收藏 | `core-required` | 必須可用 |
| 互助網、通知、設定 | `standard-capability` | 必須可用 |
| 節氣與固定內容 | `standard-capability` | 必須可用 |
| LightGBM 價格方向預測 | `standard-capability` | 可用，不依賴生成式 AI |
| 規則式推薦 | `standard-capability` | 必須可用 |
| LLM 三角色推薦 | `ai-enhancement` | 回退規則推薦 |
| AI 白話解釋與摘要 | `ai-enhancement` | 回退固定模板／原始資料 |
| RAG／Agent Workflow | `ai-exclusive-premium` | 不得阻斷核心流程 |
| Prompt／Token／模型治理 | `governance-control` | AI 啟用時必須可追蹤 |

---

## 4. 現有推薦降級行為

目前推薦能力採快取優先：

```text
讀取分類 JSON 快取
→ 命中：直接回傳，不呼叫 LLM
→ 未命中：載入正式行情候選
→ 嘗試 LLM
→ LLM 失敗：使用規則式三角色推薦
→ 持久保存結果
```

重要邊界：

- 快取存在時，LLM 呼叫次數必須為 0。
- LLM 失敗不得讓整個 Dashboard 崩潰。
- 正式環境快取使用耐久儲存，不得依賴短命本機檔案。
- 快取損壞、資料不足與後端設定錯誤必須清楚區分。
- 規則備援也必須標記生成來源，不得冒充 LLM 結果。

---

## 5. AI 失效情境與正式行為

### 5.1 API Key 缺失或失效

```text
AI request unavailable
→ 記錄設定錯誤
→ 使用規則式推薦或固定模板
→ 核心查價與資料功能保持可用
```

### 5.2 Token 或預算耗盡

```text
budget exhausted
→ 停止新 LLM 呼叫
→ 優先讀取既有快取
→ 無快取時使用規則備援
→ 顯示「AI 增強暫停」而非整站故障
```

### 5.3 Timeout 或模型服務中斷

- 終止本次 AI 等待。
- 不重複寫入資料。
- 回退規則推薦。
- 保留使用者目前畫面與選擇。
- 記錄 Timeout、分類與耗時。

### 5.4 模型輸出格式錯誤

- 執行 Schema Validation。
- 不合法內容不得寫入正式快取。
- 使用規則結果建立合法文件。
- 記錄錯誤類型，不記錄 Secret 或敏感輸入。

### 5.5 R2 快取不可用

正式環境不得把結果偽裝成已保存：

```text
recommendation generated
+ durable cache write failed
→ 回報服務暫時不可用
→ 不標記 cache success
→ 不產生錯誤的持久化承諾
```

### 5.6 AI Feature Flag 關閉

- AI 按鈕或標籤顯示停用狀態。
- 標準版功能仍可使用。
- 不發出背景 LLM 請求。
- 不要求使用者輸入 API Key 才能使用核心系統。

---

## 6. 資料所有權

Product Core 擁有：

- 會員與角色
- 商品與行情
- 收藏與菜籃
- 貼文、留言與通知
- 點數與優惠券
- 正式狀態與 Audit

AI 層只擁有或產生：

- 建議
- 草稿
- 解釋
- 信心或來源資訊
- Prompt／Model／Token Metadata

AI 建議不得直接覆蓋正式行情、會員權限、點數餘額、優惠券庫存或貼文狀態。

---

## 7. UI 狀態要求

前台與 Dashboard 必須能區分：

- `AI Available`
- `Cache Result`
- `Rule Fallback`
- `AI Temporarily Unavailable`
- `Data Unavailable`
- `Permission Denied`

禁止把所有錯誤都顯示成「AI 無法使用」，也禁止 AI 不可用時留下無限 Loading。

---

## 8. 驗收測試

### Gate A｜標準版獨立運作

測試環境移除或停用所有 LLM Key：

- App 可以啟動。
- 登入與角色權限可測試。
- 查價、商品、菜籃、收藏、互助網與通知不因 AI 設定而崩潰。
- 推薦可讀快取或回退規則模式。
- UI 清楚顯示 AI 增強狀態。

### Gate B｜AI 增幅

- 啟用 AI 後產生三角色差異化推薦。
- 快取命中不再次呼叫 LLM。
- 結果包含來源、生成時間與 Prompt Set Version。
- Token、延遲與失敗可追蹤。

### Gate C｜故障降級

至少模擬：

- 無 API Key
- 401／403
- 429
- Timeout
- 非法 JSON
- R2 讀取失敗
- R2 寫入失敗

每個情境都必須證明核心流程仍可運作，或清楚標示真正受阻範圍。

---

## 9. 目前已知缺口

本文件建立的是正式架構契約，不代表所有 Gate 已完成執行。

尚需 Evidence：

- AI 全關閉的完整前台與後台回歸測試。
- Production-like 環境的規則推薦驗證。
- Token Budget Exhaustion 測試。
- UI 的 AI 狀態與 Fallback 標示盤點。
- Flagship AI Gateway、Prompt Registry、Token Ledger 與 Agent Workflow 實作。

未取得 Evidence 前，`.ai-company/status-snapshot.yaml` 必須維持 `not-tested`、`planned` 或 `partial`，不得宣稱旗艦版完成。
