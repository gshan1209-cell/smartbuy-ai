---
name: project-homepage
description: SmartBuy AI 首頁設計決策、區塊結構、樣式策略與實作細節
metadata:
  type: project
---

# SmartBuy AI 首頁（Home.jsx）

## 設計定調
- 商業農產品風格，仿 Wix 商業網站版型
- 目標使用者：一般家庭主婦/主夫（訪客，未登入狀態）
- 首頁定位：功能說明型 landing page，每區塊介紹一個功能

**Why:** 使用者明確要求仿 Wix 商業農產品風格，移除過去的工具型儀表板感，改為有說服力的 landing page 引導訪客了解功能再加入。

**How to apply:** 未來修改首頁時，維持「每 section 一個功能說明」的結構，不要改回純 dashboard 風格。

---

## 區塊結構（由上到下）

1. **Hero** — Unsplash 農田背景圖 + 深綠 overlay + Canvas 粒子動畫 + AI 節點 SVG（右側）+ Stats bar（底部深綠帶）
2. **核心功能** — 4 張功能卡（今日好買、菜價查詢、AI 預測、我的菜籃）
3. **今日好買** — 串接 `GET /api/home` → `recommendations` 前 3 筆
4. **菜價查詢** — 靜態搜尋 bar（submit 導向 `/search?q=`）+ 3 筆 mock 示意
5. **AI 漲跌預測** — 串接 `GET /api/predictions/direction?limit=4`
6. **我的菜籃** — 靜態 mock（4 筆），提示登入後可儲存
7. **頁尾 CTA** — 深綠漸層，「免費立即加入 → /register」「了解更多功能 → /search」

**移除的功能（使用者要求不放在首頁）：** 節氣指南、天氣影響、回報菜價

---

## 技術實作

### 主要檔案
- `frontend/src/pages/Home.jsx` — 完全重寫（原有登入框已移除）
- `frontend/src/pages/Home.css` — 新增所有 `hm-*` 前綴 class

### 樣式策略
- 沿用 `yz-*` CSS class（`theme.css`）作為基礎元件
- 新增 `hm-*` class 負責首頁專屬版型（Hero、stats bar、bargain card 等）
- Hero 及各 section 主要用 inline style 控制間距（與既有 Home.jsx 風格一致）

### Hero 背景圖
```
https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=1600&q=80
```
（綠色農田俯視圖，Unsplash 免費商業授權）

### API 串接
| Section | 端點 | 關鍵欄位 |
|---------|------|---------|
| 今日好買 | `GET /api/home` | `recommendations[].product_name`, `today_price`, `market_name`, `recent_average` |
| AI 預測 | `GET /api/predictions/direction?limit=4` | `crop_name`, `pred_label_name`（漲/跌/持平）, `pred_confidence` |

### 移除的元件
- Hero 右側登入框（未登入/已登入皆顯示相同 Hero，登入從 Navbar 進入）

---

## 配色（hm-* 專用）
- Hero overlay: `rgba(10,35,18,.88)` → `rgba(46,125,71,.2)`
- 好買卡左邊框: `var(--yz-or)`（琥珀橙）
- 漲價: `#B91C1C` / `#FEE2E2`
- 跌價: `#15803D` / `#DCFCE7`
- 頁尾 CTA: `linear-gradient(135deg, var(--yz-gd) 0%, var(--yz-g) 100%)`

---

## 驗證狀態
- [x] Hero 背景圖正常載入
- [x] 粒子動畫 + AI 節點 SVG 顯示
- [x] Stats bar 顯示
- [x] 4 功能卡顯示
- [x] 搜尋 bar + mock 資料列
- [x] 頁尾 CTA 深綠漸層
- [ ] 今日好買 API 資料（需後端連線）
- [ ] AI 預測 API 資料（需後端連線）
