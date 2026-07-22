---
name: price-pages-architecture
description: 售價頁面的設計決策、Chart.js 慣例與已移除功能
metadata:
  type: project
---

# 售價動態頁面 — 記憶重點

詳細架構見 `docs/architecture/frontend_price_pages.md`。

## 設計決策：拆成兩頁

列表（`/search`）與詳情（`/product/:name`）是兩個獨立頁面。
**Why:** 原本同頁造成狀態複雜；拆頁後各自職責清晰，URL 可分享。
**How to apply:** 列表頁只做「選擇與瀏覽」，詳情頁才做「深度分析」，不要把詳情資訊塞回列表。

## Chart.js 初始化慣例

useRef 存 instance，effect 內先 destroy 再 new，cleanup return destroy。不遵守會造成 canvas 重複掛載錯誤。

## 已移除功能

| 項目 | 原因 |
|------|------|
| 天氣影響區塊 | 規格要求移除；2026-07-21 整條天氣程式碼鏈（`src/weather/*`、`weather_loader.py`、相關 CSV）一併清除 |
| 替代品推薦（`alternative_recommender.py`） | 前端從未渲染 `alternatives` 欄位，2026-07-21 一併移除 |
| AgriFeatureCard | 不在新版 spec 範圍 |
| AuctionDetailModal | 改為 API detail 欄位內嵌 |
| 右側詳情面板（原 PriceSearch 分欄） | 獨立為 `/product/:name` 頁面 |
