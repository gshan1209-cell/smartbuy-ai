# SmartBuy AI｜AI 推薦儀表板與 JSON 分類快取開發規格書

> 文件用途：交由 Codex 依本規格開發。  
> 任務性質：功能新增，不是全站重構。  
> 目標分支建議：`feat/ai-recommendation-dashboard-cache`。  
> 開發前必讀：`AGENT.md`、`docs/architecture/PROJECT_STRUCTURE.md`、`docs/uiux/DASHBOARD_VISUAL_STYLE_REFERENCE.md`。

---

## 1. 功能目標

新增一套 **AI 採買推薦功能**，並在後台 Dashboard 建立獨立的「AI 推薦」頁面，提供同類農產品的採買建議、價格狀態摘要、替代品方向與推薦理由。

本功能必須具備以下核心能力：

1. 依「品項種類／分類」產生 AI 推薦。
2. 同一分類只產生一份 JSON 推薦快取。
3. 若該分類 JSON 已存在，必須直接讀取快取，**禁止再次呼叫 LLM**。
4. 快取必須可跨 Render 重啟與重新部署持續存在，不得只依賴 Render 本機暫存檔案。
5. 儀表板必須清楚顯示資料來源、快取狀態、生成時間與是否曾呼叫 LLM。
6. LLM 失敗時不得讓整頁故障，應提供可辨識的規則式備援結果。

---

## 2. 開發範圍

### 2.1 本次必做

- 新增 AI 推薦領域服務。
- 新增分類正規化與快取鍵產生器。
- 新增 JSON 快取 Repository 抽象層。
- 新增 Cloudflare R2 JSON 持久快取。
- 新增本機 JSON 快取，供測試與本機開發。
- 新增 AI 推薦 API。
- 新增 Dashboard「AI 推薦」導覽與頁面。
- 新增 `recommendations.view` 權限。
- 新增後端單元測試、API 測試與快取行為測試。
- 驗證前端 build 與三尺寸 RWD。
- 更新必要的環境變數範例與技術文件。

### 2.2 本次不做

- 不建立聊天機器人。
- 不建立向量資料庫或 RAG。
- 不重訓 LightGBM。
- 不改動既有價格預測模型。
- 不新增會員訂閱或付費方案。
- 不建立自動排程刷新推薦。
- 不允許前端提供「忽略快取、強制呼叫 LLM」按鈕。
- 不大幅重構現有 Dashboard、Router 或資料層。
- 不用 Mock 資料取代正式行情 API。

---

## 3. 使用者角色與權限

新增權限：

```text
recommendations.view
```

預設權限矩陣：

| 角色 | AI 推薦 Dashboard |
|---|---|
| consumer | 不開放後台頁面 |
| farmer | 可檢視 |
| merchant | 可檢視 |
| admin | 可檢視 |

後端 API 必須執行 RBAC 驗證，不能只靠前端隱藏選單。

---

## 4. 使用情境

### 情境 A：分類從未產生推薦

1. 使用者進入 `/dashboard/recommendations`。
2. 前端取得可用分類。
3. 使用者選擇「葉菜類」。
4. 後端將分類正規化為穩定快取鍵。
5. 後端先查 R2 是否已有對應 JSON。
6. 確認不存在後，才整理行情資料並呼叫 LLM。
7. 驗證 LLM JSON 格式。
8. 將結果寫入 R2 JSON。
9. API 回傳推薦內容，並標示 `cache_hit=false`、`llm_called=true`。

### 情境 B：分類已產生推薦

1. 使用者再次選擇「葉菜類」。
2. 後端查到 R2 已存在 JSON。
3. 後端直接讀取 JSON 並回傳。
4. **不得執行 LLM client、不得計算新 Prompt、不得覆寫既有 JSON。**
5. API 回傳 `cache_hit=true`、`llm_called=false`。

### 情境 C：快取檔存在但內容損壞

1. 後端偵測到物件存在。
2. JSON 解析或 Schema 驗證失敗。
3. API 回傳明確錯誤或「快取損壞」狀態。
4. **不得因解析失敗自動呼叫 LLM。**
5. 由管理者人工刪除或修復快取後，才允許重新生成。

### 情境 D：LLM 呼叫失敗

1. 快取不存在。
2. LLM timeout、API error 或回傳格式錯誤。
3. 系統產生規則式備援推薦。
4. 備援結果同樣寫入 JSON 快取，並標示 `generator=rules-fallback`。
5. 前端清楚顯示「規則備援」，不得假裝為 AI 成功生成。

---

## 5. 分類與快取鍵設計

### 5.1 初版分類

初版至少提供以下分類：

| Cache Key | 顯示名稱 | 範例品項 |
|---|---|---|
| `leafy-vegetables` | 葉菜類 | 高麗菜、白菜、菠菜、空心菜、青江菜 |
| `fruit-vegetables` | 果菜類 | 番茄、茄子、瓜類、甜椒、豆類 |
| `root-vegetables` | 根莖類 | 蘿蔔、馬鈴薯、洋蔥、薑、蒜、筍類 |
| `fruit` | 水果類 | 香蕉、鳳梨、芒果、柑橘、瓜果 |
| `mushrooms` | 菇菌類 | 香菇、金針菇、杏鮑菇、木耳 |

分類定義需集中管理，禁止散落在 Router、React 頁面與 Prompt 中各自維護。

建議位置：

```text
src/recommendation/category_catalog.py
```

### 5.2 快取鍵規則

快取鍵只能使用經過白名單驗證的穩定英文 slug：

```text
{schema_version}/{category_key}.json
```

R2 Object Key 建議：

```text
recommendations/v1/leafy-vegetables.json
recommendations/v1/fruit-vegetables.json
recommendations/v1/root-vegetables.json
recommendations/v1/fruit.json
recommendations/v1/mushrooms.json
```

禁止直接使用使用者輸入作為檔名，避免路徑注入、同義詞重複與大小寫不一致。

### 5.3 快取失效策略

本需求的最高優先規則是：

> 只要該分類 JSON 檔案存在，就不得再次呼叫 LLM。

因此初版不實作 TTL 自動失效。

需要重新生成時，只能採用以下其中一種人工方式：

1. 管理者刪除指定 R2 JSON。
2. 未來升級 `schema_version`，改用新目錄，例如 `recommendations/v2/`。
3. 透過獨立管理工具執行明確的 invalidate 動作；本 PR 不提供此功能。

禁止：

- 依日期自動刷新。
- 依行情資料變動自動覆寫。
- 因 JSON 格式錯誤自動重打 LLM。
- 因前端重新整理而重打 LLM。
- 因 API timeout 而重打 LLM 多次。

---

## 6. 持久化快取架構

### 6.1 為什麼不能只用 Render 本機檔案

Render 服務重新部署或重啟後，本機檔案可能消失。若只用本機 JSON，系統會誤判快取不存在並再次呼叫 LLM，違反成本保護要求。

因此正式環境必須使用 **Cloudflare R2 JSON 物件**作為主要快取來源。

專案已有 R2 S3 相容連線與 `boto3` 依賴，應沿用既有環境變數與客戶端建立方式，不另建第二套重複設定。

### 6.2 Repository 抽象

建議新增：

```text
src/recommendation/cache_repository.py
```

介面至少包含：

```python
class RecommendationCacheRepository(Protocol):
    def exists(self, cache_key: str) -> bool: ...
    def read(self, cache_key: str) -> dict: ...
    def create_if_absent(self, cache_key: str, payload: dict) -> bool: ...
```

實作：

```text
R2RecommendationCacheRepository
LocalRecommendationCacheRepository
```

用途：

- 正式環境：R2。
- 本機開發與單元測試：Local JSON 或記憶體 Fake。
- Service 不得直接依賴 `boto3`。

### 6.3 防止同時重複生成

只做「先 exists 再生成」仍可能發生併發競態：兩個請求同時發現不存在，然後同時呼叫 LLM。

Codex 必須加入同分類單航班控制，至少達成：

- 同一 Python process 內，同分類同時間只能有一個生成工作。
- 第一個請求生成期間，其他請求等待同一結果，不得再次呼叫 LLM。
- 寫入前再次檢查 R2 是否已存在。
- `create_if_absent` 必須避免無條件覆寫既有物件。

可使用 `asyncio.Lock` 或 per-key lock registry，但不得建立無上限永久累積的 lock map。

跨多實例完全原子鎖定若無法在本 PR 穩定完成，需在 PR 說明限制；至少要有「寫入前二次檢查」與單實例鎖。

---

## 7. JSON Schema

快取 JSON 至少包含：

```json
{
  "schema_version": 1,
  "cache_key": "leafy-vegetables",
  "category": {
    "key": "leafy-vegetables",
    "label": "葉菜類",
    "description": "高麗菜、白菜、菠菜等葉菜"
  },
  "generated_at": "2026-07-26T00:00:00Z",
  "generator": "llm",
  "provider": "configured-provider",
  "model": "configured-model",
  "input_digest": "sha256-short-digest",
  "source_summary": {
    "candidate_count": 12,
    "latest_trade_date": "2026-07-25",
    "historical_data": false
  },
  "recommendation": {
    "summary": "近期葉菜類以部分價格正常或偏低品項較適合採買。",
    "market_outlook": "依目前行情資料提供保守判斷。",
    "shopping_strategy": "優先採買價格正常或便宜品項，偏貴品項少量購入。",
    "items": [
      {
        "product_name": "高麗菜",
        "market_name": "台北一",
        "price_status": "便宜",
        "today_price": 25.5,
        "recent_average": 31.2,
        "action": "優先採買",
        "reason": "今日價格低於近期平均。",
        "priority": "high",
        "substitute": null
      }
    ]
  }
}
```

### 7.1 Schema 規則

- `schema_version` 必填且必須相符。
- `cache_key` 必須等於要求分類。
- `generated_at` 必須為 UTC ISO 8601。
- `generator` 僅允許：
  - `llm`
  - `rules-fallback`
- `priority` 僅允許：
  - `high`
  - `medium`
  - `low`
- `items` 最多 6 筆。
- LLM 不得推薦輸入資料不存在的品項。
- 不得虛構價格、產地、營養、食安或供應資訊。
- `provider`、`model` 不得回傳 API Key 或敏感設定。

建議使用 Pydantic Schema 驗證 LLM 回傳與快取讀取結果。

---

## 8. 推薦資料來源與規則

### 8.1 輸入來源

優先沿用現有正式資料：

- `price_cache["prices"]`
- `get_all_price_statuses(...)`
- 現有價格狀態：便宜、正常、偏貴、資料不足
- 今日價格
- 近期平均
- 市場名稱
- 最新交易日期
- 歷史資料標記

不得新增一套重複的行情讀取流程。

### 8.2 候選品項排序

送給 LLM 前先由規則層篩選與排序：

1. 便宜
2. 正常
3. 偏貴
4. 資料不足

同狀態下可再依：

- 資料新鮮度
- 今日價與近期平均差距
- 品項名稱穩定排序

限制送入 LLM 的候選數，建議最多 12 項，避免 Prompt 無限制增長。

### 8.3 LLM 輸出限制

Prompt 必須要求：

- 只輸出 JSON。
- 只能使用輸入中的品項。
- 採保守、可執行的採買建議。
- 不得虛構缺少的資料。
- 不提供醫療、營養療效或保證性價格預測。
- 最多推薦 6 項。

LLM Client 必須可替換，不應將特定供應商 SDK 散落在業務 Service。

建議環境變數：

```text
RECOMMENDATION_LLM_PROVIDER=
RECOMMENDATION_LLM_MODEL=
RECOMMENDATION_LLM_API_KEY=
RECOMMENDATION_LLM_TIMEOUT_SECONDS=45
R2_RECOMMENDATION_PREFIX=recommendations/v1/
```

若專案已有統一 LLM Gateway 或環境命名，優先沿用，不建立重複設定。

---

## 9. 後端模組建議

依現有分層，建議新增：

```text
backend/
└─ routers/
   └─ recommendations.py

src/
└─ recommendation/
   ├─ category_catalog.py
   ├─ recommendation_models.py
   ├─ recommendation_service.py
   ├─ cache_repository.py
   ├─ r2_recommendation_cache.py
   ├─ local_recommendation_cache.py
   └─ llm_recommendation_client.py
```

責任分界：

- Router：HTTP 參數、RBAC、狀態碼、Response。
- Service：快取優先、分類整理、生成流程、備援流程。
- Repository：R2 或本機 JSON 存取。
- LLM Client：供應商 API 與 timeout。
- Models：Pydantic 驗證。
- Catalog：分類與關鍵字集中定義。

禁止把全部邏輯放進單一 Router 檔案。

---

## 10. API 規格

### 10.1 取得分類

```http
GET /api/recommendations/categories
```

權限：`recommendations.view`

成功：

```json
{
  "categories": [
    {
      "key": "leafy-vegetables",
      "label": "葉菜類",
      "description": "高麗菜、白菜、菠菜等葉菜"
    }
  ]
}
```

### 10.2 取得分類推薦

```http
GET /api/recommendations?category=leafy-vegetables
```

權限：`recommendations.view`

成功：

```json
{
  "cache_hit": true,
  "llm_called": false,
  "cache_backend": "r2",
  "data": {
    "schema_version": 1,
    "cache_key": "leafy-vegetables",
    "generated_at": "2026-07-26T00:00:00Z",
    "generator": "llm",
    "recommendation": {}
  }
}
```

錯誤狀態：

| 狀態碼 | 情況 |
|---:|---|
| 401 | 未登入 |
| 403 | 無權限 |
| 422 | 不支援的分類 |
| 500 | 快取存在但損壞、R2 讀取失敗或無法安全完成 |
| 503 | 快取不存在且 LLM 與備援流程皆無法完成 |

### 10.3 禁止提供的 API

本 PR 不得提供：

```http
POST /api/recommendations/refresh
GET /api/recommendations?force=true
DELETE /api/recommendations/cache
```

避免一般前端操作繞過快取。

---

## 11. Dashboard 頁面規格

### 11.1 路由與導覽

新增：

```text
/dashboard/recommendations
```

Sidebar 名稱：

```text
AI 推薦
```

建議圖示：`Sparkles`、`BrainCircuit` 或 `ShoppingBasket`。

位置建議：放在「AI 預測」之後、「天氣風險」之前。

### 11.2 頁面資訊架構

Desktop 建議版面：

```text
┌──────────────────────────────────────────────────────────────┐
│ AI 採買推薦                     [重新讀取快取]               │
│ 依同類行情提供採買策略；已有 JSON 時不再呼叫 LLM             │
├──────────────────────────────────────────────────────────────┤
│ 分類 Chips：葉菜｜果菜｜根莖｜水果｜菇菌                    │
├─────────────┬─────────────┬─────────────┬────────────────────┤
│ 推薦分類     │ 生成來源     │ 快取狀態     │ 候選品項           │
├──────────────────────────────────────┬───────────────────────┤
│ AI 推薦摘要／市場展望／採買策略       │ JSON 成本保護說明      │
├──────────────────────────────────────────────────────────────┤
│ 推薦品項卡片 1｜卡片 2｜卡片 3                               │
│ 推薦品項卡片 4｜卡片 5｜卡片 6                               │
└──────────────────────────────────────────────────────────────┘
```

### 11.3 必顯示資訊

- 分類名稱。
- 推薦摘要。
- 市場展望。
- 採買策略。
- 推薦品項。
- 行動建議。
- 推薦理由。
- 優先級。
- 替代品，沒有則顯示「暫無必要」。
- JSON 建立時間。
- 生成來源：LLM 或規則備援。
- 快取來源：R2 或 local。
- 快取狀態：
  - `JSON 快取命中`
  - `本次建立快取`
  - `快取損壞`
- 本次是否呼叫 LLM。

### 11.4 「重新讀取快取」按鈕

此按鈕只能重新 GET API，不能：

- 刪除 JSON。
- 忽略快取。
- 重新生成。
- 呼叫 refresh endpoint。

按鈕文字應為「重新讀取快取」，避免使用者誤解為重新生成 AI 內容。

### 11.5 RWD

- Desktop：4 欄 KPI，推薦卡片 3 欄。
- Tablet：2 欄 KPI，推薦卡片 2 欄。
- Mobile：1 欄 KPI，推薦卡片 1 欄；分類 Chips 可橫向捲動或換行。
- Mobile 不得產生橫向頁面溢位。
- Loading、Empty、Partial Error、Fatal Error 都需有畫面。
- 深色模式必須可讀。

### 11.6 視覺規則

遵循 `DASHBOARD_VISUAL_STYLE_REFERENCE.md`：

- 使用既有 Dashboard Layout。
- 優先重用既有 shared 與 dashboard components。
- 不建立第二套 Button、Badge、EmptyState。
- 不使用假 KPI 填滿畫面。
- 綠色：主要操作與正常。
- 黃橘色：規則備援或注意。
- 紅色：快取損壞與致命錯誤。
- 藍色：資訊狀態。

---

## 12. 錯誤處理與觀測

### 12.1 必須記錄

後端 structured log 至少包含：

- `category`
- `cache_key`
- `cache_backend`
- `cache_hit`
- `llm_called`
- `generator`
- `duration_ms`
- `error_type`

禁止記錄：

- API Key
- 完整認證 Header
- 使用者 Cookie
- 過長 Prompt 全文

### 12.2 成本保護指標

至少保留可測試的統計事件：

```text
recommendation_cache_hit
recommendation_cache_miss
recommendation_llm_call
recommendation_fallback
recommendation_cache_corrupt
```

本 PR 可先用 log，不強制導入新的監控平台。

---

## 13. 測試規格

### 13.1 核心快取測試

必須驗證：

1. 快取存在時，LLM mock 呼叫次數為 0。
2. 快取不存在時，LLM mock 呼叫次數為 1。
3. 第一次成功生成並寫入後，第二次請求呼叫次數仍為 1，不得增加。
4. 同分類併發請求只呼叫 LLM 一次。
5. 不同分類各自使用不同 JSON。
6. 快取存在但 JSON 損壞時，LLM 呼叫次數為 0。
7. 快取 Schema 版本不符時，LLM 呼叫次數為 0。
8. LLM 失敗時產生規則備援，並寫入快取。
9. 規則備援快取存在後，下一次不得再次呼叫 LLM。
10. 不支援分類回傳 422。

### 13.2 R2 Repository 測試

- 正確組合 Object Key。
- `exists` 使用 `head_object` 或等價方式。
- `read` 正確解析 UTF-8 JSON。
- `create_if_absent` 不覆寫既有物件。
- R2 credential 缺少時，測試環境可切 Local/Fake；正式環境不得靜默退回易失性本機快取。

### 13.3 API 測試

- RBAC：consumer 403；farmer、merchant、admin 200。
- Response contract。
- `cache_hit` 與 `llm_called` 正確。
- 錯誤訊息不得洩漏 credential。

### 13.4 前端驗收

至少人工驗證：

- 1440 × 900。
- 834 × 1112。
- 390 × 844。
- 切換分類。
- Loading。
- 快取命中。
- 首次生成。
- 規則備援。
- 快取損壞。
- 深色模式。
- 權限不足。

---

## 14. 預計修改檔案

Codex 開發前應先確認實際引用，不得盲目覆寫。

預計新增：

```text
backend/routers/recommendations.py
src/recommendation/category_catalog.py
src/recommendation/recommendation_models.py
src/recommendation/recommendation_service.py
src/recommendation/cache_repository.py
src/recommendation/r2_recommendation_cache.py
src/recommendation/local_recommendation_cache.py
src/recommendation/llm_recommendation_client.py
frontend/src/pages/dashboard/DashboardRecommendations.jsx
frontend/src/lib/recommendationsApi.js
frontend/src/styles/dashboard-recommendations.css
tests/test_recommendation_cache.py
tests/test_recommendation_api.py
```

預計修改：

```text
backend/api/router.py
backend/security/roles.py
frontend/src/routes/AppRoutes.jsx
frontend/src/config/dashboardNavigation.js
frontend/src/config/permissions.js
.env.example 或對應環境變數文件
AGENT.md 或 README 的功能索引（只做必要更新）
```

不得將應用組裝重新塞回 `backend/main.py` 或 `frontend/src/App.jsx`。

---

## 15. 驗收條件 Definition of Done

以下全部完成才可提 PR：

- [ ] `/dashboard/recommendations` 可正常開啟。
- [ ] Sidebar 有「AI 推薦」。
- [ ] farmer、merchant、admin 可查看；consumer 不可查看。
- [ ] 至少 5 種分類可選。
- [ ] 快取鍵固定且經白名單驗證。
- [ ] R2 為正式環境持久 JSON 快取。
- [ ] JSON 存在時 LLM 呼叫次數為 0。
- [ ] 快取損壞時不會重新呼叫 LLM。
- [ ] 無 `force=true` 或一般使用者刷新 API。
- [ ] 同分類併發請求不重複呼叫 LLM。
- [ ] LLM 失敗有規則備援。
- [ ] 前端顯示 `cache_hit`、`llm_called`、生成來源與時間。
- [ ] 不使用 Mock 取代正式行情資料。
- [ ] Python tests 通過。
- [ ] 前端 `npm run build` 通過。
- [ ] Desktop、Tablet、Mobile 驗收完成。
- [ ] PR 說明包含實際測試命令與結果。
- [ ] PR 說明列出新增環境變數。
- [ ] 未刪除或縮減既有功能。

---

## 16. Codex 執行指令

將以下內容直接交給 Codex：

```text
請在 gshan1209-cell/smartbuy-ai 專案開發「AI 推薦儀表板與 JSON 分類快取」。

開始前依序閱讀：
1. AGENT.md
2. docs/architecture/PROJECT_STRUCTURE.md
3. docs/uiux/DASHBOARD_VISUAL_STYLE_REFERENCE.md
4. docs/spec/AI_RECOMMENDATION_DASHBOARD_JSON_CACHE_SPEC.md

請嚴格以規格書為準，建立單一功能分支與單一 PR。

最高優先規則：
- 同一分類只建立一份 JSON。
- JSON 已存在時，絕對不可再次呼叫 LLM。
- JSON 存在但損壞時，也不可自動呼叫 LLM。
- 正式環境快取必須使用 Cloudflare R2 持久保存，不能只存 Render 本機。
- 不得提供 force refresh 或繞過快取的前端功能與 API。
- 同分類併發請求必須避免重複呼叫 LLM。

請沿用目前的前後端分層、RBAC、Dashboard Layout、R2 設定與既有元件，不得把邏輯塞回 backend/main.py 或 frontend/src/App.jsx，也不得任意刪除現有功能。

完成後請：
1. 執行相關 Python tests。
2. 執行前端 npm run build。
3. 驗證 1440×900、834×1112、390×844。
4. 在 PR 說明列出：架構、API、快取流程、環境變數、測試結果、已知限制。
5. 若遇到規格與現況衝突，先保留既有功能並在 PR 明確說明，不得自行大改架構。
```

---

## 17. 架構決策摘要

本功能採用：

```text
行情資料
  ↓
分類與候選品項整理
  ↓
先查 R2 JSON
  ├─ 已存在 → 驗證並直接回傳 → LLM 0 次
  └─ 不存在 → per-category lock
                  ↓
              再查一次 R2
                  ├─ 已存在 → 直接回傳
                  └─ 不存在 → 呼叫 LLM 一次
                                  ├─ 成功 → 驗證 JSON → 寫入 R2
                                  └─ 失敗 → 規則備援 → 寫入 R2
```

此設計的核心不是「每次取得最新生成內容」，而是：

> **以持久 JSON 快取控制 LLM 成本，確保相同分類已生成後不重複付費。**
