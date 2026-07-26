# SmartBuy AI 推薦 JSON 快取架構

## 快取與生成流程

推薦 API 依白名單分類產生相對快取鍵，例如 `v1/leafy-vegetables.json`。正式 R2 Object Key 為 `recommendations/v1/leafy-vegetables.json`。流程固定為：

```text
分類白名單 → 讀 R2 JSON → 驗證 schema → 直接回傳
                         ↓ 不存在
              process 內 per-category lock
                         ↓
              PostgreSQL advisory lock
                         ↓
                    再讀一次 R2
                         ↓ 仍不存在
              LLM 一次／失敗則規則備援
                         ↓
              驗證 → create-if-absent 寫入
```

同分類 JSON 存在時，LLM 呼叫必須是 0 次；JSON 損壞時只回傳錯誤，不自動修復或覆寫。重新讀取 API 只能重新 GET，沒有 force、refresh 或 delete endpoint。

跨多個 Render instance 時，以 PostgreSQL session-level advisory lock 序列化同分類生成。等待者取得鎖後必須重新讀取 R2；若前一個 instance 已完成寫入，等待者直接回傳 JSON，不得再次呼叫 LLM。等待超過 `RECOMMENDATION_LOCK_TIMEOUT_SECONDS` 時回傳 503，不以重打 LLM 作為備援。

## 儲存與環境

- 正式環境：Cloudflare R2，必須設定 `R2_REQUIRED=true`；Render 亦被程式視為嚴格環境，不得退回本機檔案。
- 正式跨 instance 鎖：使用既有 PostgreSQL／Supabase `DATABASE_URL` 與 advisory lock，不需新增資料表。
- 本機／測試：`RECOMMENDATION_CACHE_BACKEND=local` 或未設定 R2 時使用 `.cache/recommendations`。
- R2 prefix：`R2_RECOMMENDATION_PREFIX=recommendations/v1/`。
- LLM 使用 OpenAI-compatible chat completions；沒有 API key、timeout、錯誤或格式不合法時使用規則備援，仍需寫入快取。

## 觀測欄位

API 回傳 `cache_hit`、`llm_called`、`generation_source`、`generated_at`、`cache_backend`、`source_name` 與資料日期。Log 可記錄分類、cache key、backend、生成器、耗時與錯誤類型，不得記錄 API key、Cookie、JWT 或完整 prompt。
