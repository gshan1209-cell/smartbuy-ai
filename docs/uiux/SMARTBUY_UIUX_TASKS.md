# SmartBuy AI｜前台／後台 UI/UX 開發任務清單

> 對應規格：`docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md`  
> 任務原則：一階段一個 PR；先骨架、再頁面、最後權限與後台功能。

---

## 任務狀態

- `[ ]` 尚未開始
- `[-]` 進行中
- `[x]` 已完成
- `[!]` 阻塞

---

# Phase 0｜基線盤點與保護

## SB-UIUX-P0-001｜建立改版基線

**優先級：P0**

- [x] 記錄目前前端路由與頁面清單
- [ ] 記錄目前共用元件與 CSS 入口
- [ ] 確認 `npm run build` 在改版前可成功
- [ ] 建立主要頁面手動驗收清單
- [ ] 不修改 API contract

**驗收：**

- 有清楚的 before 狀態
- 改版後可逐項確認功能沒有退化

---

# Phase 1｜Design System 與雙 Layout 骨架

## SB-UIUX-P1-001｜統一設計 Token

**優先級：P0**

- [x] 新增 `frontend/src/styles/tokens.css`
- [ ] 整併 `index.css` 與 `theme.css` 的顏色、陰影、圓角、字體與間距
- [ ] 保留必要舊 token alias，避免現有頁面一次性失效
- [ ] 定義 mobile/tablet/desktop breakpoint
- [ ] 定義 content max-width 與 responsive spacing

**驗收：**

- 所有新元件只使用統一 token
- light / dark theme 基本文字可讀
- 不新增重複色碼系統

## SB-UIUX-P1-002｜建立共用 UI 元件

**優先級：P0**

- [x] Button
- [ ] Card
- [ ] Badge
- [ ] Input
- [ ] EmptyState
- [ ] LoadingState / Skeleton
- [ ] Drawer
- [ ] Modal / ConfirmDialog
- [ ] Toast 介面統一

**驗收：**

- 元件支援 className 與必要 props
- 可鍵盤操作
- Drawer / Modal 支援 ESC 與 overlay 關閉
- 圖示按鈕有 aria-label

## SB-UIUX-P1-003｜建立 PublicLayout

**優先級：P0**

- [x] 建立 `PublicLayout.jsx`
- [ ] 拆分 `PublicHeader.jsx`
- [x] 建立 `MobileBottomNav.jsx`
- [ ] 桌機／平板保留頂部導覽
- [ ] 手機底部導覽：首頁、查菜價、菜籃、提醒、我的
- [ ] 通知與登入狀態功能移植，不得失效

**驗收：**

- 前台所有既有頁面可使用 PublicLayout
- 360px 不出現全頁水平捲軸
- 手機底部導覽不遮住頁面內容

## SB-UIUX-P1-004｜建立 DashboardLayout

**優先級：P0**

- [x] 建立 `DashboardLayout.jsx`
- [x] 建立 `DashboardSidebar.jsx`
- [x] 建立 `DashboardTopbar.jsx`
- [x] 建立手機版 `DashboardDrawer.jsx`
- [ ] 桌機固定 Sidebar
- [ ] 平板 Sidebar 可縮合
- [ ] 手機 Sidebar 改 Drawer

**驗收：**

- `/dashboard` 與前台使用不同導覽結構
- 三種尺寸均可正常導覽
- Sidebar active state 正確

## SB-UIUX-P1-005｜重構 App 路由

**優先級：P0**

- [x] 使用 nested routes 或一致的 Layout route 架構
- [ ] 前台路由套用 PublicLayout
- [ ] 後台路由套用 DashboardLayout
- [ ] 新增 `/alerts`、`/season`
- [ ] 新增 `/dashboard/overview` 骨架
- [ ] 保持既有路由相容

**驗收：**

- 重新整理任何主要路由不會白屏
- 既有 route path 不被任意改名

---

# Phase 2｜消費者前台改造

## SB-UIUX-P2-001｜消費者首頁

**優先級：P0**

- [x] 首屏改為「今天買什麼」
- [x] 提供快速品項搜尋與市場／地區入口
- [x] 顯示便宜、正常、偏貴品項摘要
- [x] 顯示一句白話採買建議
- [x] 顯示收藏提醒摘要
- [x] 顯示天氣／節氣提醒區塊
- [ ] 保留農產新知與互助網入口，但降低首屏權重

**內容規則：**

- 不以「農民、研究人員」作為首頁主要對象
- 不直接把專業波動率放在首屏
- 不使用無來源的真實數字；mock 必須明確標示

**驗收：**

- 手機首屏能看到至少一項今日採買建議
- 主要 CTA 不超過兩個
- 390 / 834 / 1440 三尺寸正常

## SB-UIUX-P2-002｜售價查詢頁簡化

**優先級：P0**

- [x] 手機篩選器改 Drawer / Bottom Sheet
- [x] 商品結果卡片顯示品名、今日價格、狀態、建議、更新時間
- [x] 專業市場情報移至「進階資訊」摺疊區或後台
- [x] 桌機保留效率較高的雙欄／表格模式
- [x] 平板改兩欄，不得直接縮小桌機版
- [x] 修正 MarketSelector 固定寬度造成的小螢幕問題

**驗收：**

- 360px 下篩選器與下拉選單不超出視窗
- 搜尋、排序、收藏功能仍可使用
- Chart.js instance 正常銷毀

## SB-UIUX-P2-003｜商品詳情頁

**優先級：P1**

- [x] 頁首顯示價格狀態與採買建議
- [x] 顯示近 7 日簡易走勢
- [x] 顯示影響因素：天氣、節氣、市場變化
- [x] 專業預測資訊放在第二層
- [x] 加入收藏／取消收藏主按鈕
- [x] 顯示資料日期與免責說明

## SB-UIUX-P2-004｜我的菜籃

**優先級：P1**

- [x] 手機卡片清單
- [x] 桌機表格／卡片切換
- [x] 降價與漲價提醒狀態
- [x] 空狀態引導搜尋品項
- [x] 移除收藏需確認或可復原

## SB-UIUX-P2-005｜提醒中心

**優先級：P1**

- [x] 新增 `/alerts`
- [x] 分類：價格、天氣、節氣、互助網
- [x] 已讀／未讀
- [x] 篩選與空狀態
- [x] 沿用既有 notifications API，可先以 adapter 統一格式

## SB-UIUX-P2-006｜節氣與當季推薦

**優先級：P1**

- [x] 新增 `/season`
- [x] 顯示目前節氣
- [x] 顯示適合購買品項
- [x] 顯示可能受天氣影響品項
- [x] 顯示節氣料理建議
- [x] 資料尚未接 API 時以明確 mock / static seed 實作

---

# Phase 3｜後台 Overview 與共用 Dashboard 元件

## SB-UIUX-P3-001｜Dashboard Overview

**優先級：P0**

- [ ] 建立 `/dashboard/overview`
- [ ] KPI：行情筆數、最後更新、異常品項、預測完成率
- [ ] KPI：新增會員、熱門收藏、待處理貼文、系統警告
- [ ] 最近資料任務
- [ ] 重要警示清單
- [ ] 所有 mock 值明確標示 Demo

**驗收：**

- 桌機 4 欄、平板 2 欄、手機 1 欄
- 每個數據有日期或更新時間

## SB-UIUX-P3-002｜ResponsiveDataTable

**優先級：P0**

- [ ] 桌機完整表格
- [ ] 平板隱藏次要欄位
- [ ] 手機轉卡片或水平捲動
- [ ] loading / empty / error
- [ ] pagination
- [ ] sort callback

## SB-UIUX-P3-003｜Dashboard Chart Card

**優先級：P1**

- [ ] 統一標題、說明、時間範圍與 loading
- [ ] Chart.js responsive wrapper
- [ ] Resize 與 destroy 處理
- [ ] 手機精簡 labels

## SB-UIUX-P3-004｜後台 Filter Bar

**優先級：P1**

- [ ] 關鍵字
- [ ] 日期範圍
- [ ] 狀態
- [ ] 市場／品項
- [ ] 手機 Drawer
- [ ] 清除篩選

---

# Phase 4｜角色與後台模組

## SB-UIUX-P4-001｜前端權限骨架

**優先級：P0**

- [ ] 定義 `consumer/farmer/merchant/operator/admin`
- [ ] 建立 `ProtectedRoute`
- [ ] 建立 `RoleGuard`
- [ ] 集中管理 development mock role
- [ ] 403 頁面
- [ ] 不得只靠 Sidebar 隱藏

## SB-UIUX-P4-002｜後端角色欄位規格

**優先級：P1**

- [ ] migration 設計
- [ ] `members.role`
- [ ] `/api/auth/me` 回傳 role
- [ ] 管理 API role dependency
- [ ] 預留 audit log

> 本任務需獨立 PR，不與純 UI PR 混合。

## SB-UIUX-P4-003｜行情管理

- [ ] 行情列表
- [ ] 異常品項篩選
- [ ] 市場比較
- [ ] 資料更新時間
- [ ] 詳情 Drawer

## SB-UIUX-P4-004｜AI 預測監控

- [ ] 預測日期
- [ ] 跌／持平／漲分布
- [ ] 完成率與缺漏
- [ ] 模型版本
- [ ] 資料不足提示

## SB-UIUX-P4-005｜內容與互助網管理

- [ ] 文章狀態
- [ ] mock 與正式來源標記
- [ ] 貼文檢舉／隱藏
- [ ] 待處理清單
- [ ] 管理動作確認

## SB-UIUX-P4-006｜會員管理

- [ ] 會員列表
- [ ] 角色篩選
- [ ] 帳號狀態
- [ ] 角色修改（需後端權限）
- [ ] 不顯示密碼或敏感 token

---

# Phase 5｜品質與驗收

## SB-UIUX-P5-001｜三尺寸視覺驗收

- [ ] 390 × 844
- [ ] 834 × 1112
- [ ] 1440 × 900
- [ ] 額外確認 360px
- [ ] 無主要元素重疊
- [ ] 無全頁水平捲軸
- [ ] Sticky / fixed 元件不遮內容

## SB-UIUX-P5-002｜功能回歸

- [ ] 註冊
- [ ] 登入／登出
- [ ] 搜尋
- [ ] 商品詳情
- [ ] 收藏
- [ ] 互助網
- [ ] 通知
- [ ] 設定與主題

## SB-UIUX-P5-003｜Accessibility

- [ ] keyboard navigation
- [ ] visible focus
- [ ] aria-label
- [ ] form label
- [ ] contrast
- [ ] reduced motion 基本支援

## SB-UIUX-P5-004｜Build 與文件

- [ ] `npm run build`
- [ ] 記錄修改檔案
- [ ] 更新 README 或 docs 索引
- [ ] 提供三尺寸截圖
- [ ] PR 說明列出已知限制與未完成項目

---

# 建議 PR 切分

| PR | 範圍 |
|---|---|
| PR-1 | P0 + P1：Design System、PublicLayout、DashboardLayout、路由骨架 |
| PR-2 | P2-001～P2-002：消費者首頁與售價查詢 |
| PR-3 | P2-003～P2-006：詳情、菜籃、提醒、節氣 |
| PR-4 | P3：Dashboard Overview 與共用後台元件 |
| PR-5 | P4-001：前端權限骨架 |
| PR-6 | P4-002：後端角色與權限 |
| PR-7+ | 各後台業務模組逐一實作 |

---

# Codex 執行原則

1. 一次只執行一個 PR 範圍。
2. 開始前先讀規格書與本任務清單。
3. 不得任意刪除現有功能。
4. 不得在 UI 任務中重寫 API。
5. 不得用大量 inline style 完成新元件。
6. 每次完成需執行 build，並回報變更檔案、驗收結果與未完成項目。
7. 遇到後端 API 尚未存在，使用集中 adapter / mock，並清楚加上 TODO 與 Demo 標記。
8. 所有頁面至少驗證 mobile、tablet、desktop 三尺寸。
