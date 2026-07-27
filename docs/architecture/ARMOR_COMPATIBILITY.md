# SmartBuy AI｜原裝至輕裝相容性契約

## 目標

SmartBuy 的正式目標是 Light Armor，不是 Heavy 或 Flagship。

```text
原裝 Product Core
→ 輕裝 role-recommendation-json
```

目前正式階段仍是 `original`。只有 LLM JSON Pack、FastAPI Adapter、UI Adapter、Conformance Test 與 Armor Lock 全部完成後，才能升為 `light`。

## 原裝 Core

無 AI 仍可使用：

- Auth／RBAC
- 行情與商品查詢
- 菜籃與收藏
- 互助網與通知
- 節氣內容
- 規則式推薦
- 人工後台操作

## 輕裝能力

```text
Market／Category Input
→ LLM JSON Port
→ Provider Adapter
→ Structured JSON
→ Schema Validation
→ Cache
→ Rule Fallback
→ UI
```

## 必要 Contract

- `identity-context-v1@1.0`
- `capability-invocation-v1@1.0`
- `evidence-audit-v1@1.0`
- `health-fallback-v1@1.0`
- `ui-slot-v1@1.0`

不適用：

- Event Bus
- RAG
- Multi-Agent
- Full AI Gateway
- Approval Orchestration
- Global Token Ledger

## 升級條件

1. `smartbuy-fastapi-llm-json-adapter` 具版本與測試。
2. `smartbuy-react-recommendation-ui-adapter` 具版本與狀態測試。
3. Input／Output Schema 完整。
4. Cache 命中時 LLM 呼叫數為 0。
5. Missing Key、429、Timeout、Invalid JSON、Empty Response 可回退。
6. Core 功能在 AI 關閉時通過回歸。
7. Compatibility Report 結果為 `compatible` 或核准的 `adapter-required`。
8. `.ai-company/armor-lock.yaml` 鎖定 Pack／Adapter 版本。
9. Release Record 與 Rollback Evidence 完整。

## 升級完成狀態

完成後才能更新：

```yaml
currentArmorStage: light
```

若 Pack 或 Adapter 失效，系統必須回退：

```text
light → original
```

且不影響 SmartBuy Product Core。
