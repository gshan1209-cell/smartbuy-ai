# SmartBuy AI｜輕裝失效與降級契約

## 1. 目的

SmartBuy 採用 **AI 動力裝甲架構**，目前只安裝輕裝 `light`：

```text
沒有 AI，Product Core 仍能完成核心採買與營運任務；
啟用輕裝後，系統可呼叫 LLM 並取得結構化推薦 JSON。
```

AI 不得成為登入、查價、商品管理、菜籃、互助網、通知或正式資料存取的單點故障。

---

## 2. Product Core

不需要 LLM Token，核心能力包括：

- 會員登入、註冊、登出與角色權限。
- 農產品行情查詢與商品詳細資訊。
- 收藏、菜籃、提醒與通知。
- 二十四節氣、當季資訊與固定內容。
- 互助網貼文、留言、按讚與圖片。
- 農民、商家與管理員後台的非 AI 操作。
- 規則式採買建議與固定模板。
- 既有統計、異常判斷與傳統機器學習預測。
- 人工操作、人工審核與人工發布入口。

Product Core 是正式產品，不是裝甲版本。

---

## 3. 輕裝能力

SmartBuy 目前唯一正式 AI 能力：

```text
分類行情資料
→ LLM Request
→ 三角色 Structured JSON
→ Schema Validation
→ Durable Cache
→ Rule Fallback
```

輸出對象：

- consumer
- farmer
- merchant

輕裝不包含也不要求：

- RAG／Knowledge Base。
- 多 Agent。
- Tool Calling。
- 完整 AI Gateway。
- 全域 Token Ledger。
- 複雜模型路由。
- 旗艦治理後台。

---

## 4. 現有推薦降級行為

```text
讀取分類 JSON 快取
→ 命中：直接回傳，不呼叫 LLM
→ 未命中：載入正式行情候選
→ 嘗試 LLM JSON
→ Parse and Schema Validate
→ 合法：持久保存
→ 失敗：使用規則式同格式 JSON
```

重要邊界：

- 快取存在時，LLM 呼叫次數必須為 0。
- 不合法 JSON 不得寫入正式快取。
- LLM 失敗不得讓 Dashboard 崩潰。
- 正式環境快取使用耐久儲存。
- 快取損壞、資料不足與 Provider 錯誤必須清楚區分。
- 規則備援必須標記 `source: rule-fallback`。

---

## 5. AI 失效情境

### 5.1 API Key 缺失或失效

```text
AI request unavailable
→ 記錄設定錯誤
→ 回傳規則式 JSON
→ 核心查價與資料功能保持可用
```

### 5.2 Rate Limit 或預算耗盡

```text
429 or budget exhausted
→ 停止本次 LLM 呼叫
→ 優先使用既有快取
→ 無快取時使用規則式 JSON
→ 顯示 AI 增強暫停
```

### 5.3 Timeout 或 Provider 中斷

- 終止本次等待。
- 保留使用者畫面與選擇。
- 不重複寫入資料。
- 回傳規則式同格式 JSON。
- 記錄 Error Type 與 Duration。

### 5.4 非法 JSON 或 Schema 錯誤

- 執行 JSON Parse 與 Schema Validation。
- 不合法內容不得寫入快取。
- 使用規則結果建立合法文件。
- 不記錄 Secret 或敏感輸入。

### 5.5 R2 快取不可用

- 不得把未成功保存的結果標記為 cache success。
- 依現有產品政策回傳暫時結果或服務狀態。
- 記錄 Cache Read／Write Failure。
- Product Core 其他功能保持可用。

### 5.6 AI Feature Flag 關閉

- 不發出 LLM Request。
- 使用快取、規則或固定模板。
- UI 顯示 AI 輕裝目前未啟用。
- 不要求使用者輸入 API Key 才能使用核心系統。

---

## 6. JSON Contract

所有來源使用相同 Contract：

```json
{
  "category": "葉菜類",
  "source": "llm",
  "prompt_version": "v1",
  "schema_version": "v2",
  "recommendations": {
    "consumer": {
      "summary": "...",
      "action": "..."
    },
    "farmer": {
      "summary": "...",
      "action": "..."
    },
    "merchant": {
      "summary": "...",
      "action": "..."
    }
  }
}
```

合法 `source`：

- `llm`
- `cache`
- `rule-fallback`

---

## 7. 資料所有權

Product Core 擁有：

- 會員與角色。
- 商品與行情。
- 收藏與菜籃。
- 貼文、留言與通知。
- 點數與優惠券。
- 正式狀態與 Audit。

輕裝只產生：

- 建議 JSON。
- 解釋與行動建議。
- Provider／Model／Prompt／Schema Metadata。

AI 建議不得直接覆蓋正式行情、會員權限、點數餘額、優惠券庫存或貼文狀態。

---

## 8. UI 狀態

前台與 Dashboard 必須能區分：

- `AI Result`
- `Cache Result`
- `Rule Fallback`
- `AI Temporarily Unavailable`
- `Data Unavailable`
- `Permission Denied`

禁止 AI 不可用時留下無限 Loading。

---

## 9. 驗收測試

### Core Gate

- 移除所有 LLM Key 後 App 可以啟動。
- 登入、查價、商品、菜籃、收藏、互助網與通知不崩潰。
- 不發出背景 LLM Request。

### Light JSON Gate

- 啟用 LLM 後產生三角色 JSON。
- 合法 JSON 通過 Schema。
- 非法 JSON 被拒絕。
- 快取命中不再次呼叫 LLM。
- 結果包含來源、生成時間、Prompt Version 與 Schema Version。

### Failure Gate

至少模擬：

- Missing API Key。
- 401／403。
- 429。
- Timeout。
- Provider 5xx。
- Empty Response。
- Invalid JSON。
- R2 Read／Write Failure。

重裝與旗艦 Gate 對 SmartBuy 為 `not-applicable`。

---

## 10. 已知缺口

本文件是正式契約，不代表所有 Gate 已執行。

尚需 Evidence：

- AI 全關閉的完整前台與後台回歸。
- Production-like 規則推薦驗證。
- Invalid JSON 與 Timeout 自動測試。
- UI 的 AI 狀態與 Fallback 標示盤點。
- Render 後端健康驗證。

未取得 Evidence 前，`.ai-company/status-snapshot.yaml` 必須維持 `not-tested` 或 `partial`。
