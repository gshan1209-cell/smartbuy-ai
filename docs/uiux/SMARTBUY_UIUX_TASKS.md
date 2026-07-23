# SmartBuy AI｜前台／後台 UI/UX 開發任務清單

> 對應規格：`docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md`  
> 後台視覺：`docs/uiux/DASHBOARD_VISUAL_STYLE_REFERENCE.md`  
> 任務原則：一階段一個 PR；先骨架、再頁面、最後權限與後台功能。

## 任務狀態

- `[ ]` 尚未開始
- `[-]` 進行中
- `[x]` 已完成
- `[!]` 阻塞

---

# Phase 0｜基線盤點與保護

## SB-UIUX-P0-001｜建立改版基線

- [x] 記錄前端路由與頁面清單
- [x] 建立 `AGENT.md`
- [x] 禁止 UI 重構任意刪除既有程式碼與功能
- [ ] 補齊共用元件與 CSS 入口清單
- [ ] 建立主要頁面手動回歸清單
- [ ] 建立正式三尺寸截圖基線

---

# Phase 1｜Design System 與雙 Layout 骨架

## SB-UIUX-P1-001｜統一 Design Token

- [x] 新增 `frontend/src/styles/tokens.css`
- [ ] 整併 `index.css` 與 `theme.css` 重複變數
- [x] 定義 Mobile／Tablet／Desktop breakpoint
- [x] 定義前台與後台 content spacing
- [ ] 清理新增元件中的非必要硬編碼色碼

## SB-UIUX-P1-002｜共用 UI 元件

- [x] Button
- [x] Card
- [x] Badge
- [x] EmptyState
- [x] LoadingState
- [x] Drawer
- [x] DashboardMetricCard
- [x] DashboardChartCard
- [x] ResponsiveDataTable
- [x] DashboardFilterBar
- [ ] Input 統一
- [ ] Modal／ConfirmDialog 統一
- [ ] Toast 介面統一

## SB-UIUX-P1-003｜PublicLayout

- [x] 建立 `PublicLayout.jsx`
- [x] 建立 Mobile Bottom Navigation
- [x] 保留桌機／平板頂部導覽
- [x] 前台主要路由套用 PublicLayout
- [ ] 完成 PublicHeader 元件拆分與樣式清理

## SB-UIUX-P1-004｜DashboardLayout

- [x] 建立 `DashboardLayout.jsx`
- [x] 建立 Sidebar、Topbar、Mobile Drawer
- [x] Desktop 固定 Sidebar
- [x] Tablet 圖示 Sidebar
- [x] Mobile Drawer
- [x] 採用正式後台視覺參考文件

## SB-UIUX-P1-005｜路由骨架

- [x] 前台 nested layout
- [x] 後台 nested layout
- [x] `/alerts`
- [x] `/season`
- [x] `/dashboard/overview`
- [x] 後台模組 placeholder 路由
- [x] 保留既有公開路由

---

# Phase 2｜消費者前台

## SB-UIUX-P2-001｜消費者首頁

- [x] 首屏改為「今天買什麼」
- [x] 快速品項與市場搜尋
- [x] 便宜／正常／偏貴摘要
- [x] 白話採買建議
- [x] 收藏與提醒摘要
- [x] 天氣／節氣入口
- [x] 農產新知與互助網入口

## SB-UIUX-P2-002｜售價查詢

- [x] Mobile 篩選 Drawer
- [x] 商品卡顯示價格、狀態、建議與時間
- [x] 專業情報移至進階區
- [x] Desktop／Tablet／Mobile 三尺寸
- [x] 搜尋、排序、收藏與 Chart.js 功能保留

## SB-UIUX-P2-003｜商品詳情

- [x] 價格狀態與採買建議
- [x] 7／14／30 日走勢
- [x] MA、行情位置、AI 方向與風險資訊保留
- [x] 收藏與操作回饋
- [x] 資料日期與免責說明

## SB-UIUX-P2-004｜我的菜籃

- [x] 收藏商品正式 API
- [x] 商品與文章收藏分區
- [x] Partial Error
- [x] 移除收藏確認與失敗復原
- [x] Mobile／Tablet／Desktop

## SB-UIUX-P2-005｜提醒中心

- [x] `/alerts`
- [x] 正式 notifications API
- [x] 已讀／未讀與全部已讀
- [x] 分類與空狀態
- [x] 分頁與錯誤回復

## SB-UIUX-P2-006｜節氣推薦

- [x] `/season`
- [x] 正式 solar-term API
- [x] 當季推薦、料理、風險與知識
- [x] Static Seed 明確標示

---

# Phase 3｜Dashboard Overview 與共用元件

## SB-UIUX-P3-001｜Dashboard Overview

- [x] 正式 API 優先
- [x] KPI 與資料來源健康狀態
- [x] 市場情報與 AI 分布
- [x] 高風險預測表格
- [x] 最近未結案互助貼文
- [x] Loading／Empty／Error／Partial Error／Stale
- [x] Desktop 四欄、Tablet 兩欄、Mobile 一欄
- [ ] 會員、收藏、任務、錯誤正式管理 API

## SB-UIUX-P3-002｜ResponsiveDataTable

- [x] Desktop 完整表格
- [x] Tablet 隱藏次要欄位
- [x] Mobile 卡片
- [x] Loading／Empty／Error
- [x] Pagination
- [x] Sort callback 與 `aria-sort`

## SB-UIUX-P3-003｜DashboardChartCard

- [x] 標題、說明、來源、時間與狀態
- [x] 響應式容器
- [x] 方向與風險分布
- [ ] 後續正式 Chart.js Dashboard 圖表

## SB-UIUX-P3-004｜DashboardFilterBar

- [x] 關鍵字
- [x] 狀態
- [x] 市場／品項介面
- [x] 日期範圍介面
- [x] Mobile Drawer 與套用流程
- [x] 清除篩選

---

# Phase 4｜四角色權限與後台模組

正式角色只有：

```text
consumer
farmer
merchant
admin
```

`operator`、`staff` 或其他名稱不是正式角色。

## SB-UIUX-P4-001｜四角色 RBAC 基礎

**優先級：P0｜PR-5**

- [-] 定義 `consumer/farmer/merchant/admin`
- [-] `members.role` idempotent migration
- [-] Auth API 回傳 normalized role
- [-] 後端 `require_roles`／`require_permissions`
- [-] `GET /api/admin/access`
- [-] 前端 roles、permissions、dashboardNavigation
- [-] 重構 ProtectedRoute
- [-] 建立 RoleGuard／PermissionGuard
- [-] 建立 `/403`
- [-] Production 禁止 Demo Admin bypass
- [-] 未知角色採最低權限
- [-] 消費者禁止進入 Dashboard

## SB-UIUX-P4-002｜後台行情管理

**優先級：P0｜PR-5**

- [-] `/dashboard/prices`
- [-] 正式 `/api/products`、`/api/markets`、`/api/market-intel`
- [-] 行情 KPI
- [-] 市場與狀態篩選
- [-] 排序與分頁
- [-] Desktop 表格、Tablet 精簡、Mobile 卡片
- [-] 商品詳情 Drawer
- [-] Loading／Empty／Error／Partial Error
- [-] 符合後台視覺參考文件
- [ ] 行情人工修改與刪除：本階段禁止實作

## SB-UIUX-P4-003｜AI 預測監控

- [ ] 預測日期
- [ ] 跌／持平／漲分布
- [ ] 風險與信心
- [ ] 模型版本
- [ ] 資料新鮮度與缺漏

## SB-UIUX-P4-004｜天氣與節氣後台

- [ ] 產地天氣風險
- [ ] 節氣推薦規則
- [ ] 品項風險規則
- [ ] 農民與商家權限差異

## SB-UIUX-P4-005｜內容與互助網管理

- [ ] 文章狀態
- [ ] 互助貼文處理狀態
- [ ] 檢舉／隱藏正式 API
- [ ] 管理動作確認
- [ ] 僅系統管理員可使用

## SB-UIUX-P4-006｜會員管理

- [ ] 會員列表
- [ ] 四角色篩選
- [ ] 帳號狀態
- [ ] 角色修改正式管理 API
- [ ] Audit Log
- [ ] 不顯示密碼或 Token
- [ ] 僅系統管理員可使用

## SB-UIUX-P4-007｜通知、任務與系統設定

- [ ] 通知管理
- [ ] 資料任務監控
- [ ] GitHub Actions／部署狀態 adapter
- [ ] 系統設定
- [ ] 僅系統管理員可使用

---

# Phase 5｜品質與驗收

## SB-UIUX-P5-001｜三尺寸視覺驗收

- [ ] 360 × 800
- [ ] 390 × 844
- [ ] 768 × 1024
- [ ] 834 × 1112
- [ ] 1200 × 800
- [ ] 1440 × 900
- [ ] 無主要元素重疊
- [ ] 無全頁水平捲軸
- [ ] Sticky／Fixed 元件不遮內容

## SB-UIUX-P5-002｜功能回歸

- [ ] 註冊
- [ ] 登入／登出
- [ ] 四角色授權
- [ ] 搜尋
- [ ] 商品詳情
- [ ] 收藏
- [ ] 互助網
- [ ] 通知
- [ ] 設定與主題
- [ ] Dashboard

## SB-UIUX-P5-003｜Accessibility

- [ ] Keyboard Navigation
- [ ] Visible Focus
- [ ] aria-label／aria-sort
- [ ] Form Label
- [ ] Contrast
- [ ] Reduced Motion

## SB-UIUX-P5-004｜Build 與文件

- [ ] `npm run build`
- [ ] `pytest`
- [ ] `git diff --check`
- [ ] PR 列出正式 API、Demo、Static Seed 與 Unavailable
- [ ] 提供三尺寸截圖或誠實說明環境限制
- [ ] 記錄已知限制與下一階段

---

# 建議 PR 切分

| PR | 範圍 |
|---|---|
| PR-1 | Design System、雙 Layout、路由骨架 |
| PR-2 | 消費者首頁與售價查詢 |
| PR-3 | 商品詳情、菜籃、提醒、節氣 |
| PR-4 | Dashboard Overview 與共用元件 |
| PR-5 | 四角色 RBAC + 唯讀行情管理 |
| PR-6 | AI 預測監控 + 天氣／節氣後台 |
| PR-7 | 內容、互助網與通知管理 |
| PR-8 | 會員、任務與系統設定 |
| PR-9 | 全站品質、視覺與功能回歸 |

# Codex 執行原則

1. 開始前先讀 `AGENT.md`、規格、視覺參考與當次任務文件。
2. 一次只執行一個 PR 範圍。
3. 不得任意刪除既有功能。
4. 正式 API 存在時不得以 Demo 取代。
5. 管理 API 必須後端驗證權限。
6. 角色固定為四種，不得新增第五種角色。
7. 每次完成需執行 build、測試、diff check，並回報已知限制。
8. 所有頁面至少驗證 Mobile、Tablet、Desktop 三尺寸。
