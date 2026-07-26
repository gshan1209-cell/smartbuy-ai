---
name: smartbuy-rewards-coupons
description: 適用於 SmartBuy AI 會員點數、登入獎勵、好物推薦獎勵、優惠券兌換與優惠券管理；不適用於一般商品折扣或不涉及會員資產的前台介面。
---

# SmartBuy Rewards and Coupons

## Workflow

1. 先讀 `AGENT.md`、`AGENTS.md`、`smartbuy-api-change`；若包含前台或後台頁面，再讀對應的 public／dashboard 技能。
2. 盤點會員登入、貼文建立、現有 RBAC、API router 註冊與資料庫 migration，確認正式角色仍只有 `consumer`、`farmer`、`merchant`、`admin`。
3. 以不可重複發放為前提設計點數交易：每個獎勵必須有唯一 `idempotency_key`，登入獎勵使用台北時區日期，推薦獎勵綁定推薦貼文 ID。
4. 點數餘額、累積收入、累積支出與交易明細分開保存；兌換時使用資料庫交易、row lock、餘額檢查、庫存檢查與唯一會員兌換限制。
5. 公開 API 只能列出 active 且在有效期／庫存內的優惠券；優惠券建立、更新與狀態管理必須由後端 `coupons.manage` 權限保護，前端隱藏不是授權。
6. 會員前台需要處理 loading、空資料、點數不足、已兌換、兌換成功與 API 不可用狀態；不得使用靜態券或假餘額替代正式 API。
7. 管理頁需要支援建立、檢視、暫停／啟用與基本有效期／庫存欄位，並在手機、平板、桌機維持可操作。
8. 執行 migration 檢查、後端測試、前端 build、未登入／未授權／admin API 驗證與既有登入、互助網、Dashboard 回歸檢查。

## Guardrails

- 登入或貼文重試不可重複增加點數。
- 任何扣點與發券必須在同一個資料庫 transaction 內完成；失敗必須整體 rollback。
- 不接受由前端傳入的 member_id、balance、reward amount 作為可信來源。
- unknown role 一律最低權限；`coupons.manage` 預設只給 `admin`。
- 不因新增點數功能刪除既有登入、互助網留言／按讚／收藏或通知流程。
- migration 必須可重複執行，並清楚交付尚未套用的資料庫狀態。

## Deliverables

- migration、repository、API schema/router、前台點數中心、後台優惠券管理頁。
- 點數獎勵與兌換的冪等、權限、輸入驗證和失敗狀態測試證據。
- 變更摘要、驗收結果、回歸結果與資料庫／環境限制。
