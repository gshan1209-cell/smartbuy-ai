# SmartBuy AI 推薦 JSON 快取架構

## 快取與生成流程

推薦 API 依白名單分類產生相對快取鍵，例如 `v2/leafy-vegetables.json`。正式 R2 Object Key 為 `recommendations/v2/leafy-vegetables.json`。舊版 `recommendations/v1/` 保留不覆寫。

流程固定為：

```text
分類白名單 → 讀 R2 v2 JSON → 驗證 schema／提示語版本 → 直接回傳三角色結果
                             ↓ 不存在
                  process 內 per-category lock
                             ↓
                  PostgreSQL advisory lock
                             ↓
                        再讀一次 R2
                             ↓ 仍不存在
          建立 consumer／farmer／merchant 三套角色提示語
                             ↓
                單次 LLM 呼叫一次回傳三角色
                             ↓ 失敗或任一角色不合法
                    三角色規則備援
                             ↓
                  驗證 → create-if-absent 寫入
```

同分類 JSON 存在時，LLM 呼叫必須是 0 次；JSON 損壞、schema version 不符或 `prompt_set_version` 不符時只回傳錯誤，不自動修復或覆寫。重新讀取 API 只能重新 GET，沒有 force、refresh 或 delete endpoint。

跨多個 Render instance 時，以 PostgreSQL session-level advisory lock 序列化同分類生成。等待者取得鎖後必須重新讀取 R2；若前一個 instance 已完成寫入，等待者直接回傳 JSON，不得再次呼叫 LLM。等待超過 `RECOMMENDATION_LOCK_TIMEOUT_SECONDS` 時回傳 503，不以重打 LLM 作為備援。

## 三角色提示語

提示語集中於 `src/recommendation/role_prompts.py`，目前版本為：

```text
three-role-v1
```

正式角色：

- `consumer`：家庭採買端，聚焦預算、採買時機、購買量與替代品。
- `farmer`：農業生產端，聚焦採收、分批出貨、成本核對與行情風險。
- `merchant`：通路銷售端，聚焦分批補貨、庫存風險、替代品與銷售方向。

三套提示語會放入同一個 prompt envelope，單次 LLM 請求必須一次回傳：

```text
role_recommendations.consumer
role_recommendations.farmer
role_recommendations.merchant
```

任一角色缺少、格式不合法、竄改候選價格或使用不存在的品項時，整份 LLM 輸出視為失敗，改用三角色規則備援。不得為三個角色分別呼叫三次 LLM。

## 儲存與環境

- 正式環境：Cloudflare R2，必須設定 `R2_REQUIRED=true`；Render 亦被程式視為嚴格環境，不得退回本機檔案。
- 正式跨 instance 鎖：使用既有 PostgreSQL／Supabase `DATABASE_URL` 與 advisory lock，不需新增資料表。
- 本機／測試：`RECOMMENDATION_CACHE_BACKEND=local` 或未設定 R2 時使用 `.cache/recommendations`。
- R2 prefix：`R2_RECOMMENDATION_PREFIX=recommendations/v2/`。
- 若部署仍保留 `recommendations/v1/` 設定，Repository 會把尾端版本正規化為目前 schema 的 `v2`，避免產生 `v1/v2/` 巢狀路徑。
- LLM 使用 OpenAI-compatible chat completions；沒有 API key、timeout、錯誤或格式不合法時使用三角色規則備援，仍需寫入快取。

## API 相容

主要資料位於：

```text
data.role_recommendations
```

為維持原本單一採買建議 caller，相容別名仍保留：

```text
data.recommendation = role_recommendations.consumer
recommendations = role_recommendations.consumer.items
```

新功能應優先讀取 `role_recommendations`。

## 觀測欄位

API 回傳 `cache_hit`、`llm_called`、`generation_source`、`generated_at`、`cache_backend`、`prompt_set_version`、`source_name` 與資料日期。Log 可記錄分類、cache key、backend、生成器、提示語版本、角色數、耗時與錯誤類型，不得記錄 API key、Cookie、JWT 或完整 prompt。
