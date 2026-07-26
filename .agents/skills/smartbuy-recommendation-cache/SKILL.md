---
name: smartbuy-recommendation-cache
description: 適用於 SmartBuy AI 依農產品分類產生 AI 採買推薦、持久 JSON 快取、Cloudflare R2、LLM 成本保護與同分類併發去重；不適用於一般聊天、RAG、無分類快取或僅修改儀表板視覺的工作。
---

# SmartBuy Recommendation Cache

## Purpose

建立可觀測、可持久化且不重複付費的分類式 AI 推薦流程；推薦必須能追溯行情來源、資料日期、生成方法與快取狀態。

## Required workflow

1. 先讀取 `AGENT.md`、`AGENTS.md` 與相關功能規格，盤點既有行情資料來源、價格狀態函式、R2 設定、RBAC 與 Dashboard API caller。
2. 集中定義分類白名單、顯示名稱、分類規則與 schema version。快取 key 只能由白名單分類產生，不得把未驗證使用者輸入放入檔名或 R2 Object Key。
3. 依序執行：先讀持久快取 → 快取存在即驗證並回傳 → 不存在才取得分類 lock → lock 內再次讀取 → 僅在仍不存在時呼叫 LLM 一次。
4. JSON 存在但損壞、schema version 不符或分類欄位不一致時，回傳明確錯誤；不得自動覆蓋或重新呼叫 LLM。
5. 使用 `create_if_absent` 或等價的條件寫入，避免無條件覆寫。正式環境使用 Cloudflare R2；本機／測試可使用 local 或 fake repository，但不可在正式環境靜默退回本機檔案。
6. LLM timeout、服務錯誤或格式驗證失敗時，只能在「快取不存在」的本次生成流程產生規則備援 JSON；備援成功後同樣持久化，並清楚標示 `rules-fallback`。
7. LLM 輸出只能使用候選資料中的品項、價格、狀態與市場；驗證 Pydantic schema、候選品項、數值與替代品，禁止虛構行情、供應、營養或食安資訊。
8. 以 per-category lock／single-flight 去重同一 Python process 的併發生成；lock registry 必須在無使用者後清理，不得無上限累積。
9. API 必須同時驗證後端權限並回傳 `cache_hit`、`llm_called`、`generation_source`、`generated_at`、`cache_backend`、來源與資料日期。前端重新整理只能 GET，不得提供 force、refresh generation 或清除快取操作。

## Required tests

- 快取命中時 LLM 呼叫 0 次。
- 快取不存在時 LLM 呼叫最多 1 次，成功後第二次直接命中。
- 同分類併發只呼叫一次；不同分類使用不同 key。
- 損壞／schema 不符 JSON 不呼叫 LLM 且回傳明確錯誤。
- LLM 失敗產生並持久化規則備援；寫入失敗不得回報快取成功。
- 分類白名單、未登入、consumer、farmer、merchant、admin 與未知角色邊界均有驗證。
- 正式 R2 Object Key、條件寫入與前端三尺寸狀態均完成檢查。

## Do not

- 不要加入 `force=true`、公開 refresh endpoint、刪除快取按鈕或一般使用者 LLM 重打功能。
- 不要以靜態 mock 取代既有正式行情 API。
- 不要在 Router、React page 或 Prompt 各自維護一份分類清單。
- 不要把 API key、完整 prompt、Cookie、JWT 或個資寫入 log 或 JSON 快取。
