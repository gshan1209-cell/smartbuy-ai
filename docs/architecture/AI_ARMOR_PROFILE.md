# SmartBuy AI｜輕裝 Light Armor Profile

## 1. 定位

SmartBuy 目前只採用 **輕裝 `light`**。

```text
Product Core
+ LLM JSON Port
+ Provider Adapter
+ Structured JSON
+ Schema Validation
+ Cache
+ Rule Fallback
```

SmartBuy 不需要也不宣告：

- 重裝 `heavy`
- 旗艦 `flagship`
- RAG
- 向量資料庫
- 多 Agent
- 跨工具自主操作
- 完整 AI Gateway
- 全域 Token Ledger
- 複雜模型路由

未來只有在真實產品需求出現時，才另行建立升級 Decision。

---

## 2. Product Core

即使 AI 完全關閉，以下功能仍必須可用：

- 會員與角色權限。
- 農產品行情查詢。
- 商品、菜籃、收藏與提醒。
- 二十四節氣與固定內容。
- 互助網、通知與設定。
- 農民、商家與管理員的非 AI 操作。
- 規則式推薦與固定模板。
- 統計、異常判斷與傳統機器學習預測。

Product Core 是正式產品，不是裝甲版本。

---

## 3. 唯一輕裝能力

```yaml
capabilityId: role-recommendation-json
armorProfile: light
mode: request-response
outputType: structured-json
fallback: rule-recommendation
cachePolicy: cache-first-create-if-absent
```

用途：

- 對同一農產品分類產生消費者、農民與商家三角色建議。
- 回傳固定 JSON Contract。
- 同分類已有有效 JSON 時，不再次呼叫 LLM。

---

## 4. 最小元件

```text
src/ai/
├─ ports/llm_json_port.py
├─ adapters/provider_adapter.py
├─ validators/recommendation_validator.py
├─ schemas/role_recommendation_v2.schema.json
├─ fallbacks/rule_recommendation.py
└─ errors.py
```

實際檔案可以依現有專案結構調整，但責任不得混在 Product Domain 中。

### LLM JSON Port

```python
class LlmJsonPort(Protocol):
    async def generate_json(
        self,
        *,
        prompt_id: str,
        input_data: dict,
        schema_id: str,
    ) -> dict:
        ...
```

Product Service 不直接依賴單一 Provider SDK。

---

## 5. JSON Contract

回覆最低包含：

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

合法來源：

- `llm`
- `cache`
- `rule-fallback`

JSON 必須先通過：

1. Parse。
2. JSON Schema Validation。
3. Category Validation。
4. Required Role Validation。
5. Length／Empty Value Validation。
6. Business Rule Validation。

未通過不得寫入正式快取。

---

## 6. 執行流程

```text
讀取分類 JSON 快取
→ 命中：直接回傳，LLM calls = 0
→ 未命中：載入正式行情輸入
→ 呼叫 LLM JSON Port
→ Schema Validation
→ 合法：create-if-absent 寫入快取
→ 失敗：回傳規則式同格式 JSON
```

---

## 7. Fallback

以下情況回退 `rule-fallback`：

- API Key 缺失。
- 401／403。
- 429 或預算耗盡。
- Timeout。
- Provider 5xx。
- 空回覆。
- 非法 JSON。
- Schema 不合法。

Fallback 必須回傳相同 JSON Contract，前端不需要切換另一套資料結構。

---

## 8. 最小 Metadata

只記錄：

- Provider。
- Model。
- Prompt Version。
- Schema Version。
- Generated At。
- Source。
- Cache Hit。
- Fallback Used。
- Duration。
- Token Usage，若 Provider 提供。
- Error Type。

不要求完整 AI 成本中心或 Token Ledger。

---

## 9. 輕裝驗收

### Core Gate

- 無 LLM Key 可以啟動。
- 核心功能可以操作。
- 不發出背景 LLM Request。

### Light JSON Gate

- 合法回覆通過 Schema。
- 非法回覆被拒絕。
- Cache 命中不呼叫 LLM。
- 三角色欄位完整。
- `source` 正確標記。

### Failure Gate

至少模擬：

- Missing Key。
- 401／403。
- 429。
- Timeout。
- Empty Response。
- Invalid JSON。
- Cache Read／Write Failure。

重裝與旗艦 Gate 對 SmartBuy 均為 `not-applicable`。
