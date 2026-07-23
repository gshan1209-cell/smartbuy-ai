# Codex 任務｜PR-6 AI 預測監控與天氣／節氣後台

Repository：

```text
https://github.com/gshan1209-cell/smartbuy-ai.git
```

建議分支：

```text
feat/ai-weather-seasonal-dashboard
```

建議 PR 標題：

```text
feat(dashboard): build AI prediction monitoring and weather-seasonal modules
```

---

## 1. 開始前必讀

依序完整閱讀：

1. `AGENT.md`
2. `docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md`
3. `docs/uiux/SMARTBUY_UIUX_TASKS.md`
4. `docs/uiux/DASHBOARD_VISUAL_STYLE_REFERENCE.md`
5. 本文件
6. `docs/spec/SmartBuy_AI_便宜買AI_MVP完整開發規格書_v1.1_含任務中心與24節氣.md`
7. `frontend/src/pages/dashboard/DashboardOverview.jsx`
8. `frontend/src/pages/dashboard/DashboardPrices.jsx`
9. `frontend/src/components/dashboard/`
10. `frontend/src/config/permissions.js`
11. `frontend/src/config/dashboardNavigation.js`
12. `backend/routers/prediction.py`
13. `backend/routers/market.py`
14. `backend/routers/product.py`
15. `backend/routers/misc.py`
16. `src/data/price_direction_prediction_store.py`
17. `src/calendar/solar_terms.py`
18. `frontend/src/pages/Season.jsx`
19. `frontend/src/data/seasonalRecommendations.js`

若文件描述與目前程式碼不一致，以 `AGENT.md`、本文件及實際正式 API 為準。

---

## 2. 重要現況

### 2.1 已完成

PR-5 已完成：

- 四角色 RBAC
- 後端 permission dependency
- `/api/admin/access`
- PermissionGuard
- 後台視覺基準
- `/dashboard/prices` 唯讀行情管理

本 PR 不得重做或削弱上述功能。

### 2.2 正式角色與權限

只有四種角色：

```text
consumer
farmer
merchant
admin
```

本 PR 使用：

| 模組 | Permission | 可使用角色 |
|---|---|---|
| AI 預測監控 | `predictions.view` | farmer、merchant、admin |
| 天氣風險 | `weather.view` | farmer、admin |
| 節氣推薦 | `seasonal.view` | farmer、merchant、admin |

禁止新增第五種角色，禁止只靠隱藏 Sidebar 控制權限。

### 2.3 天氣功能現況

2026-07-21 的歷史規格已明確記錄：舊天氣風險模組、假資料 CSV 與前端未使用程式已被移除。

目前 Repository 沒有可確認的正式天氣 API、天氣資料檔或有效 Provider 設定。

因此本 PR：

- 禁止把歷史文件描述當成已存在功能
- 禁止重新加入假天氣 CSV
- 禁止使用固定雨量、溫度或風險數字
- 禁止在沒有正式資料來源時顯示「天氣正常」
- 禁止提交 CWA API Key、Token 或 Secrets

---

# 3. 本次交付範圍

建立三個正式後台路由：

```text
/dashboard/predictions
/dashboard/weather
/dashboard/seasonal
```

要求：

- 三個路由都必須使用 PermissionGuard
- Sidebar、Mobile Drawer 與直接輸入 URL 的權限結果一致
- 使用 PR-5 已建立的後台 Layout 與共用元件
- 不修改 AI 模型、不重訓模型、不修改現有預測資料表
- 不刪除前台 `/season`、商品詳情、行情查詢或 Overview 功能

---

# 4. AI 預測監控

路由：

```text
/dashboard/predictions
```

Permission：

```text
predictions.view
```

## 4.1 正式 API

使用：

```text
GET /api/predictions/direction?limit=500
GET /api/predictions/direction/latest
GET /api/markets
GET /api/products
```

注意：

- Prediction list API 最多回傳 500 筆
- API 沒有正式 `total`
- 不得把回傳筆數宣稱成全站總數
- 畫面應使用「本次取得樣本」或「最近預測樣本」
- 模型版本若 API 沒有提供，顯示「尚未接入模型版本欄位」
- 預測完成率若沒有明確分母，不得計算或顯示固定百分比

## 4.2 集中 Adapter

建立：

```text
frontend/src/lib/dashboardPredictionsAdapter.js
```

Adapter 負責：

- 正式 API 請求
- 欄位 normalization
- `Promise.allSettled()`
- Loading／Empty／Error／Partial Error／Stale
- 方向分布
- 風險分布
- 平均信心值
- 最新基準日
- 資料新鮮度
- 高風險清單
- 市場與品項選項

禁止把轉接與統計散落在多張 JSX 卡片中。

## 4.3 KPI

至少建立：

1. 本次取得預測筆數
2. 最新預測基準日
3. 漲勢樣本數
4. 持平樣本數
5. 跌勢樣本數
6. 高風險樣本數
7. 平均信心值
8. 資料過期／缺漏樣本數

每張 KPI 顯示：

- 資料來源
- 資料日期或檢查時間
- Ready／Empty／Error／Stale／Unavailable
- 不得把 API 失敗顯示成 0

## 4.4 圖表與清單

建立：

- 跌／持平／漲分布
- normal／medium／high 風險分布
- 市場分布或資料新鮮度摘要
- 高風險預測清單
- 全部預測表格

表格欄位：

```text
品項
市場
方向
信心
風險
基準日
資料新鮮度
```

使用：

```text
DashboardMetricCard
DashboardChartCard
DashboardFilterBar
ResponsiveDataTable
Drawer
```

## 4.5 篩選

至少支援：

- 關鍵字
- 市場
- 方向
- 風險
- 清除篩選
- Mobile Drawer

若現有 `DashboardFilterBar` 不足，請以向後相容方式擴充，不能破壞 `/dashboard/overview` 與 `/dashboard/prices`。

## 4.6 詳情 Drawer

點擊預測列後：

- 使用 `/api/predictions/direction/latest`
- 顯示方向、信心、風險、基準日、資料新鮮度
- 顯示 API 有提供的原因或欄位
- 沒有模型版本時明確顯示 Unavailable
- 提供前往公開商品詳情頁

---

# 5. 天氣風險後台

路由：

```text
/dashboard/weather
```

Permission：

```text
weather.view
```

## 5.1 本 PR 的正確目標

由於目前沒有正式天氣資料來源，本 PR 先建立「天氣資料來源狀態與整合準備頁」，不得偽造天氣風險。

畫面需顯示：

- 模組名稱：產地天氣風險
- 狀態：尚未接入正式天氣資料來源
- 不顯示假溫度、假雨量、假警報
- 顯示未來正式資料來源需求
- 顯示最後檢查時間
- 顯示哪些功能目前不可用

## 5.2 後端狀態 Endpoint

新增受保護 Endpoint：

```text
GET /api/admin/weather/status
```

Permission：

```text
weather.view
```

第一版回傳應是誠實的 capability status，例如：

```json
{
  "available": false,
  "status": "unavailable",
  "provider": null,
  "lastUpdatedAt": null,
  "reason": "尚未接入正式中央氣象署資料來源",
  "capabilities": {
    "countyForecast": false,
    "weatherAlerts": false,
    "cropRiskRules": false
  }
}
```

此 Endpoint 不得：

- 呼叫不存在的 Provider
- 在 Request 中自動下載大量資料
- 回傳固定假天氣
- 暴露 Secrets

未來正式 Provider 接入後可沿用同一 contract。

## 5.3 UI

使用 Dashboard 視覺規格建立：

- Capability KPI
- 資料來源健康狀態
- 未接入功能清單
- 正式串接前置條件
- 下一步開發說明

Unavailable 不是 Error，也不是 0。

---

# 6. 節氣推薦後台

路由：

```text
/dashboard/seasonal
```

Permission：

```text
seasonal.view
```

## 6.1 正式與 Static Seed 來源

正式 API：

```text
GET /api/solar-term
GET /api/products
```

現有前端 Static Seed：

```text
frontend/src/data/seasonalRecommendations.js
```

規則：

- 目前節氣可標示為正式 API
- 推薦品項、料理與知識若來自 Static Seed，必須標示 `Static Seed`
- 不得把 Static Seed 偽裝成資料庫規則
- 不得宣稱已具備正式 CRUD 或 AI 推薦

## 6.2 頁面內容

至少建立：

- 目前節氣
- 節氣日期／說明
- 推薦品項
- 料理建議
- 節氣知識
- 推薦品項目前行情狀態
- 資料來源標籤
- 規則來源健康狀態

## 6.3 品項行情整合

使用 `/api/products` 對 Static Seed 推薦品項進行行情比對：

- 找到正式行情：顯示便宜／正常／偏貴與交易日
- 找不到：顯示資料不足
- 行情 API 失敗：顯示 Partial Error，不得把所有品項標成正常

## 6.4 第一版禁止事項

- 不建立尚無後端支援的節氣規則編輯器
- 不假裝可儲存規則
- 不將 Static Seed 改名為 AI 推薦
- 不刪除前台 `/season`

可在頁面顯示「規則管理 API 尚未接入」區塊，作為後續開發入口。

---

# 7. 後台視覺規格

三頁都必須遵循：

```text
docs/uiux/DASHBOARD_VISUAL_STYLE_REFERENCE.md
```

共同方向：

- 深墨綠 Sidebar
- 白色 Topbar
- 灰白內容背景
- 白色 KPI、圖表、表格卡片
- 綠／橘／紅／藍狀態語言
- 顏色不可作為唯一狀態
- 正式 API、Static Seed、Unavailable 清楚標示

尺寸：

```text
360 × 800
390 × 844
768 × 1024
834 × 1112
1200 × 800
1440 × 900
```

Mobile：

- KPI 單欄
- 圖表單欄
- 表格改卡片
- Filter Drawer
- Drawer 全寬或接近全寬

Tablet：

- KPI 兩欄
- Sidebar 72px
- 隱藏次要欄位

Desktop：

- KPI 四欄
- 圖表兩欄
- 完整表格

---

# 8. Accessibility

- 圖示按鈕有 `aria-label`
- 表格排序有 `aria-sort`
- Row click 支援 Enter／Space
- Drawer 支援 ESC、Overlay、Focus
- 圖表有文字摘要
- Loading 使用可理解文字
- 觸控區至少 44 × 44px
- Focus 樣式清楚

---

# 9. 測試與驗證

前端：

```bash
cd frontend
npm install
npm run build
git diff --check
```

後端：

```bash
cd ..
python -m compileall -q backend src
pytest tests/test_rbac_roles.py
```

新增測試至少涵蓋：

- prediction adapter normalization
- prediction Empty／Error／Partial Error
- weather status endpoint farmer／admin 200
- weather status endpoint merchant／consumer 403
- seasonal 正式 API + Static Seed 標示
- direct route permission

必須人工驗證：

```text
/dashboard/overview
/dashboard/prices
/dashboard/predictions
/dashboard/weather
/dashboard/seasonal
/
/search
/product/高麗菜
/season
```

---

# 10. 禁止事項

- 禁止新增第五種角色
- 禁止削弱 PR-5 RBAC
- 禁止用 Demo 取代正式 prediction API
- 禁止顯示虛構模型版本或完成率
- 禁止恢復已移除的假 weather CSV
- 禁止提交 CWA Token 或 Secrets
- 禁止把 Unavailable 顯示成正常或 0
- 禁止用 Static Seed 冒充正式資料庫規則
- 禁止刪除既有前台、圖表、搜尋、收藏或通知功能
- 禁止大幅刪除程式碼而不說明替代位置

---

# 11. PR 回報格式

PR 說明必須包含：

- 三個後台模組完成內容
- 每個模組的 permission
- 正式 API 清單
- Static Seed 清單
- Unavailable 清單
- Prediction 指標計算方式
- Weather capability contract
- Seasonal 行情比對方式
- Loading／Empty／Error／Partial Error／Stale
- 三尺寸驗收
- Build、compile、pytest 結果
- 程式碼刪除與替代位置
- 已知限制
- 下一階段建議

完成後建立 Pull Request，不要自行合併 `main`。
