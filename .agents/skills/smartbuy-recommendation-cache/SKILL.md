---
name: smartbuy-recommendation-cache
description: 適用於 SmartBuy AI 依農產品分類產生消費者、農民、商家三角色 AI 推薦、持久 JSON 快取、Cloudflare R2、LLM 成本保護與同分類併發去重；不適用於一般聊天、RAG、無分類快取或僅修改儀表板視覺的工作。
---

# SmartBuy Recommendation Cache

## Purpose

建立可觀測、可持久化且不重複付費的分類式 AI 推薦流程；同一份行情必須以消費者、農民與商家三套角色提示語產生三份結果，並能追溯行情來源、資料日期、生成方法、提示語版本與快取狀態。

## Three-role prompt contract

正式角色提示語固定為：

- `consumer`：家庭採買端，聚焦預算、採買時機、購買量與替代品。
- `farmer`：農業生產端，聚焦採收、分批出貨、成本核對與行情風險。
- `merchant`：通路銷售端，聚焦分批補貨、庫存風險、替代品與促銷方向。

三套提示語必須集中定義於 `src/recommendation/role_prompts.py`，不得分散在 Router、React page 或測試中各自維護。為維持成本保護，同一分類快取不存在時，以**單次 LLM 請求**攜帶三套角色提示語，並一次回傳 `consumer`、`farmer`、`merchant` 三份結果；不得為三個角色各呼叫一次 LLM。

## Required workflow

1. 先讀取 `AGENT.md`、`AGENTS.md` 與相關功能規格，盤點既有行情資料來源、價格狀態函式、R2 設定、RBAC 與 Dashboard API caller。
2. 集中定義分類白名單、顯示名稱、分類規則、角色提示語與 schema version。快取 key 只能由白名單分類產生，不得把未驗證使用者輸入放入檔名或 R2 Object Key。
3. 依序執行：先讀持久快取 → 快取存在即驗證並回傳 → 不存在才取得分類 lock → lock 內再次讀取 → 僅在仍不存在時呼叫 LLM 一次。
4. 單次 LLM 輸出必須完整包含 `consumer`、`farmer`、`merchant`；任一角色缺少、格式錯誤或竄改行情資料時，整份 LLM 輸出視為失敗並改用三角色規則備援。
5. JSON 存在但損壞、schema version 不符、提示語版本不符或分類欄位不一致時，回傳明確錯誤；不得自動覆蓋或重新呼叫 LLM。
6. 使用 `create_if_absent` 或等價的條件寫入，避免無條件覆寫。正式環境使用 Cloudflare R2；本機／測試可使用 local 或 fake repository，但不可在正式環境靜默退回本機檔案。
7. LLM timeout、服務錯誤或格式驗證失敗時，只能在「快取不存在」的本次生成流程產生三角色規則備援 JSON；備援成功後同樣持久化，並清楚標示 `rules-fallback`。
8. LLM 輸出只能使用候選資料中的品項、價格、狀態與市場；驗證 Pydantic schema、角色完整性、候選品項、數值與替代品，禁止虛構行情、產量、庫存、需求、供應、營養或食安資訊。
9. 以 per-category lock／single-flight 去重同一 Python process 的併發生成；lock registry 必須在無使用者後清理，不得無上限累積。
10. API 必須同時驗證後端權限並回傳 `cache_hit`、`llm_called`、`generation_source`、`generated_at`、`cache_backend`、`prompt_set_version`、三角色內容、來源與資料日期。
11. 前端重新整理只能 GET，不得提供 force、refresh generation 或清除快取操作；Desktop 同一列呈現三角色，Tablet／Mobile 可依可讀性堆疊。

## Required tests

- 快取命中時 LLM 呼叫 0 次。
- 快取不存在時 LLM 呼叫最多 1 次，單次輸出包含三個角色，成功後第二次直接命中。
- Prompt payload 具有三套不同角色目標，且 output schema 固定要求三角色。
- 同分類併發只呼叫一次；不同分類使用不同 key。
- 損壞、schema 不符或提示語版本不符 JSON 不呼叫 LLM且回傳明確錯誤。
- 任一角色缺少或竄改價格時，產生並持久化三角色規則備援。
- 寫入失敗不得回報快取成功。
- 分類白名單、未登入、consumer、farmer、merchant、admin 與未知角色邊界均有驗證。
- 正式 R2 Object Key 使用目前 schema 版本，舊版物件保留不覆寫。
- 前端三角色 Desktop／Tablet／Mobile 狀態均完成檢查。

## Do not

- 不要加入 `force=true`、公開 refresh endpoint、刪除快取按鈕或一般使用者 LLM 重打功能。
- 不要為三個角色各自呼叫一次 LLM。
- 不要以靜態 mock 取代既有正式行情 API。
- 不要在 Router、React page、Prompt 或測試各自維護一份分類或角色清單。
- 不要把 API key、完整 prompt、Cookie、JWT 或個資寫入 log 或 JSON 快取。
